// Rotas ADMIN pra gerenciar as INTEGRAÇÕES (credenciais) de um cliente.
// Montado em /admin/clientes -> paths: /admin/clientes/:clienteId/credenciais.
//
// SEGURANÇA (processo crítico — pronto pra produção):
//  - Só ADMIN do sistema: middlewareAutenticacao + requerAdmin.
//  - O `clienteId` vem na URL (não é segredo). O SEGREDO vai só no CORPO do
//    POST/PUT — nunca na URL/query (que iria pra log de acesso).
//  - O backend CIFRA (AES-GCM derivada por tenant) antes de gravar; o valor em
//    claro NUNCA é retornado (semSegredos) nem logado.
//  - Whitelist de tipo + validação de tamanho de campo (anti-abuso/injeção de
//    payload). Prisma = queries parametrizadas (sem SQL injection).
//  - Isolamento: TODA operação é escopada ao `clienteId` do cliente-alvo — o
//    admin nunca mistura credencial de um cliente com a de outro.
//  - Interceptação: exige HTTPS/TLS na frente (ngrok em dev, reverse proxy TLS
//    em prod) — o segredo nunca trafega em claro.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { requerAdmin } = require('../middlewares/permissoes.middleware');
const { cifrarPayload, normalizarPayload } = require('../cripto/cofreCredenciais');
const {
  TIPOS_VALIDOS,
  TAM_MAX_NOME,
  TAM_MAX_DESCRICAO,
  validarPayload,
  semSegredos,
} = require('../credenciaisCore');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerAdmin);

// Confere que o cliente-alvo existe; injeta req.clienteAlvo. 404 se não existir.
async function carregarClienteAlvo(req, res, next) {
  try {
    const { clienteId } = req.params;
    if (typeof clienteId !== 'string' || !clienteId) {
      return res.status(400).json({ erro: 'clienteId invalido.' });
    }
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nome: true },
    });
    if (!cliente) return res.status(404).json({ erro: 'Cliente nao encontrado.' });
    req.clienteAlvo = cliente;
    return next();
  } catch (erro) {
    console.error('[admin/credenciais/carregarCliente]', erro);
    return res.status(500).json({ erro: 'Erro ao validar cliente.' });
  }
}

// LISTAR — metadata (sem segredo) das credenciais daquele cliente.
roteador.get('/:clienteId/credenciais', carregarClienteAlvo, async (req, res) => {
  try {
    const itens = await prisma.credencial.findMany({
      where: { clienteId: req.clienteAlvo.id },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(itens.map(semSegredos));
  } catch (erro) {
    console.error('[admin/credenciais/listar]', erro);
    res.status(500).json({ erro: 'Erro ao listar credenciais.' });
  }
});

// CRIAR — cifra e grava sob o clienteId do cliente-alvo.
roteador.post('/:clienteId/credenciais', carregarClienteAlvo, async (req, res) => {
  try {
    const clienteId = req.clienteAlvo.id;
    const { nome, tipo, descricao, dados } = req.body || {};

    if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > TAM_MAX_NOME) {
      return res.status(400).json({ erro: `Nome obrigatorio (2-${TAM_MAX_NOME} chars).` });
    }
    if (tipo === 'DEEPSEEK_KEY') {
      return res.status(400).json({ erro: 'DEEPSEEK_KEY e credencial de plataforma — use /admin/plataforma/credencial-ia.' });
    }
    if (!TIPOS_VALIDOS.has(tipo)) {
      return res.status(400).json({ erro: `Tipo invalido. Valores: ${[...TIPOS_VALIDOS].join(', ')}.` });
    }
    if (typeof descricao === 'string' && descricao.length > TAM_MAX_DESCRICAO) {
      return res.status(400).json({ erro: `Descricao excede ${TAM_MAX_DESCRICAO} caracteres.` });
    }

    const payload = normalizarPayload(dados);
    const valid = validarPayload(tipo, payload);
    if (valid.erro) return res.status(400).json({ erro: valid.erro });

    const cifrado = cifrarPayload(clienteId, payload);
    const credencial = await prisma.credencial.create({
      data: {
        clienteId,
        nome: nome.trim(),
        tipo,
        descricao: typeof descricao === 'string' ? descricao.trim() || null : null,
        dadosCifrados: cifrado.conteudoCifrado,
        iv: cifrado.iv,
        tag: cifrado.tag,
        versaoChave: cifrado.versaoChave,
        criadoPorId: req.usuario.id || null, // auditoria: qual admin criou
      },
    });
    res.status(201).json(semSegredos(credencial));
  } catch (erro) {
    console.error('[admin/credenciais/criar]', erro);
    res.status(500).json({ erro: 'Erro ao criar credencial.' });
  }
});

// ATUALIZAR — nome/descricao ou substituição dos dados (re-cifra).
roteador.put('/:clienteId/credenciais/:id', carregarClienteAlvo, async (req, res) => {
  try {
    const clienteId = req.clienteAlvo.id;
    // Isolamento: a credencial precisa ser DAQUELE cliente.
    const credencial = await prisma.credencial.findFirst({ where: { id: req.params.id, clienteId } });
    if (!credencial) return res.status(404).json({ erro: 'Credencial nao encontrada.' });

    const { nome, descricao, dados } = req.body || {};
    const data = {};

    if (nome !== undefined) {
      if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > TAM_MAX_NOME) {
        return res.status(400).json({ erro: `Nome invalido (2-${TAM_MAX_NOME} chars).` });
      }
      data.nome = nome.trim();
    }
    if (descricao !== undefined) {
      if (descricao !== null && typeof descricao !== 'string') {
        return res.status(400).json({ erro: 'Descricao deve ser texto ou null.' });
      }
      if (typeof descricao === 'string' && descricao.length > TAM_MAX_DESCRICAO) {
        return res.status(400).json({ erro: `Descricao excede ${TAM_MAX_DESCRICAO} caracteres.` });
      }
      data.descricao = descricao ? descricao.trim() : null;
    }
    if (dados !== undefined) {
      const payload = normalizarPayload(dados);
      const valid = validarPayload(credencial.tipo, payload);
      if (valid.erro) return res.status(400).json({ erro: valid.erro });
      const cifrado = cifrarPayload(clienteId, payload);
      data.dadosCifrados = cifrado.conteudoCifrado;
      data.iv = cifrado.iv;
      data.tag = cifrado.tag;
      data.versaoChave = cifrado.versaoChave;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
    }

    const atualizada = await prisma.credencial.update({ where: { id: credencial.id }, data });
    res.json(semSegredos(atualizada));
  } catch (erro) {
    console.error('[admin/credenciais/atualizar]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar credencial.' });
  }
});

// EXCLUIR — escopado ao cliente-alvo.
roteador.delete('/:clienteId/credenciais/:id', carregarClienteAlvo, async (req, res) => {
  try {
    const r = await prisma.credencial.deleteMany({
      where: { id: req.params.id, clienteId: req.clienteAlvo.id },
    });
    if (r.count === 0) return res.status(404).json({ erro: 'Credencial nao encontrada.' });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[admin/credenciais/excluir]', erro);
    res.status(500).json({ erro: 'Erro ao excluir credencial.' });
  }
});

module.exports = roteador;
