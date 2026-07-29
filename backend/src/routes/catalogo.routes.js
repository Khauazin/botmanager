const express = require('express');
const prisma = require('../prisma');
const CatalogoController = require('../controllers/CatalogoController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { aceitarUmaImagem, extensaoDeMime } = require('../middlewares/upload.middleware');
const { upload, remover, chaveDeUrl } = require('../storage/minio');
const { resolverPrecoVenda, fontePrecoVenda } = require('../produto');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('CATALOGO'));

roteador.get('/', requerPermissao('CATALOGO', 'visualizar'), CatalogoController.listar);
roteador.post('/', requerPermissao('CATALOGO', 'criar'), CatalogoController.criar);

// ==========================================
// CONFIGURACAO DE LAYOUT DO CATALOGO (PDF) — 1 registro por tenant.
// Registrado ANTES de '/:id' de proposito: '/:id' e um parametro generico e
// casaria com "config" primeiro se viesse depois (ver mesmo cuidado em
// bots.routes.js com /relatorio-consumo-ia).
// ==========================================
const TEMPLATES_CATALOGO_VALIDOS = new Set(['FOTOS_GRANDES', 'LISTA_COMPACTA', 'MINIMALISTA']);
const AGRUPAMENTOS_CATALOGO_VALIDOS = new Set(['CATEGORIA', 'NENHUM']);
const REGEX_COR_HEX = /^#[0-9a-fA-F]{6}$/;

roteador.get('/config', requerPermissao('CATALOGO', 'visualizar'), async (req, res) => {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ erro: 'Tenant indefinido.' });
    const config = await prisma.configuracaoCatalogo.findUnique({ where: { clienteId } });
    res.json(config || null);
  } catch (erro) {
    console.error('[catalogo/config/get]', erro);
    res.status(500).json({ erro: 'Erro ao buscar configuracao do catalogo.' });
  }
});

roteador.put('/config', requerPermissao('CATALOGO', 'editar'), async (req, res) => {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ erro: 'Tenant indefinido.' });

    const { template, corDestaque, agruparPor, mostrarPreco, mostrarFoto, mostrarDescricao, ocultarSemEstoque } = req.body || {};
    const data = {};

    if (template !== undefined) {
      if (!TEMPLATES_CATALOGO_VALIDOS.has(template)) {
        return res.status(400).json({ erro: `template invalido. Valores: ${[...TEMPLATES_CATALOGO_VALIDOS].join(', ')}.` });
      }
      data.template = template;
    }
    if (corDestaque !== undefined) {
      if (typeof corDestaque !== 'string' || !REGEX_COR_HEX.test(corDestaque)) {
        return res.status(400).json({ erro: 'corDestaque deve ser um hex valido (ex: #2563EB).' });
      }
      data.corDestaque = corDestaque;
    }
    if (agruparPor !== undefined) {
      if (!AGRUPAMENTOS_CATALOGO_VALIDOS.has(agruparPor)) {
        return res.status(400).json({ erro: `agruparPor invalido. Valores: ${[...AGRUPAMENTOS_CATALOGO_VALIDOS].join(', ')}.` });
      }
      data.agruparPor = agruparPor;
    }
    if (mostrarPreco !== undefined) {
      if (typeof mostrarPreco !== 'boolean') return res.status(400).json({ erro: 'mostrarPreco deve ser true ou false.' });
      data.mostrarPreco = mostrarPreco;
    }
    if (mostrarFoto !== undefined) {
      if (typeof mostrarFoto !== 'boolean') return res.status(400).json({ erro: 'mostrarFoto deve ser true ou false.' });
      data.mostrarFoto = mostrarFoto;
    }
    if (mostrarDescricao !== undefined) {
      if (typeof mostrarDescricao !== 'boolean') return res.status(400).json({ erro: 'mostrarDescricao deve ser true ou false.' });
      data.mostrarDescricao = mostrarDescricao;
    }
    if (ocultarSemEstoque !== undefined) {
      if (typeof ocultarSemEstoque !== 'boolean') return res.status(400).json({ erro: 'ocultarSemEstoque deve ser true ou false.' });
      data.ocultarSemEstoque = ocultarSemEstoque;
    }

    const config = await prisma.configuracaoCatalogo.upsert({
      where: { clienteId },
      create: { clienteId, ...data },
      update: data,
    });
    res.json(config);
  } catch (erro) {
    console.error('[catalogo/config/put]', erro);
    res.status(500).json({ erro: 'Erro ao salvar configuracao do catalogo.' });
  }
});

roteador.get('/:id', requerPermissao('CATALOGO', 'visualizar'), CatalogoController.buscarPorId);
roteador.put('/:id', requerPermissao('CATALOGO', 'editar'), CatalogoController.atualizar);
roteador.delete('/:id', requerPermissao('CATALOGO', 'excluir'), CatalogoController.excluir);

// Variacoes
roteador.post('/:produtoId/variacoes', requerPermissao('CATALOGO', 'criar'), (req, res) => CatalogoController.criarVariacao(req, res));
roteador.put('/variacoes/:id', requerPermissao('CATALOGO', 'editar'), (req, res) => CatalogoController.editarVariacao(req, res));
roteador.delete('/variacoes/:id', requerPermissao('CATALOGO', 'excluir'), (req, res) => CatalogoController.excluirVariacao(req, res));

// ==========================================
// Helpers multi-tenant
// ==========================================
async function produtoDoTenant(produtoId, usuario) {
  if (typeof produtoId !== 'string' || !produtoId) return null;
  const where = ehAdmin(usuario) ? { id: produtoId } : { id: produtoId, clienteId: usuario.clienteId };
  return prisma.produto.findFirst({ where });
}

/**
 * Valida que uma URL de imagem pertence ao tenant (impede passar URL de outro
 * cliente no body de criacao). A key extraida deve comecar com `produtos/<clienteId>/`.
 *
 * Retorna `null` se valido, ou string com motivo de rejeicao.
 */
function validarImagemUrlDoTenant(imagemUrl, clienteId) {
  if (imagemUrl === null || imagemUrl === undefined || imagemUrl === '') return null;
  if (typeof imagemUrl !== 'string') return 'imagemUrl invalida.';
  const key = chaveDeUrl(imagemUrl);
  if (!key) return 'URL nao reconhecida pelo storage.';
  const prefixo = `produtos/${clienteId}/`;
  if (!key.startsWith(prefixo)) return 'imagemUrl nao pertence a este tenant.';
  return null;
}

async function variacaoDoTenant(variacaoId, usuario) {
  if (typeof variacaoId !== 'string' || !variacaoId) return null;
  const where = ehAdmin(usuario)
    ? { id: variacaoId }
    : { id: variacaoId, produto: { clienteId: usuario.clienteId } };
  return prisma.variacaoProduto.findFirst({ where, include: { produto: true } });
}

// ==========================================
// Preco resolvido (regra catalogo vs estoque)
// ==========================================
roteador.get('/variacoes/:id/preco', requerPermissao('CATALOGO', 'visualizar'), async (req, res) => {
  try {
    const variacao = await variacaoDoTenant(req.params.id, req.usuario);
    if (!variacao) return res.status(404).json({ erro: 'Variacao nao encontrada.' });
    res.json({
      preco: resolverPrecoVenda(variacao),
      fonte: fontePrecoVenda(variacao),
      precoEstoque: variacao.preco,
    });
  } catch (erro) {
    console.error('[catalogo/preco]', erro);
    res.status(500).json({ erro: 'Erro ao resolver preco.' });
  }
});

// ==========================================
// Upload TEMPORARIO (usado no modal de criacao de produto/variacao,
// quando ainda nao existe ID). A URL retornada pode ser passada no body
// de POST /catalogo (ou /:produtoId/variacoes) como imagemUrl.
// Key: produtos/<clienteId>/temp/<uuid>-<timestamp>.<ext>
// Imagens orfas (subiu e nao virou produto) podem ser limpas via
// cron futuro ou pelo proprio cliente via DELETE /imagens-temp.
// ==========================================
const crypto = require('crypto');

roteador.post(
  '/imagens-temp',
  requerPermissao('CATALOGO', 'criar'),
  aceitarUmaImagem('imagem'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ erro: 'Arquivo "imagem" obrigatorio.' });
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ erro: 'Tenant indefinido.' });

      const ext = extensaoDeMime(req.file.mimetype);
      const id = crypto.randomBytes(8).toString('hex');
      const key = `produtos/${clienteId}/temp/${id}-${Date.now()}.${ext}`;
      const url = await upload({ key, body: req.file.buffer, contentType: req.file.mimetype });
      res.status(201).json({ imagemUrl: url });
    } catch (erro) {
      console.error('[catalogo/imagens-temp]', erro);
      res.status(500).json({ erro: 'Erro ao subir imagem temporaria.' });
    }
  }
);

// Cleanup explicito quando o usuario cancela o modal sem criar o produto.
// Best-effort: aceita falhas do storage silenciosamente.
roteador.delete('/imagens-temp', requerPermissao('CATALOGO', 'criar'), async (req, res) => {
  try {
    const { url } = req.query;
    const { clienteId } = req.usuario;
    const motivo = validarImagemUrlDoTenant(url, clienteId);
    if (motivo) return res.status(400).json({ erro: motivo });
    const k = chaveDeUrl(url);
    if (k && k.startsWith(`produtos/${clienteId}/temp/`)) {
      await remover(k).catch(() => {});
    }
    res.json({ ok: true });
  } catch (erro) {
    console.error('[catalogo/imagens-temp/delete]', erro);
    res.json({ ok: true }); // sempre 200 — best-effort
  }
});

// ==========================================
// Upload de imagem do PRODUTO
// ==========================================
roteador.post(
  '/:produtoId/imagem',
  requerPermissao('CATALOGO', 'editar'),
  aceitarUmaImagem('imagem'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ erro: 'Arquivo "imagem" obrigatorio.' });

      const produto = await produtoDoTenant(req.params.produtoId, req.usuario);
      if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });

      const ext = extensaoDeMime(req.file.mimetype);
      const key = `produtos/${produto.clienteId}/${produto.id}-${Date.now()}.${ext}`;
      const url = await upload({ key, body: req.file.buffer, contentType: req.file.mimetype });

      // Best-effort: remove imagem antiga (se existir)
      if (produto.imagemUrl) {
        const antiga = chaveDeUrl(produto.imagemUrl);
        if (antiga) remover(antiga).catch((e) => console.error('[catalogo/imagem/remover-antiga]', e));
      }

      const atualizado = await prisma.produto.update({
        where: { id: produto.id },
        data: { imagemUrl: url },
      });
      res.json({ imagemUrl: atualizado.imagemUrl });
    } catch (erro) {
      console.error('[catalogo/upload-produto]', erro);
      res.status(500).json({ erro: 'Erro ao enviar imagem.' });
    }
  }
);

roteador.delete('/:produtoId/imagem', requerPermissao('CATALOGO', 'editar'), async (req, res) => {
  try {
    const produto = await produtoDoTenant(req.params.produtoId, req.usuario);
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });
    if (produto.imagemUrl) {
      const k = chaveDeUrl(produto.imagemUrl);
      if (k) remover(k).catch((e) => console.error('[catalogo/imagem/remover]', e));
    }
    await prisma.produto.update({ where: { id: produto.id }, data: { imagemUrl: null } });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[catalogo/remover-imagem-produto]', erro);
    res.status(500).json({ erro: 'Erro ao remover imagem.' });
  }
});

// ==========================================
// Upload de imagem da VARIACAO
// ==========================================
roteador.post(
  '/variacoes/:id/imagem',
  requerPermissao('CATALOGO', 'editar'),
  aceitarUmaImagem('imagem'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ erro: 'Arquivo "imagem" obrigatorio.' });

      const variacao = await variacaoDoTenant(req.params.id, req.usuario);
      if (!variacao) return res.status(404).json({ erro: 'Variacao nao encontrada.' });

      const ext = extensaoDeMime(req.file.mimetype);
      const key = `produtos/${variacao.produto.clienteId}/variacoes/${variacao.id}-${Date.now()}.${ext}`;
      const url = await upload({ key, body: req.file.buffer, contentType: req.file.mimetype });

      if (variacao.imagemUrl) {
        const antiga = chaveDeUrl(variacao.imagemUrl);
        if (antiga) remover(antiga).catch((e) => console.error('[catalogo/imagem-variacao/remover-antiga]', e));
      }

      const atualizada = await prisma.variacaoProduto.update({
        where: { id: variacao.id },
        data: { imagemUrl: url },
      });
      res.json({ imagemUrl: atualizada.imagemUrl });
    } catch (erro) {
      console.error('[catalogo/upload-variacao]', erro);
      res.status(500).json({ erro: 'Erro ao enviar imagem.' });
    }
  }
);

roteador.delete('/variacoes/:id/imagem', requerPermissao('CATALOGO', 'editar'), async (req, res) => {
  try {
    const variacao = await variacaoDoTenant(req.params.id, req.usuario);
    if (!variacao) return res.status(404).json({ erro: 'Variacao nao encontrada.' });
    if (variacao.imagemUrl) {
      const k = chaveDeUrl(variacao.imagemUrl);
      if (k) remover(k).catch((e) => console.error('[catalogo/imagem-variacao/remover]', e));
    }
    await prisma.variacaoProduto.update({ where: { id: variacao.id }, data: { imagemUrl: null } });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[catalogo/remover-imagem-variacao]', erro);
    res.status(500).json({ erro: 'Erro ao remover imagem.' });
  }
});

module.exports = roteador;
