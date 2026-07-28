// Rota ADMIN pra gerenciar a UNICA credencial de IA da plataforma (a chave da
// DeepSeek, da Sellergy — nao do tenant). Montada em /admin/plataforma.
//
// Diferenca da rota de credenciais por-cliente (admin-credenciais.routes.js):
// aqui nao existe :clienteId — a credencial nao pertence a nenhum tenant, e
// so pode existir UMA linha desse tipo (ver credenciais.js). Por isso rota
// propria em vez de reaproveitar aquela.
//
// SEGURANCA (mesmo padrao da rota por-cliente):
//  - So ADMIN do sistema: middlewareAutenticacao + requerAdmin.
//  - O SEGREDO vai so no corpo do PUT — nunca retorna pela API (semSegredos).
//  - Cifrada com AES-GCM, contexto de derivacao proprio de plataforma (nao
//    reaproveita a derivacao por-tenant) — ver credenciais.js.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { requerAdmin } = require('../middlewares/permissoes.middleware');
const { salvarCredencialPlataforma } = require('../credenciais');
const {
  TAM_MAX_NOME,
  validarPayload,
  semSegredos,
} = require('../credenciaisCore');

const TIPO = 'DEEPSEEK_KEY';

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerAdmin);

// GET — metadata da credencial de IA da plataforma (sem o segredo). Devolve
// null se ainda nao foi configurada (o front trata como "IA nao disponivel").
roteador.get('/credencial-ia', async (req, res) => {
  try {
    const credencial = await prisma.credencial.findFirst({ where: { clienteId: null, tipo: TIPO } });
    res.json(credencial ? semSegredos(credencial) : null);
  } catch (erro) {
    console.error('[admin/plataforma/credencial-ia/get]', erro);
    res.status(500).json({ erro: 'Erro ao buscar credencial de IA.' });
  }
});

// PUT — cria ou substitui a chave. Body: { nome?, apiKey }.
roteador.put('/credencial-ia', async (req, res) => {
  try {
    const { nome, apiKey } = req.body || {};
    const nomeFinal = typeof nome === 'string' && nome.trim() ? nome.trim() : 'DeepSeek (plataforma)';
    if (nomeFinal.length > TAM_MAX_NOME) {
      return res.status(400).json({ erro: `Nome excede ${TAM_MAX_NOME} caracteres.` });
    }

    const valid = validarPayload(TIPO, { apiKey });
    if (valid.erro) return res.status(400).json({ erro: valid.erro });

    const credencial = await salvarCredencialPlataforma({
      tipo: TIPO,
      nome: nomeFinal,
      payload: { apiKey: String(apiKey).trim() },
      criadoPorId: req.usuario.id || null,
    });
    res.json(semSegredos(credencial));
  } catch (erro) {
    console.error('[admin/plataforma/credencial-ia/put]', erro);
    res.status(500).json({ erro: 'Erro ao salvar credencial de IA.' });
  }
});

// DELETE — remove a chave (desliga o atendimento com IA pra toda a plataforma
// ate uma nova ser cadastrada). Bots com iaAtiva continuam ativos no cadastro,
// mas a chamada a DeepSeek falha e cai no aviso de erro tratado pelo iaRouter.
roteador.delete('/credencial-ia', async (req, res) => {
  try {
    await prisma.credencial.deleteMany({ where: { clienteId: null, tipo: TIPO } });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[admin/plataforma/credencial-ia/delete]', erro);
    res.status(500).json({ erro: 'Erro ao remover credencial de IA.' });
  }
});

module.exports = roteador;
