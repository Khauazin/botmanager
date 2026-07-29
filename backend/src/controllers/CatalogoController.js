const prisma = require('../prisma');
const { chaveDeUrl } = require('../storage/minio');
const { calcularPreco } = require('../produto');

/**
 * Valida que a URL de imagem foi gerada por nosso storage e pertence a este
 * tenant. Aceita null/empty (campo opcional). Retorna null se OK, ou string
 * com motivo de rejeicao.
 */
function validarImagemUrlDoTenant(imagemUrl, clienteId) {
  if (imagemUrl === null || imagemUrl === undefined || imagemUrl === '') return null;
  if (typeof imagemUrl !== 'string') return 'imagemUrl invalida.';
  const key = chaveDeUrl(imagemUrl);
  if (!key) return 'URL nao reconhecida pelo storage.';
  if (!key.startsWith(`produtos/${clienteId}/`)) return 'imagemUrl nao pertence a este tenant.';
  return null;
}

// Valida que os especialistas pertencem ao tenant. Retorna os ids validos.
async function validarEspecialistas(clienteId, ids) {
  if (!Array.isArray(ids)) return [];
  const limpos = ids.filter((x) => typeof x === 'string');
  if (limpos.length === 0) return [];
  const esps = await prisma.especialista.findMany({
    where: { id: { in: limpos }, clienteId },
    select: { id: true },
  });
  return esps.map((e) => e.id);
}

// Normaliza o preco de uma variacao: quando o body traz custo/lucro, recalcula o
// `preco` derivado. Sem custo/lucro no body, nao mexe (compat com cliente legado
// que ainda manda o preco cheio).
function normalizarPrecoVariacao(dados) {
  if (!dados || typeof dados !== 'object') return dados;
  const temCustoLucro = dados.precoCusto !== undefined
    || dados.lucroTipo !== undefined
    || dados.lucroValor !== undefined;
  if (!temCustoLucro) return dados;
  const lucroTipo = dados.lucroTipo === 'PERCENTUAL' ? 'PERCENTUAL' : 'VALOR';
  const lucroValor = Number(dados.lucroValor) || 0;
  const precoCusto = Number(dados.precoCusto) || 0;
  return { ...dados, precoCusto, lucroTipo, lucroValor, preco: calcularPreco(precoCusto, lucroTipo, lucroValor) };
}

// Valida temDevolucao/diasParaDevolucaoPadrao dado o tipo EFETIVO do produto
// (do body em criar; do body ou do banco em atualizar, se o tipo nao mudou
// nesta mesma requisicao). Funcao pura — testavel sem I/O. SERVICO nao tem
// parametrizacao de devolucao (nao faz sentido "devolver" um corte de cabelo).
function validarCamposDevolucao({ tipoEfetivo, temDevolucao, diasParaDevolucaoPadrao }) {
  const data = {};
  if (temDevolucao !== undefined) {
    if (typeof temDevolucao !== 'boolean') return { erro: 'temDevolucao deve ser true ou false.', campo: 'temDevolucao' };
    if (temDevolucao && tipoEfetivo === 'SERVICO') {
      return { erro: 'Servico nao tem parametrizacao de devolucao.', campo: 'temDevolucao' };
    }
    data.temDevolucao = temDevolucao;
  }
  if (diasParaDevolucaoPadrao !== undefined) {
    if (diasParaDevolucaoPadrao === null || diasParaDevolucaoPadrao === '') {
      data.diasParaDevolucaoPadrao = null;
    } else {
      const n = parseInt(diasParaDevolucaoPadrao, 10);
      if (!Number.isInteger(n) || n <= 0) {
        return { erro: 'diasParaDevolucaoPadrao deve ser um inteiro maior que zero.', campo: 'diasParaDevolucaoPadrao' };
      }
      data.diasParaDevolucaoPadrao = n;
    }
  }
  return { data };
}

// Include padrao dos especialistas vinculados (M:N via EspecialistaServico).
const INCLUDE_ESPECIALISTAS = {
  especialistas: { select: { especialista: { select: { id: true, nome: true, ativo: true } } } },
};

// Achata o produto pra UI: especialistas como [{ id, nome, ativo }].
function formatarProduto(p) {
  if (!p) return p;
  return {
    ...p,
    especialistas: Array.isArray(p.especialistas)
      ? p.especialistas.map((es) => es.especialista).filter(Boolean)
      : [],
  };
}

class CatalogoController {
  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { buscar, categoriaId, tipo, visibilidade } = req.query;

      const onde = {
        clienteId,
        nome: buscar ? { contains: buscar, mode: 'insensitive' } : undefined,
        categoriaId: categoriaId || undefined,
        tipo: tipo || undefined,
        visibilidade: visibilidade || undefined
      };

      const produtos = await prisma.produto.findMany({
        where: onde,
        include: { variacoes: true, categoria: true, ...INCLUDE_ESPECIALISTAS },
        orderBy: { nome: 'asc' }
      });
      res.json(produtos.map(formatarProduto));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar catálogo' });
    }
  }

  async criar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, descricao, tipo, visibilidade, variacoes, categoriaId, imagemUrl, duracaoMin, especialistasIds, temDevolucao, diasParaDevolucaoPadrao } = req.body;

      const { data: dadosDevolucao, erro: erroDevolucao, campo: campoDevolucao } = validarCamposDevolucao({
        tipoEfetivo: tipo, temDevolucao, diasParaDevolucaoPadrao,
      });
      if (erroDevolucao) return res.status(422).json({ error: erroDevolucao, campos: [campoDevolucao] });

      // Validação de Categoria Financeira (obrigatória conforme regra de negócio)
      if (!categoriaId) {
        return res.status(422).json({ error: 'categoriaId é obrigatório.', campos: ['categoriaId'] });
      }

      const categoriaExiste = await prisma.categoriaFinanceira.findFirst({
        where: { id: categoriaId, clienteId }
      });

      if (!categoriaExiste) {
        return res.status(400).json({ error: 'Categoria financeira não encontrada ou não pertence ao cliente.' });
      }

      // Serviço só existe ligado a quem o executa: exige ao menos 1 especialista
      // (a agenda usa esse vínculo pra reservar o horário do profissional).
      const especialistasValidos = await validarEspecialistas(clienteId, especialistasIds);
      if (tipo === 'SERVICO' && especialistasValidos.length === 0) {
        return res.status(422).json({ error: 'Selecione ao menos um especialista que atende este serviço.', campos: ['especialistasIds'] });
      }

      // Imagens: validamos o produto e CADA variacao individualmente. Nao deixa
      // tenant vazar URL de imagem de outro cliente.
      const motivoProduto = validarImagemUrlDoTenant(imagemUrl, clienteId);
      if (motivoProduto) return res.status(422).json({ error: motivoProduto, campos: ['imagemUrl'] });

      const variacoesNormalizadas = Array.isArray(variacoes) ? variacoes : [];
      for (let i = 0; i < variacoesNormalizadas.length; i++) {
        const motivoVar = validarImagemUrlDoTenant(variacoesNormalizadas[i]?.imagemUrl, clienteId);
        if (motivoVar) {
          return res.status(422).json({ error: `Variacao ${i + 1}: ${motivoVar}`, campos: [`variacoes[${i}].imagemUrl`] });
        }
      }

      // duracaoMin no nivel do produto e atalho do Catalogo: cria uma variacao
      // "Padrao" inicial com esse valor (so faz sentido pra SERVICO). Se ja
      // veio variacoes explicitas no body, ignora pra nao duplicar.
      const duracaoNum = duracaoMin != null && duracaoMin !== '' ? parseInt(duracaoMin, 10) || null : null;
      if (duracaoNum && tipo === 'SERVICO' && variacoesNormalizadas.length === 0) {
        variacoesNormalizadas.push({ nome: 'Padrao', preco: 0, duracaoMin: duracaoNum });
      }

      const produto = await prisma.produto.create({
        data: {
          clienteId,
          categoriaId,
          nome,
          descricao,
          tipo,
          visibilidade,
          imagemUrl: imagemUrl || null,
          ...dadosDevolucao,
          variacoes: variacoesNormalizadas.length > 0 ? {
            create: variacoesNormalizadas.map(normalizarPrecoVariacao)
          } : undefined,
          especialistas: especialistasValidos.length > 0 ? {
            create: especialistasValidos.map((especialistaId) => ({ especialistaId }))
          } : undefined
        },
        include: { variacoes: true, ...INCLUDE_ESPECIALISTAS }
      });

      res.status(201).json(formatarProduto(produto));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar produto' });
    }
  }

  async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const produto = await prisma.produto.findFirst({
        where: { id, clienteId },
        include: { variacoes: true, ...INCLUDE_ESPECIALISTAS }
      });

      if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
      res.json(formatarProduto(produto));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar produto' });
    }
  }

  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, descricao, tipo, visibilidade, categoriaId, imagemUrl, duracaoMin, especialistasIds, temDevolucao, diasParaDevolucaoPadrao } = req.body;

      const dadosUpdate = {};
      if (nome !== undefined) dadosUpdate.nome = nome;
      if (descricao !== undefined) dadosUpdate.descricao = descricao;
      if (tipo !== undefined) dadosUpdate.tipo = tipo;
      if (visibilidade !== undefined) dadosUpdate.visibilidade = visibilidade;
      if (categoriaId !== undefined) dadosUpdate.categoriaId = categoriaId;
      if (imagemUrl !== undefined) dadosUpdate.imagemUrl = imagemUrl;

      // tipoEfetivo: o que vem no body agora, ou (se o body nao mexe no tipo
      // e a requisicao mexe em temDevolucao) o tipo atual no banco.
      let tipoEfetivo = tipo;
      if (tipoEfetivo === undefined && temDevolucao !== undefined) {
        const atual = await prisma.produto.findFirst({ where: { id, clienteId }, select: { tipo: true } });
        tipoEfetivo = atual?.tipo;
      }
      const { data: dadosDevolucao, erro: erroDevolucao, campo: campoDevolucao } = validarCamposDevolucao({
        tipoEfetivo, temDevolucao, diasParaDevolucaoPadrao,
      });
      if (erroDevolucao) return res.status(422).json({ error: erroDevolucao, campos: [campoDevolucao] });
      Object.assign(dadosUpdate, dadosDevolucao);

      const produto = await prisma.produto.update({
        where: { id, clienteId },
        data: dadosUpdate,
        include: { variacoes: { orderBy: { criadoEm: 'asc' } } },
      });

      // duracaoMin: propaga pra 1a variacao se for SERVICO. Se nao tem
      // variacao ainda, cria 'Padrao'. Se tem, atualiza o duracaoMin da 1a.
      if (duracaoMin !== undefined && produto.tipo === 'SERVICO') {
        const duracaoNum = duracaoMin === '' || duracaoMin === null ? null : (parseInt(duracaoMin, 10) || null);
        if (produto.variacoes.length === 0) {
          await prisma.variacaoProduto.create({
            data: { produtoId: produto.id, nome: 'Padrao', preco: 0, duracaoMin: duracaoNum },
          });
        } else {
          await prisma.variacaoProduto.update({
            where: { id: produto.variacoes[0].id },
            data: { duracaoMin: duracaoNum },
          });
        }
      }

      // Especialistas do serviço: se a lista veio, substitui o conjunto inteiro.
      if (especialistasIds !== undefined) {
        const validos = await validarEspecialistas(clienteId, especialistasIds);
        if (produto.tipo === 'SERVICO' && validos.length === 0) {
          return res.status(422).json({ error: 'Selecione ao menos um especialista que atende este serviço.', campos: ['especialistasIds'] });
        }
        await prisma.$transaction([
          prisma.especialistaServico.deleteMany({ where: { produtoId: id } }),
          ...(validos.length
            ? [prisma.especialistaServico.createMany({ data: validos.map((eid) => ({ especialistaId: eid, produtoId: id })) })]
            : []),
        ]);
      }

      // Retorna produto com variacoes atualizadas pra UI pegar o novo duracaoMin.
      const produtoAtualizado = await prisma.produto.findUnique({
        where: { id },
        include: { variacoes: { orderBy: { criadoEm: 'asc' } }, ...INCLUDE_ESPECIALISTAS },
      });
      res.json(formatarProduto(produtoAtualizado));
    } catch (error) {
      console.error('[catalogo/atualizar]', error);
      res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
  }

  async excluir(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const movimentacoes = await prisma.movimentacaoEstoque.count({
        where: {
          variacao: { produtoId: id, produto: { clienteId } }
        }
      });

      if (movimentacoes > 0) {
        return res.status(422).json({
          error: 'Não é possível excluir um produto que possui movimentações de estoque registradas.'
        });
      }

      await prisma.produto.delete({
        where: { id, clienteId }
      });

      res.json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir produto' });
    }
  }

  // CRUD de Variações Individual
  async criarVariacao(req, res) {
    try {
      const { produtoId } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const dados = req.body;

      const produto = await prisma.produto.findFirst({ where: { id: produtoId, clienteId } });
      if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

      // Valida imagemUrl da variacao (se vier preenchida) — mesma trava de tenant.
      const motivo = validarImagemUrlDoTenant(dados?.imagemUrl, clienteId);
      if (motivo) return res.status(422).json({ error: motivo, campos: ['imagemUrl'] });

      const variacao = await prisma.variacaoProduto.create({
        data: { ...normalizarPrecoVariacao(dados), produtoId }
      });
      res.status(201).json(variacao);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar variação' });
    }
  }

  async editarVariacao(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const dados = req.body;

      const variacao = await prisma.variacaoProduto.findFirst({
        where: { id, produto: { clienteId } }
      });
      if (!variacao) return res.status(404).json({ error: 'Variação não encontrada' });

      const atualizada = await prisma.variacaoProduto.update({
        where: { id },
        data: normalizarPrecoVariacao(dados)
      });
      res.json(atualizada);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao editar variação' });
    }
  }

  async excluirVariacao(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const movimentacoes = await prisma.movimentacaoEstoque.count({
        where: { variacaoId: id, variacao: { produto: { clienteId } } }
      });

      if (movimentacoes > 0) {
        return res.status(422).json({ error: 'Variação possui movimentações e não pode ser excluída.' });
      }

      await prisma.variacaoProduto.delete({ where: { id } });
      res.json({ message: 'Variação excluída' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir variação' });
    }
  }
}

const instancia = new CatalogoController();
// Exposta a parte pra teste unitario da regra pura (sem I/O).
instancia.validarCamposDevolucao = validarCamposDevolucao;
module.exports = instancia;
