// Ferramenta CONSULTAR_ESTOQUE — a IA usa quando o cliente final pergunta se
// um produto tem disponivel, quanto custa, ou antes de fechar uma venda.
// Somente leitura: nao decrementa nada, so informa.

const prisma = require('../../prisma');
const { resolverPrecoVenda } = require('../../produto');

const chave = 'CONSULTAR_ESTOQUE';

// Teto de itens devolvidos — se o termo for generico ("produto"), nao manda
// o catalogo inteiro pro contexto da IA (custo de token + ruido na resposta).
const MAX_ITENS = 5;

const definicao = {
  type: 'function',
  function: {
    name: 'consultar_estoque',
    description: 'Verifica se um produto ou servico existe no catalogo, se tem estoque disponivel, e qual o preco. Use antes de confirmar disponibilidade ou preco pro cliente, e antes de gerar uma cobranca.',
    parameters: {
      type: 'object',
      properties: {
        produto: {
          type: 'string',
          description: 'Nome (ou parte do nome) do produto, servico ou variacao que o cliente perguntou.',
        },
      },
      required: ['produto'],
    },
  },
};

/**
 * @param {{produto:string}} argumentos
 * @param {{clienteId:string}} contexto
 */
async function executar({ produto }, { clienteId }) {
  const termo = String(produto || '').trim();
  if (!termo) return { erro: 'Informe o nome do produto ou servico.' };

  const variacoes = await prisma.variacaoProduto.findMany({
    where: {
      produto: { clienteId, visibilidade: 'ATIVO' },
      OR: [
        { nome: { contains: termo, mode: 'insensitive' } },
        { produto: { nome: { contains: termo, mode: 'insensitive' } } },
      ],
    },
    include: { produto: true },
    take: MAX_ITENS,
  });

  if (variacoes.length === 0) {
    return { encontrado: false, mensagem: `Nenhum produto ou servico encontrado para "${termo}".` };
  }

  return {
    encontrado: true,
    itens: variacoes.map((v) => ({
      produto: v.produto.nome,
      variacao: v.nome,
      preco: resolverPrecoVenda(v),
      // Servico nao controla estoque — sempre "disponivel" (a agenda que
      // decide o horario). So produto FISICO tem quantidade de verdade.
      disponivel: v.produto.tipo === 'FISICO' ? v.estoqueAtual > 0 : true,
      quantidade: v.produto.tipo === 'FISICO' ? v.estoqueAtual : null,
    })),
  };
}

module.exports = { chave, definicao, executar };
