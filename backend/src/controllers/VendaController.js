const prisma = require('../prisma');
const { helpers: caixaHelpers } = require('./CaixaController');
const { criarVenda } = require('../services/vendaService');
const { validarCpf } = require('../utils/validacaoFiscal');

// Limites sanitarios de entrada — defesa em profundidade contra valores
// absurdos/negativos (fat-finger ou abuso). Preco negativo viraria receita
// negativa; payload gigante viraria DoS/storage. OWASP: validacao de entrada.
const MAX_ITENS_VENDA = 100;
const MAX_QUANTIDADE_ITEM = 10000;
const MAX_VALOR_UNITARIO = 1000000; // R$ 1 milhao por unidade — teto de sanidade
const MAX_OBSERVACOES = 500;
const MAX_METODO_PAGAMENTO = 40;
const MAX_NOME_CLIENTE_FINAL = 120;
// Teto de seguranca da listagem — evita findMany ilimitado em tenant grande.
const LIMITE_LISTAGEM_PADRAO = 1000;
const LIMITE_LISTAGEM_MAX = 2000;

// Valida/normaliza os dados do cliente final digitados na hora da venda —
// usado quando o item exige devolucao e ainda nao ha um Lead selecionado no
// combobox. CPF normalizado pra so-digitos (mesmo padrao de crm.routes.js),
// e validado de verdade (digito verificador) porque o Lead e criado
// automaticamente, sem revisao humana como no CRM.
function validarClienteFinal({ nome, telefone, cpf } = {}) {
  const nomeSan = typeof nome === 'string' ? nome.trim().slice(0, MAX_NOME_CLIENTE_FINAL) : '';
  const telefoneSan = typeof telefone === 'string' ? telefone.replace(/\D/g, '') : '';
  const cpfSan = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';

  if (!nomeSan) return { erro: 'Informe o nome do cliente.', campo: 'clienteFinal.nome' };
  if (!telefoneSan) return { erro: 'Informe o telefone do cliente.', campo: 'clienteFinal.telefone' };
  if (!validarCpf(cpfSan)) return { erro: 'CPF do cliente invalido.', campo: 'clienteFinal.cpf' };

  return { nome: nomeSan, telefone: telefoneSan, cpf: cpfSan };
}

// Resolve a data de devolucao de 1 item: usa a data explicita (se veio), ou o
// prazo padrao do produto (agora + diasParaDevolucaoPadrao dias). Sem nenhum
// dos dois, exige que o usuario informe manualmente. `agora` injetavel pra
// teste determinístico.
function resolverDataDevolucao({ dataDevolucaoInput, diasParaDevolucaoPadrao, nomeProduto, agora = new Date() }) {
  if (dataDevolucaoInput) {
    const d = new Date(dataDevolucaoInput);
    if (Number.isNaN(d.getTime())) return { erro: `Data de devolucao invalida pra ${nomeProduto}.` };
    if (d.getTime() <= agora.getTime()) return { erro: `Data de devolucao de ${nomeProduto} precisa ser no futuro.` };
    return { data: d };
  }
  if (diasParaDevolucaoPadrao) {
    return { data: new Date(agora.getTime() + diasParaDevolucaoPadrao * 24 * 60 * 60 * 1000) };
  }
  return { erro: `Informe a data de devolucao de ${nomeProduto}.` };
}

class VendaController {

  async registrarVenda(req, res) {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

    // Aceita 2 formatos no body pra retrocompatibilidade:
    //   NOVO: { itens: [{ variacaoId, quantidade, valorUnitario? }], ... }
    //   LEGACY: { variacaoId, quantidade, valorTotal, ... } — 1 item
    // Se valorUnitario vier vazio, resolve pela regra do catalogo
    // (mesma logica do bot tool).
    const {
      leadId,
      // Dados do cliente final digitados na hora ({nome, telefone, cpf}) —
      // usado quando o carrinho tem item com devolucao e ainda nao ha um
      // Lead selecionado. Vira (ou reaproveita) um Lead de verdade.
      clienteFinal,
      itens: itensInput,
      variacaoId,           // legacy
      quantidade,           // legacy
      valorTotal,           // legacy
      metodoPagamento,
      observacoes,
      // categoriaId no body e IGNORADO — categoria agora vem do produto de
      // cada item, e backend gera 1 lancamento por categoria (relatorios
      // financeiros ficam precisos quando venda tem produtos de categorias
      // diferentes). Mantemos no destructuring pra retrocompat sem erro.
      categoriaId: _categoriaIdIgnorado,
      // 'parcelas' e METADATA, nao gera multiplos lancamentos. Quando o
      // cliente paga em 12x no cartao, a operadora paga o lojista o valor
      // cheio (~30 dias). Sistema registra 1 lancamento PAGO + nota na
      // descricao ("12x no cartao") pro relatorio mostrar.
      parcelas,
    } = req.body;

    // Normaliza itens: legacy -> [{ ... }]; novo -> usa direto.
    let itens = [];
    if (Array.isArray(itensInput) && itensInput.length > 0) {
      itens = itensInput;
    } else if (variacaoId && quantidade) {
      itens = [{ variacaoId, quantidade, valorUnitario: valorTotal && quantidade ? Number(valorTotal) / Number(quantidade) : null }];
    } else {
      return res.status(400).json({
        error: 'Informe pelo menos 1 item: { itens: [{ variacaoId, quantidade }] }',
        campos: ['itens'],
      });
    }

    if (itens.length > MAX_ITENS_VENDA) {
      return res.status(422).json({ error: `Venda com itens demais (máximo ${MAX_ITENS_VENDA}).`, campos: ['itens'] });
    }

    // Sanitiza campos de texto livre (bounds de tamanho).
    const observacoesSan = typeof observacoes === 'string' ? observacoes.slice(0, MAX_OBSERVACOES) : '';
    const metodoPagamentoSan = typeof metodoPagamento === 'string'
      ? (metodoPagamento.slice(0, MAX_METODO_PAGAMENTO).trim() || null)
      : null;

    // Valida cada item e busca variacao (em 1 query so).
    const variacaoIds = itens.map((i) => i.variacaoId).filter(Boolean);
    if (variacaoIds.length === 0) {
      return res.status(400).json({ error: 'Cada item precisa de variacaoId.' });
    }

    try {
      const variacoesDb = await prisma.variacaoProduto.findMany({
        where: { id: { in: variacaoIds }, produto: { clienteId } },
        include: { produto: true },
      });
      const mapaVariacao = new Map(variacoesDb.map((v) => [v.id, v]));

      // Valida cada item (existe + quantidade > 0 + estoque suficiente)
      const itensValidados = [];
      let algumItemPrecisaDevolucao = false;
      for (const item of itens) {
        const v = mapaVariacao.get(item.variacaoId);
        if (!v) {
          return res.status(404).json({ error: `Variacao ${item.variacaoId} nao encontrada.` });
        }
        const qtd = parseInt(item.quantidade, 10);
        if (!Number.isFinite(qtd) || qtd <= 0 || qtd > MAX_QUANTIDADE_ITEM) {
          return res.status(422).json({ error: `Quantidade invalida pra ${v.produto.nome}.` });
        }
        if (v.produto.tipo === 'FISICO' && v.estoqueAtual - qtd < 0) {
          return res.status(422).json({
            error: `Estoque insuficiente em ${v.produto.nome} (${v.nome}). Disponivel: ${v.estoqueAtual}, solicitado: ${qtd}.`,
            disponivel: v.estoqueAtual,
          });
        }
        // Preco: se vier valorUnitario explicito (sobrescrita manual), usa.
        // Caso contrario, resolve pelo helper (regra catalogo > estoque).
        const { resolverPrecoVenda } = require('../produto');
        const precoUnit = (item.valorUnitario != null && !Number.isNaN(parseFloat(item.valorUnitario)))
          ? parseFloat(item.valorUnitario)
          : resolverPrecoVenda(v);
        // Preço não pode ser negativo (viraria receita negativa) nem absurdo.
        if (!Number.isFinite(precoUnit) || precoUnit < 0 || precoUnit > MAX_VALOR_UNITARIO) {
          return res.status(422).json({ error: `Preço inválido pra ${v.produto.nome} — não pode ser negativo.`, campos: ['valorUnitario'] });
        }

        // Aluguel/devolucao: produto marcado exige uma data de devolucao (a
        // explicita do item, ou o prazo padrao do produto) e, mais adiante,
        // um cliente identificado (leadId ou clienteFinal).
        let dataDevolucao;
        if (v.produto.temDevolucao) {
          algumItemPrecisaDevolucao = true;
          const { erro: erroData, data: dataResolvida } = resolverDataDevolucao({
            dataDevolucaoInput: item.dataDevolucao,
            diasParaDevolucaoPadrao: v.produto.diasParaDevolucaoPadrao,
            nomeProduto: `${v.produto.nome} (${v.nome})`,
          });
          if (erroData) return res.status(422).json({ error: erroData, campos: ['dataDevolucao'] });
          dataDevolucao = dataResolvida;
        }

        itensValidados.push({
          variacao: v, quantidade: qtd, precoUnitario: precoUnit, subtotal: precoUnit * qtd,
          ...(dataDevolucao ? { dataDevolucao } : {}),
        });
      }

      // Item com devolucao exige cliente identificado — ou um Lead ja
      // existente (leadId), ou os dados digitados na hora (clienteFinal),
      // que viram (ou reaproveitam) um Lead de verdade.
      let leadIdEfetivo = leadId || null;
      if (algumItemPrecisaDevolucao && !leadIdEfetivo) {
        const { erro: erroClienteFinal, campo: campoClienteFinal, nome, telefone, cpf } = validarClienteFinal(clienteFinal);
        if (erroClienteFinal) {
          return res.status(422).json({
            error: `Item com devolução precisa de um cliente identificado. ${erroClienteFinal}`,
            campos: [campoClienteFinal],
          });
        }
        let lead = await prisma.lead.findFirst({ where: { clienteId, cpf } });
        if (!lead) lead = await prisma.lead.findFirst({ where: { clienteId, telefone } });
        if (!lead) {
          lead = await prisma.lead.create({ data: { clienteId, nome, telefone, cpf, origem: 'VENDA', valor: 0 } });
        }
        leadIdEfetivo = lead.id;
      }

      const valorTotalCalculado = itensValidados.reduce((acc, i) => acc + i.subtotal, 0);

      // Venda manual EXIGE caixa aberto. Sem caixa, retorna 409 com codigo
      // pra frontend mostrar dialogo amigavel "Abra o caixa antes".
      const sessaoAberta = await caixaHelpers.buscarSessaoAberta(clienteId);
      if (!sessaoAberta) {
        return res.status(409).json({
          error: 'Abra o caixa antes de registrar a venda. Ele controla o saldo do dia e fica disponível em Financeiro · Caixa.',
          codigo: 'CAIXA_FECHADO',
        });
      }

      // Descricao resumida: nome do 1o item + "(+N itens)" se houver mais.
      // Anota parcelas quando >1 (metadata pra relatorio).
      const descPrincipal = itensValidados[0].variacao.produto.nome;
      const parcelasNum = parseInt(parcelas, 10);
      const sufixoParcelas = Number.isFinite(parcelasNum) && parcelasNum > 1
        ? ` · ${parcelasNum}x ${metodoPagamentoSan === 'CREDITO' ? 'no cartão' : ''}`.trimEnd()
        : '';
      const descricaoVenda = observacoesSan
        ? `${observacoesSan}${sufixoParcelas}`
        : itensValidados.length === 1
          ? `${descPrincipal} (${itensValidados[0].variacao.nome}) x${itensValidados[0].quantidade}${sufixoParcelas}`
          : `${descPrincipal} +${itensValidados.length - 1} item(s)${sufixoParcelas}`;

      // Nucleo transacional (venda + baixa de estoque + lancamento) vive em
      // services/vendaService.js — reusado tambem pela confirmacao automatica
      // de pagamento do bot (mesma logica, sem duplicar a parte arriscada).
      const resultado = await criarVenda({
        clienteId,
        sessaoCaixaId: sessaoAberta.id,
        itensValidados,
        leadId: leadIdEfetivo,
        metodoPagamento: metodoPagamentoSan,
        descricaoVenda,
      });

      return res.status(201).json({ success: true, data: resultado });

    } catch (error) {
      console.error('[VendaController]', error);
      return res.status(500).json({ error: 'Erro ao processar a venda.' });
    }
  }

  /**
   * Cancela uma venda. Estorna estoque e cancela lançamentos financeiros
   * vinculados em uma única transação. Idempotente: se a venda já estava
   * cancelada, retorna 200 sem efeito colateral.
   *
   * Body opcional: { motivo: string }.
   */
  async cancelarVenda(req, res) {
    const { clienteId, id: usuarioId } = req.usuario;
    if (!clienteId) {
      return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
    }

    const { id } = req.params;
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';

    // Motivo obrigatorio — preserva auditoria. Sem ele, qualquer um cancela
    // venda sem rastro. Minimo 5 caracteres pra evitar "ok", "xxx" etc.
    if (motivo.length < 5) {
      return res.status(422).json({
        error: 'Informe o motivo do cancelamento (mínimo 5 caracteres). Sem motivo, não tem como auditar depois.',
        campos: ['motivo'],
      });
    }

    try {
      const venda = await prisma.venda.findFirst({
        where: { id, clienteId },
        include: {
          movimentacoesEstoque: true,
          lancamentosFinanceiros: true,
        },
      });
      if (!venda) return res.status(404).json({ error: 'Venda não encontrada.' });
      if (venda.status === 'CANCELLED') {
        return res.status(200).json({ ok: true, ja_cancelada: true, venda });
      }

      const agora = new Date();

      const resultado = await prisma.$transaction(async (tx) => {
        // Re-busca venda + relacionadas DENTRO da transacao. Garante consistencia
        // se algo foi alterado entre o fetch inicial e o cancelamento (ex:
        // lancamento editado, segunda tentativa de cancelar em race).
        const vendaFresca = await tx.venda.findFirst({
          where: { id, clienteId },
          include: {
            movimentacoesEstoque: true,
            lancamentosFinanceiros: true,
          },
        });
        if (!vendaFresca) throw Object.assign(new Error('Venda nao encontrada.'), { status: 404 });
        if (vendaFresca.status === 'CANCELLED') {
          // Race: outra requisicao cancelou antes. Retorna a versao atual.
          return vendaFresca;
        }

        // 1. Marca venda como cancelada (motivo ja validado obrigatorio).
        const atualizada = await tx.venda.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            dataCancelamento: agora,
            motivoCancelamento: motivo,
            canceladaPorId: usuarioId || null,
          },
        });

        // 2. Estorna estoque para CADA movimentação tipo VENDA dessa venda.
        // Cria DEVOLUCAO compensatoria e atualiza saldo. Idempotente: se ja
        // existir DEVOLUCAO pra esse mesmo (vendaId, variacaoId), pula —
        // evita estorno duplo em retry.
        const devolucoesExistentes = new Set(
          (vendaFresca.movimentacoesEstoque || [])
            .filter((m) => m.tipo === 'DEVOLUCAO')
            .map((m) => m.variacaoId)
        );
        for (const m of vendaFresca.movimentacoesEstoque || []) {
          if (m.tipo !== 'VENDA') continue;
          if (devolucoesExistentes.has(m.variacaoId)) {
            console.warn(`[cancelarVenda] DEVOLUCAO ja existe pra venda ${vendaFresca.numero} variacao ${m.variacaoId} — pulando estorno.`);
            continue;
          }
          const qtdEstorno = Math.abs(m.quantidade);
          await tx.movimentacaoEstoque.create({
            data: {
              variacaoId: m.variacaoId,
              tipo: 'DEVOLUCAO',
              quantidade: qtdEstorno,
              motivo: `Cancelamento da venda #${vendaFresca.numero} — ${motivo}`,
              vendaId: vendaFresca.id,
            },
          });
          await tx.variacaoProduto.update({
            where: { id: m.variacaoId },
            data: { estoqueAtual: { increment: qtdEstorno } },
          });
        }

        // 3. Cancela lançamentos financeiros vinculados (que ainda não estão
        // cancelados). Marca data e motivo. Loga se valor foi alterado pos-venda
        // (auditoria — divergencia entre venda e financeiro).
        for (const l of vendaFresca.lancamentosFinanceiros || []) {
          if (l.status === 'CANCELADO') continue;
          if (l.status !== 'PAGO') {
            console.warn(`[cancelarVenda] Lancamento ${l.id} venda ${vendaFresca.numero} estava em status ${l.status} (esperado PAGO) — cancelando mesmo assim.`);
          }
          await tx.lancamentoFinanceiro.update({
            where: { id: l.id },
            data: {
              status: 'CANCELADO',
              dataCancelamento: agora,
              motivoCancelamento: `Cancelamento da venda #${vendaFresca.numero} — ${motivo}`,
            },
          });
        }

        return atualizada;
      });

      return res.json({ ok: true, venda: resultado });
    } catch (error) {
      console.error('[VendaController/cancelar]', error);
      return res.status(500).json({ error: 'Erro ao cancelar venda.' });
    }
  }

  /**
   * Vincula (ou desvincula) um lead a uma venda ja registrada. Util pra
   * quando a venda foi feita sem cliente identificado e dps o vendedor
   * descobre quem era — preserva auditoria no CRM.
   *
   * Body: { leadId: string | null }.
   * Propaga o leadId tambem pros LancamentoFinanceiro vinculados pra
   * manter consistencia (relatorios por cliente ficam corretos).
   */
  async vincularLead(req, res) {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

    const { id } = req.params;
    const { leadId } = req.body || {};

    try {
      const venda = await prisma.venda.findFirst({ where: { id, clienteId } });
      if (!venda) return res.status(404).json({ error: 'Venda nao encontrada.' });

      // leadId pode ser null (desvinculo) ou string (vinculo novo).
      let leadValido = null;
      if (leadId) {
        leadValido = await prisma.lead.findFirst({
          where: { id: leadId, clienteId },
          select: { id: true, nome: true },
        });
        if (!leadValido) return res.status(404).json({ error: 'Lead nao encontrado ou nao pertence ao tenant.' });
      }

      const atualizada = await prisma.$transaction(async (tx) => {
        const v = await tx.venda.update({
          where: { id },
          data: { leadId: leadValido?.id || null },
          include: { lead: true },
        });
        // Propaga pros lancamentos pra consistencia em relatorios por cliente.
        await tx.lancamentoFinanceiro.updateMany({
          where: { vendaId: id, clienteId },
          data: { leadId: leadValido?.id || null },
        });
        return v;
      });

      return res.json({ ok: true, venda: atualizada });
    } catch (error) {
      console.error('[VendaController/vincularLead]', error);
      return res.status(500).json({ error: 'Erro ao vincular cliente.' });
    }
  }

  /**
   * Lista as vendas do cliente.
   */
  async listarVendas(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      // Teto de segurança: nunca carrega ilimitado. ?limite= permite paginar depois.
      const limiteBruto = parseInt(req.query.limite, 10);
      const take = Number.isFinite(limiteBruto) && limiteBruto > 0
        ? Math.min(limiteBruto, LIMITE_LISTAGEM_MAX)
        : LIMITE_LISTAGEM_PADRAO;
      const vendas = await prisma.venda.findMany({
        where: { clienteId },
        include: {
          lead: true,
          movimentacoesEstoque: {
            include: {
              variacao: {
                include: { produto: true }
              }
            }
          },
          lancamentosFinanceiros: true
        },
        orderBy: { criadoEm: 'desc' },
        take,
      });
      res.json(vendas);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar vendas.' });
    }
  }
}

const instancia = new VendaController();
// Expostas pra teste unitario das regras puras (sem I/O).
instancia.validarClienteFinal = validarClienteFinal;
instancia.resolverDataDevolucao = resolverDataDevolucao;
module.exports = instancia;
