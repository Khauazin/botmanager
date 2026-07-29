// Ferramenta COBRANCA_PIX — a IA usa quando o cliente final confirma o que
// quer comprar e precisa pagar. Gera um Pix via o PSP configurado pelo
// TENANT (Mercado Pago/Asaas/Pagar.me — nao a chave de IA da plataforma,
// que e outra coisa). O carrinho pretendido fica guardado na Cobranca
// (itensPendentes); quando o Pix for confirmado, cobrancaPagamento.js cria a
// Venda de verdade (baixa de estoque + lancamento) — ver aplicarEfeitoConfirmacao.

const prisma = require('../../prisma');
const { resolverPrecoVenda } = require('../../produto');
const { criarCobranca } = require('../pagamentoService');

const chave = 'COBRANCA_PIX';

const definicao = {
  type: 'function',
  function: {
    name: 'gerar_cobranca_pix',
    description: 'Gera uma cobranca Pix pro cliente pagar os itens que ele decidiu comprar. So chame depois que o cliente confirmar exatamente o que quer e a quantidade — use consultar_estoque antes pra confirmar preco e disponibilidade.',
    parameters: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          description: 'Itens que o cliente vai comprar.',
          items: {
            type: 'object',
            properties: {
              produto: { type: 'string', description: 'Nome do produto ou variacao, como veio de consultar_estoque.' },
              quantidade: { type: 'integer', description: 'Quantidade desejada.' },
            },
            required: ['produto', 'quantidade'],
          },
        },
      },
      required: ['itens'],
    },
  },
};

/**
 * @param {{itens:Array<{produto:string, quantidade:number}>}} argumentos
 * @param {{clienteId:string}} contexto
 */
async function executar({ itens }, { clienteId }) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { erro: 'Informe pelo menos 1 item.' };
  }

  // Resolve cada item pra uma variacao real do tenant — nao confia em id vindo
  // da IA (ela nao tem), busca pelo nome de novo aqui pra pegar preco/estoque
  // atualizados no momento exato da cobranca (nao o que consultar_estoque
  // devolveu antes, que pode ter ficado desatualizado na conversa).
  const itensResolvidos = [];
  for (const item of itens) {
    const termo = String(item?.produto || '').trim();
    const qtd = parseInt(item?.quantidade, 10);
    if (!termo || !Number.isInteger(qtd) || qtd <= 0) {
      return { erro: `Item invalido: produto e quantidade sao obrigatorios (recebido: ${JSON.stringify(item)}).` };
    }

    const variacao = await prisma.variacaoProduto.findFirst({
      where: {
        produto: { clienteId, visibilidade: 'ATIVO' },
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { produto: { nome: { contains: termo, mode: 'insensitive' } } },
        ],
      },
      include: { produto: true },
    });
    if (!variacao) return { erro: `Produto "${termo}" nao encontrado no catalogo.` };
    if (variacao.produto.tipo === 'FISICO' && variacao.estoqueAtual < qtd) {
      return { erro: `Estoque insuficiente para ${variacao.produto.nome} (${variacao.nome}). Disponivel: ${variacao.estoqueAtual}.` };
    }

    itensResolvidos.push({
      variacaoId: variacao.id,
      quantidade: qtd,
      nome: `${variacao.produto.nome} (${variacao.nome})`,
      preco: resolverPrecoVenda(variacao),
    });
  }

  const valorTotal = itensResolvidos.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  if (valorTotal <= 0) return { erro: 'O valor total ficou zero — confira o preco dos itens no catalogo.' };

  const descricao = itensResolvidos.map((i) => `${i.nome} x${i.quantidade}`).join(', ');

  try {
    const cobranca = await criarCobranca({
      clienteId,
      origem: 'VENDA',
      valor: valorTotal,
      metodo: 'PIX',
      descricao,
      itensPendentes: itensResolvidos.map((i) => ({ variacaoId: i.variacaoId, quantidade: i.quantidade })),
    });

    return {
      sucesso: true,
      valor: valorTotal,
      qrCode: cobranca.qrCode,
      itens: itensResolvidos.map((i) => ({ produto: i.nome, quantidade: i.quantidade })),
      instrucao: 'Envie o codigo Pix (qrCode) pro cliente copiar e colar no banco dele. A venda e registrada automaticamente assim que o pagamento for confirmado.',
    };
  } catch (erro) {
    // status=400 do provedorDoTenant e um erro de configuracao do tenant (sem
    // PSP ativo) — mensagem segura de devolver a IA. Outros erros (rede, PSP
    // fora do ar) ficam genericos pra nao vazar detalhe interno pro cliente final.
    if (erro.status === 400) return { erro: erro.message };
    console.error('[ferramenta:gerarCobrancaPix]', erro?.message || erro);
    return { erro: 'Nao foi possivel gerar a cobranca agora. Peca pro cliente tentar novamente em instantes.' };
  }
}

module.exports = { chave, definicao, executar };
