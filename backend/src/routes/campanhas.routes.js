// Campanhas — v1: RECOMPRA POR CADENCIA (recompra leve).
//
// O plano define campanhas completas (disparo HSM em massa, templates Meta)
// como fase 2 do produto — depende de aprovacao de template pela Meta e da
// infra de envio. Aqui entregamos o nucleo nao-bloqueado e de valor imediato:
// a FILA DE RECOMPRA. Calcula quem comprou ha >= N dias e nao voltou, pra a
// equipe agir manualmente (abrir conversa no WhatsApp). Nada e disparado
// automaticamente nesta versao.
//
// Gating: modulo CRM (recompra e relacionamento/funil) + permissao CRM.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { mesclarConversoes, formatarListaLeads, LIMITE_RECORRENTE, DIAS_MIN_LEAD_NOVO } = require('../services/segmentacaoLeads');
const { normalizarCodigo } = require('../services/cupomService');
const { enfileirarEnvioCampanha, enfileirarEnvioCampanhaBaileys } = require('../filas');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('CRM'));

const MS_DIA = 24 * 60 * 60 * 1000;
const DIAS_PADRAO = 30;
const DIAS_MIN = 1;
const DIAS_MAX = 365;

const SEGMENTOS_VALIDOS = new Set(['recompra', 'recorrentes', 'nunca-converteram', 'convertidos']);
const MAX_NOME_CAMPANHA = 120;
const MAX_MENSAGEM_CAMPANHA = 1000;
const MAX_NOME_TEMPLATE = 120;
// Teto de seguranca pro canal nao oficial (Baileys/QR Code) — nao existe
// template/aprovacao la, entao a trava mais barata contra "selecionar 5 mil
// convertidos e estourar tudo de uma vez" (o padrao que a Meta mais pune com
// banimento de numero) e limitar o tamanho do lote.
const LIMITE_LEADS_BAILEYS = 200;

// ==========================================
// CAMPANHA — criar, listar, disparar. O cupom (se houver) nasce junto da
// campanha (mais simples que uma tela separada de cupons por ora).
// ==========================================

// POST /campanhas — cria em RASCUNHO. totalAlvo e so um preview no momento da
// criacao; o disparo resolve o segmento de novo (dado fresco) antes de enviar.
roteador.post('/', requerPermissao('CRM', 'criar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant criam campanhas.' });

    const { nome, segmento, diasRecompra, mensagem, nomeTemplate, cupom } = req.body || {};

    const nomeSan = typeof nome === 'string' ? nome.trim().slice(0, MAX_NOME_CAMPANHA) : '';
    if (!nomeSan) return res.status(422).json({ erro: 'Informe o nome da campanha.', campos: ['nome'] });

    if (!SEGMENTOS_VALIDOS.has(segmento)) {
      return res.status(422).json({ erro: `Segmento invalido. Valores: ${[...SEGMENTOS_VALIDOS].join(', ')}.`, campos: ['segmento'] });
    }

    const mensagemSan = typeof mensagem === 'string' ? mensagem.trim().slice(0, MAX_MENSAGEM_CAMPANHA) : '';
    if (!mensagemSan) return res.status(422).json({ erro: 'Informe a mensagem da campanha.', campos: ['mensagem'] });

    const nomeTemplateSan = typeof nomeTemplate === 'string' && nomeTemplate.trim()
      ? nomeTemplate.trim().slice(0, MAX_NOME_TEMPLATE)
      : null;

    const diasRecompraSan = segmento === 'recompra'
      ? Math.min(Math.max(Number.isFinite(parseInt(diasRecompra, 10)) ? parseInt(diasRecompra, 10) : DIAS_PADRAO, DIAS_MIN), DIAS_MAX)
      : null;

    // Cupom opcional, embutido na criacao da campanha.
    let cupomId = null;
    if (cupom && typeof cupom === 'object') {
      const codigo = normalizarCodigo(cupom.codigo);
      if (!codigo) return res.status(422).json({ erro: 'Informe o codigo do cupom.', campos: ['cupom.codigo'] });

      const tipo = cupom.tipo === 'VALOR' ? 'VALOR' : 'PERCENTUAL';
      const valor = Number(cupom.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return res.status(422).json({ erro: 'Valor do cupom deve ser maior que zero.', campos: ['cupom.valor'] });
      }
      if (tipo === 'PERCENTUAL' && valor > 100) {
        return res.status(422).json({ erro: 'Desconto percentual nao pode passar de 100%.', campos: ['cupom.valor'] });
      }

      const existente = await prisma.cupom.findFirst({ where: { clienteId, codigo } });
      if (existente) return res.status(409).json({ erro: `Ja existe um cupom com o codigo ${codigo}.`, campos: ['cupom.codigo'] });

      const validoAteSan = cupom.validoAte ? new Date(cupom.validoAte) : null;
      if (validoAteSan && Number.isNaN(validoAteSan.getTime())) {
        return res.status(422).json({ erro: 'Data de validade do cupom invalida.', campos: ['cupom.validoAte'] });
      }
      const usoMaximoNum = parseInt(cupom.usoMaximo, 10);
      const usoMaximoSan = Number.isInteger(usoMaximoNum) && usoMaximoNum > 0 ? usoMaximoNum : null;

      const novoCupom = await prisma.cupom.create({
        data: { clienteId, codigo, tipo, valor, validoAte: validoAteSan, usoMaximo: usoMaximoSan },
      });
      cupomId = novoCupom.id;
    }

    const leadIds = await resolverLeadIdsDoSegmento(clienteId, segmento, { diasRecompra: diasRecompraSan || DIAS_PADRAO });

    const campanha = await prisma.campanha.create({
      data: {
        clienteId,
        nome: nomeSan,
        segmento,
        diasRecompra: diasRecompraSan,
        mensagem: mensagemSan,
        nomeTemplate: nomeTemplateSan,
        cupomId,
        totalAlvo: leadIds.length,
        criadoPorId: req.usuario.id || null,
      },
      include: { cupom: true },
    });

    res.status(201).json(campanha);
  } catch (erro) {
    console.error('[campanhas/criar]', erro);
    res.status(500).json({ erro: 'Erro ao criar campanha.' });
  }
});

// GET /campanhas — lista as campanhas do tenant.
roteador.get('/', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const campanhas = await prisma.campanha.findMany({
      where: { clienteId },
      include: { cupom: true },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(campanhas);
  } catch (erro) {
    console.error('[campanhas/listar]', erro);
    res.status(500).json({ erro: 'Erro ao listar campanhas.' });
  }
});

// GET /campanhas/recompra?dias=30
// Candidatos: leads cuja ULTIMA compra (venda COMPLETED) foi ha >= `dias` dias
// e que nao compraram de novo desde entao. Ordena do mais "vencido" ao mais
// recente. v1: lista pra acao manual; nao dispara mensagem.
roteador.get('/recompra', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam a recompra.' });
    }

    const diasBruto = parseInt(req.query.dias, 10);
    const dias = Math.min(Math.max(Number.isFinite(diasBruto) ? diasBruto : DIAS_PADRAO, DIAS_MIN), DIAS_MAX);
    const corte = new Date(Date.now() - dias * MS_DIA);

    // Ultima compra por lead (so vendas concluidas, com lead vinculado).
    const grupos = await prisma.venda.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _max: { data: true },
      _count: { _all: true },
      _sum: { valor: true },
    });

    // Vencidos: ultima compra <= corte (nao voltaram dentro da janela).
    const vencidos = grupos.filter((g) => g._max.data && new Date(g._max.data) <= corte);
    const leadIds = vencidos.map((g) => g.leadId);
    if (leadIds.length === 0) {
      return res.json({ dias, corte, candidatos: [] });
    }

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, clienteId },
      select: { id: true, nome: true, telefone: true, ultimoContato: true },
    });
    const mapaLead = new Map(leads.map((l) => [l.id, l]));

    const candidatos = vencidos
      .map((g) => {
        const lead = mapaLead.get(g.leadId);
        if (!lead) return null;
        const ultimaCompra = g._max.data;
        const diasDesde = Math.floor((Date.now() - new Date(ultimaCompra).getTime()) / MS_DIA);
        return {
          leadId: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          ultimaCompra,
          diasDesde,
          totalCompras: g._count._all,
          valorTotal: g._sum.valor || 0,
          // Pra UI sinalizar quem ja foi contatado depois da ultima compra.
          ultimoContato: lead.ultimoContato,
          contatadoAposCompra: lead.ultimoContato ? new Date(lead.ultimoContato) > new Date(ultimaCompra) : false,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.diasDesde - a.diasDesde);

    res.json({ dias, corte, candidatos });
  } catch (erro) {
    console.error('[campanhas/recompra]', erro);
    res.status(500).json({ erro: 'Erro ao calcular a fila de recompra.' });
  }
});

// ==========================================
// SEGMENTACAO DE LEADS — pra fidelizar quem ja passou pela base (loja ou
// clinica/servico). "Conversao" conta tanto VENDA quanto ATENDIMENTO
// concluido, porque um tenant de servico nao tem venda de produto. Regras
// puras (merge/formatacao) vivem em services/segmentacaoLeads.js.
// ==========================================

// Agrega vendas COMPLETED + agendamentos COMPLETED por lead num unico mapa.
async function buscarConversoesPorLead(clienteId) {
  const [vendasPorLead, agendamentosPorLead] = await Promise.all([
    prisma.venda.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _count: { _all: true },
      _sum: { valor: true },
      _max: { data: true },
    }),
    prisma.agendamento.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _count: { _all: true },
      _max: { data: true },
    }),
  ]);
  return mesclarConversoes(vendasPorLead, agendamentosPorLead);
}

// Busca os dados de contato dos leads e monta a resposta.
async function montarListaLeads(clienteId, entradas) {
  const leadIds = entradas.map((e) => e.leadId);
  if (leadIds.length === 0) return [];
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, clienteId },
    select: { id: true, nome: true, telefone: true },
  });
  return formatarListaLeads(entradas, leads);
}

// Resolve so os IDs dos leads de 1 segmento — usado pelo disparo de campanha
// (que so precisa da lista pra criar os CampanhaEnvio, nao do detalhe
// formatado que as rotas de visualizacao devolvem).
async function resolverLeadIdsDoSegmento(clienteId, segmento, { diasRecompra = DIAS_PADRAO } = {}) {
  if (segmento === 'recompra') {
    const corte = new Date(Date.now() - diasRecompra * MS_DIA);
    const grupos = await prisma.venda.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _max: { data: true },
    });
    return grupos.filter((g) => g._max.data && new Date(g._max.data) <= corte).map((g) => g.leadId);
  }

  const mapa = await buscarConversoesPorLead(clienteId);
  if (segmento === 'recorrentes') {
    return [...mapa.values()].filter((e) => (e.compras + e.atendimentos) >= LIMITE_RECORRENTE).map((e) => e.leadId);
  }
  if (segmento === 'convertidos') {
    return [...mapa.keys()];
  }
  if (segmento === 'nunca-converteram') {
    const corte = new Date(Date.now() - DIAS_MIN_LEAD_NOVO * MS_DIA);
    const leads = await prisma.lead.findMany({
      where: { clienteId, criadoEm: { lte: corte }, id: { notIn: [...mapa.keys()] } },
      select: { id: true },
    });
    return leads.map((l) => l.id);
  }
  return [];
}

// GET /campanhas/recorrentes — leads com 2+ compras/atendimentos concluidos.
// Ja fidelizados; uteis pra campanha de fidelidade/indicacao.
roteador.get('/recorrentes', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const mapa = await buscarConversoesPorLead(clienteId);
    const entradas = [...mapa.values()].filter((e) => (e.compras + e.atendimentos) >= LIMITE_RECORRENTE);
    const leads = await montarListaLeads(clienteId, entradas);
    res.json({ leads });
  } catch (erro) {
    console.error('[campanhas/recorrentes]', erro);
    res.status(500).json({ erro: 'Erro ao buscar leads recorrentes.' });
  }
});

// GET /campanhas/convertidos — todo lead com pelo menos 1 conversao (venda ou
// atendimento concluido). Superset de recorrentes + fila de recompra.
roteador.get('/convertidos', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const mapa = await buscarConversoesPorLead(clienteId);
    const leads = await montarListaLeads(clienteId, [...mapa.values()]);
    res.json({ leads });
  } catch (erro) {
    console.error('[campanhas/convertidos]', erro);
    res.status(500).json({ erro: 'Erro ao buscar leads convertidos.' });
  }
});

// GET /campanhas/nunca-converteram — leads sem nenhuma venda/atendimento
// concluido, cadastrados ha 7+ dias (lead novo ainda esta no funil normal,
// nao "perdeu a chance" ainda).
roteador.get('/nunca-converteram', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const mapa = await buscarConversoesPorLead(clienteId);
    const corte = new Date(Date.now() - DIAS_MIN_LEAD_NOVO * MS_DIA);
    const leads = await prisma.lead.findMany({
      where: { clienteId, criadoEm: { lte: corte }, id: { notIn: [...mapa.keys()] } },
      select: { id: true, nome: true, telefone: true, criadoEm: true },
      orderBy: { criadoEm: 'asc' },
    });
    res.json({
      leads: leads.map((l) => ({
        leadId: l.id,
        nome: l.nome,
        telefone: l.telefone,
        criadoEm: l.criadoEm,
        diasSemConverter: Math.floor((Date.now() - new Date(l.criadoEm).getTime()) / MS_DIA),
      })),
    });
  } catch (erro) {
    console.error('[campanhas/nunca-converteram]', erro);
    res.status(500).json({ erro: 'Erro ao buscar leads sem conversao.' });
  }
});

// POST /campanhas/:id/disparar — resolve o segmento de novo (dado fresco, nao
// o totalAlvo salvo na criacao), cria 1 CampanhaEnvio por lead (idempotente —
// upsert) e enfileira 1 job por envio. Exige nomeTemplate configurado: a Meta
// bloqueia mensagem livre em massa fora da janela de 24h.
// Registrada DEPOIS dos segmentos (path literal) de proposito — ':id' e
// generico e casaria com "recompra" etc se viesse antes.
roteador.post('/:id/disparar', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant disparam campanhas.' });

    const campanha = await prisma.campanha.findFirst({ where: { id: req.params.id, clienteId } });
    if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada.' });
    if (campanha.status !== 'RASCUNHO') {
      return res.status(422).json({ erro: 'Essa campanha ja foi disparada.' });
    }

    // O gate de template so faz sentido pro canal oficial (Meta bloqueia
    // mensagem livre em massa fora da janela de 24h). O canal nao oficial
    // (Baileys/QR Code) nao tem template — texto livre — mas em troca leva um
    // teto de leads por disparo (risco de banimento do numero em massa).
    const bot = await prisma.bot.findFirst({
      where: { clienteId, identificadorCanal: { not: null } },
      select: { provedorCanal: true },
    });
    const usaBaileys = bot?.provedorCanal === 'BAILEYS';

    if (!usaBaileys && !campanha.nomeTemplate) {
      return res.status(422).json({
        erro: 'Configure o nome do template aprovado na Meta antes de disparar.',
        campos: ['nomeTemplate'],
      });
    }

    const leadIds = await resolverLeadIdsDoSegmento(clienteId, campanha.segmento, { diasRecompra: campanha.diasRecompra || DIAS_PADRAO });
    if (leadIds.length === 0) {
      return res.status(422).json({ erro: 'Nenhum lead nesse segmento no momento — nada pra disparar.' });
    }
    if (usaBaileys && leadIds.length > LIMITE_LEADS_BAILEYS) {
      return res.status(422).json({
        erro: `O canal não oficial (WhatsApp Web) permite no máximo ${LIMITE_LEADS_BAILEYS} leads por disparo — reduza o segmento ou divida o envio em dias, pra não arriscar o número ser banido.`,
      });
    }

    const envios = await prisma.$transaction(
      leadIds.map((leadId) => prisma.campanhaEnvio.upsert({
        where: { campanhaId_leadId: { campanhaId: campanha.id, leadId } },
        create: { campanhaId: campanha.id, leadId },
        update: {},
      })),
    );

    await prisma.campanha.update({
      where: { id: campanha.id },
      data: { status: 'ENVIANDO', totalAlvo: envios.length },
    });

    let indiceNoLote = 0;
    for (const envio of envios) {
      if (envio.status !== 'PENDENTE') continue;
      if (usaBaileys) {
        await enfileirarEnvioCampanhaBaileys(envio.id, indiceNoLote);
        indiceNoLote += 1;
      } else {
        await enfileirarEnvioCampanha(envio.id);
      }
    }

    res.json({ ok: true, totalAlvo: envios.length });
  } catch (erro) {
    console.error('[campanhas/disparar]', erro);
    res.status(500).json({ erro: 'Erro ao disparar campanha.' });
  }
});

// GET /campanhas/:id — detalhe + progresso do disparo.
roteador.get('/:id', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const campanha = await prisma.campanha.findFirst({
      where: { id: req.params.id, clienteId },
      include: { cupom: true },
    });
    if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada.' });
    res.json(campanha);
  } catch (erro) {
    console.error('[campanhas/detalhe]', erro);
    res.status(500).json({ erro: 'Erro ao buscar campanha.' });
  }
});

module.exports = roteador;
