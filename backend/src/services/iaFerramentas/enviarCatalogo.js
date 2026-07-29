// Ferramenta CATALOGO — a IA usa quando o cliente final pede pra ver o
// catalogo/produtos/o que a loja vende. Monta o PDF (layout configurado pelo
// tenant em ConfiguracaoCatalogo), sobe pro MinIO e manda como documento no
// WhatsApp — diferente das outras ferramentas, esta tem efeito colateral de
// ENVIO direto (documento nao cabe dentro do texto de resposta da IA).

const prisma = require('../../prisma');
const { resolverPrecoVenda } = require('../../produto');
const { montarHtml, renderizarPdf } = require('../catalogoPdf');
const { upload, urlAssinada } = require('../../storage/minio');
const { enviarDocumento } = require('../whatsappCloud');

const chave = 'CATALOGO';

/**
 * Decide se um produto deve aparecer no catalogo, dada a configuracao do
 * tenant. Funcao pura — separada do fetch/Puppeteer/upload pra poder testar a
 * regra sem I/O. Servico nao controla estoque (sempre visivel); FISICO com
 * estoque zerado some quando ocultarSemEstoque esta ligado (padrao).
 * @param {{tipo:string, variacoes:Array<{estoqueAtual:number}>}} produto
 * @param {Object|null} config
 */
function produtoVisivelNoCatalogo(produto, config) {
  const ocultarSemEstoque = config?.ocultarSemEstoque !== false;
  if (!ocultarSemEstoque) return true;
  if (produto.tipo !== 'FISICO') return true;
  return (produto.variacoes[0]?.estoqueAtual ?? 0) > 0;
}

const definicao = {
  type: 'function',
  function: {
    name: 'enviar_catalogo',
    description: 'Monta e envia o catalogo completo de produtos/servicos em PDF pro cliente. Use quando o cliente pedir pra ver o catalogo, os produtos, os precos, ou "o que voces vendem/fazem".',
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

/**
 * @param {Object} _argumentos sem parametros — o catalogo e sempre o completo
 * @param {{clienteId:string, botId:string, phoneNumberId:string, token:string, telefoneCliente:string}} contexto
 */
async function executar(_argumentos, { clienteId, phoneNumberId, token, telefoneCliente }) {
  if (!phoneNumberId || !token || !telefoneCliente) {
    // Contexto de envio ausente (ex.: chamado fora de um webhook real, como
    // em testes) — nao tenta enviar, devolve erro tratavel.
    return { erro: 'Nao foi possivel enviar o catalogo — canal de envio indisponivel.' };
  }

  const [cliente, produtos, config] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } }),
    prisma.produto.findMany({
      where: { clienteId, visibilidade: 'ATIVO' },
      include: { variacoes: { orderBy: { criadoEm: 'asc' }, take: 1 }, categoria: { select: { nome: true } } },
      orderBy: { nome: 'asc' },
    }),
    prisma.configuracaoCatalogo.findUnique({ where: { clienteId } }),
  ]);

  if (produtos.length === 0) {
    return { erro: 'O catalogo ainda nao tem nenhum produto ativo cadastrado.' };
  }

  const produtosParaHtml = produtos
    .filter((p) => p.variacoes.length > 0) // sem variacao nao tem preco — nao entra no PDF
    .filter((p) => produtoVisivelNoCatalogo(p, config))
    .map((p) => ({
      nome: p.nome,
      descricao: p.descricao,
      imagemUrl: p.imagemUrl,
      categoriaNome: p.categoria?.nome || null,
      preco: resolverPrecoVenda(p.variacoes[0]),
    }));

  if (produtosParaHtml.length === 0) {
    return { erro: 'Nenhum produto disponivel para o catalogo no momento (todos sem estoque).' };
  }

  const html = montarHtml({ nomeNegocio: cliente?.nome, produtos: produtosParaHtml, config });

  let pdfBuffer;
  try {
    pdfBuffer = await renderizarPdf(html);
  } catch (erro) {
    console.error('[ferramenta:enviarCatalogo] falha ao renderizar PDF', erro?.message || erro);
    return { erro: 'Nao foi possivel gerar o catalogo agora. Tente novamente em instantes.' };
  }

  // Sobe com nome fixo (sempre sobrescreve) — o catalogo e "o atual", nao
  // precisa historico de versoes antigas ocupando o bucket.
  const key = `catalogos/${clienteId}/catalogo.pdf`;
  await upload({ key, body: pdfBuffer, contentType: 'application/pdf', cacheControl: 'private, max-age=0, must-revalidate' });
  const link = await urlAssinada(key, { expiraEm: 60 * 60 }); // 1h — tempo de sobra pro WhatsApp buscar o arquivo

  const resultadoEnvio = await enviarDocumento({
    phoneNumberId, token, para: telefoneCliente, link, filename: 'catalogo.pdf', caption: cliente?.nome ? `Catalogo — ${cliente.nome}` : 'Catalogo',
  });

  if (!resultadoEnvio.ok) {
    return { erro: 'O catalogo foi gerado mas nao foi possivel enviar pelo WhatsApp agora.' };
  }

  return { sucesso: true, totalProdutos: produtosParaHtml.length };
}

module.exports = { chave, definicao, executar, produtoVisivelNoCatalogo };
