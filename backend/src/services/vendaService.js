// Nucleo transacional de venda — extraido de VendaController.registrarVenda
// pra ser reusado pela confirmacao automatica de pagamento do bot
// (services/cobrancaPagamento.js). Quem chama:
//   - ja validou os itens (estoque suficiente, preco resolvido);
//   - ja tem uma sessaoCaixaId valida — como ela foi obtida (exige caixa
//     manual aberto, ou auto-abre AUTO_BOT) e decisao de CADA chamador, nao
//     desta funcao. Isso preserva o comportamento da venda manual (409 se
//     nao tiver caixa aberto) sem duplicar a parte arriscada (baixa de
//     estoque + lancamento financeiro).
//
// Retry de numero sequencial: 2 vendas do mesmo tenant criadas em paralelo
// podem colidir na unique constraint [clienteId, numero] — raro (precisa
// cair no mesmo milissegundo) mas o retry torna a operacao segura.

const prisma = require('./../prisma');

const MAX_RETRIES_NUMERO = 5;

/**
 * @param {{
 *   clienteId: string,
 *   sessaoCaixaId: string,
 *   itensValidados: Array<{variacao:Object, quantidade:number, precoUnitario:number, subtotal:number, dataDevolucao?:Date}>,
 *   leadId?: string|null,
 *   metodoPagamento?: string|null,
 *   descricaoVenda: string,
 *   tx?: Object,
 * }} p
 * `tx`, se informado, roda DENTRO dessa transacao existente (usado pela
 * confirmacao de pagamento, que ja abriu uma transacao pra tambem
 * abrir/reaproveitar o caixa AUTO_BOT com lock). Sem `tx`, abre a propria.
 * @returns {Promise<{venda:Object, totalItens:number, valorTotal:number, lancamentos:Array, totalLancamentos:number}>}
 */
async function criarVenda({ clienteId, sessaoCaixaId, itensValidados, leadId = null, metodoPagamento = null, descricaoVenda, tx: txExterna }) {
  const valorTotalCalculado = itensValidados.reduce((acc, i) => acc + i.subtotal, 0);

  const corpo = async (tx) => {
    const venda = await tx.venda.create({
      data: {
        clienteId,
        numero: await proximoNumero(tx, clienteId),
        leadId: leadId || null,
        sessaoCaixaId,
        valor: valorTotalCalculado,
        metodoPagamento: metodoPagamento || null,
        descricao: descricaoVenda,
        status: 'COMPLETED',
      },
    });

    for (const it of itensValidados) {
      await tx.movimentacaoEstoque.create({
        data: {
          variacaoId: it.variacao.id,
          tipo: 'VENDA',
          quantidade: -Math.abs(it.quantidade),
          // Congela o custo do momento da venda (custo medio corrente) pra o
          // CMV e o lucro ficarem imutaveis nos relatorios.
          custoUnitario: it.variacao.precoCusto ?? null,
          motivo: `Venda #${venda.numero}`,
          vendaId: venda.id,
        },
      });
      if (it.variacao.produto.tipo === 'FISICO') {
        await tx.variacaoProduto.update({
          where: { id: it.variacao.id },
          data: { estoqueAtual: { increment: -Math.abs(it.quantidade) } },
        });
      }

      // Aluguel/devolucao: so cria o registro quando o produto pede devolucao,
      // veio uma data (validado antes pelo chamador) e ha um cliente
      // identificado (leadId) pra avisar quando a data chegar perto.
      if (it.variacao.produto.temDevolucao && it.dataDevolucao && leadId) {
        await tx.devolucao.create({
          data: {
            clienteId,
            vendaId: venda.id,
            variacaoId: it.variacao.id,
            leadId,
            quantidade: it.quantidade,
            dataDevolucao: it.dataDevolucao,
          },
        });
      }
    }

    // Agrupa por categoria do produto — cada grupo vira 1 LancamentoFinanceiro
    // vinculado a mesma venda, pra relatorios por categoria ficarem precisos
    // quando a venda tem produtos de categorias diferentes.
    const gruposPorCat = new Map();
    for (const it of itensValidados) {
      const catId = it.variacao.produto.categoriaId || null;
      if (!gruposPorCat.has(catId)) gruposPorCat.set(catId, []);
      gruposPorCat.get(catId).push(it);
    }

    const lancamentosCriados = [];
    for (const [catId, itensDoGrupo] of gruposPorCat.entries()) {
      const subtotalGrupo = itensDoGrupo.reduce((acc, i) => acc + i.subtotal, 0);
      const detalheItens = itensDoGrupo
        .map((it) => `${it.variacao.produto.nome} (${it.variacao.nome}) x${it.quantidade}`)
        .join(', ');
      const lanc = await tx.lancamentoFinanceiro.create({
        data: {
          clienteId,
          leadId: leadId || null,
          vendaId: venda.id,
          sessaoCaixaId,
          categoriaId: catId,
          descricao: `Receita Venda #${venda.numero}: ${detalheItens}`,
          valor: subtotalGrupo,
          tipo: 'RECEITA',
          status: 'PAGO',
          dataVencimento: new Date(),
          dataPagamento: new Date(),
        },
      });
      lancamentosCriados.push(lanc);
    }

    return {
      venda,
      totalItens: itensValidados.length,
      valorTotal: valorTotalCalculado,
      lancamentos: lancamentosCriados,
      totalLancamentos: lancamentosCriados.length,
    };
  };

  // Ja dentro de uma transacao externa (confirmacao de pagamento): so roda o
  // corpo, sem retry proprio — o chamador controla o retry/lock dele.
  if (txExterna) return corpo(txExterna);

  // Sem transacao externa (venda manual): abre a propria, com retry de numero.
  let tentativa = 0;
  while (true) {
    try {
      return await prisma.$transaction((tx) => corpo(tx));
    } catch (err) {
      if (err?.code === 'P2002' && tentativa < MAX_RETRIES_NUMERO) {
        tentativa += 1;
        continue;
      }
      throw err;
    }
  }
}

async function proximoNumero(tx, clienteId) {
  const ultima = await tx.venda.findFirst({
    where: { clienteId }, orderBy: { numero: 'desc' }, select: { numero: true },
  });
  return (ultima?.numero || 0) + 1;
}

module.exports = { criarVenda };
