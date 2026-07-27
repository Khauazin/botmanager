// FAQ simples do atendimento do bot (pares pergunta/resposta). Model Faq (F1).
// Usada pelo roteador de menu fixo (botRouter) no webhook do WhatsApp.
// Gating: modulo BOTS (a FAQ e do atendimento automatizado do bot).

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('BOTS'));

const campos = {
  id: true, pergunta: true, resposta: true, palavrasChave: true, ordem: true, ativo: true,
  criadoEm: true, atualizadoEm: true,
};

const MAX_PALAVRAS_CHAVE = 20;
const TAM_MAX_PALAVRA = 60;

// Normaliza a lista vinda do body: string[] com entradas nao-vazias, sem
// duplicatas, com teto de quantidade e tamanho (anti-abuso).
function normalizarPalavrasChave(valor) {
  if (valor === undefined) return undefined;
  if (!Array.isArray(valor)) return { erro: 'palavrasChave deve ser uma lista de textos.' };
  const limpas = [];
  for (const item of valor) {
    if (typeof item !== 'string') return { erro: 'palavrasChave deve conter apenas texto.' };
    const t = item.trim();
    if (!t) continue;
    if (t.length > TAM_MAX_PALAVRA) return { erro: `Cada palavra-chave deve ter ate ${TAM_MAX_PALAVRA} caracteres.` };
    if (!limpas.includes(t)) limpas.push(t);
  }
  if (limpas.length > MAX_PALAVRAS_CHAVE) return { erro: `No maximo ${MAX_PALAVRAS_CHAVE} palavras-chave por pergunta.` };
  return { valor: limpas };
}

// GET /faq -> lista as FAQs do tenant (ordenadas).
roteador.get('/', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const faqs = await prisma.faq.findMany({
      where: { clienteId: req.usuario.clienteId },
      select: campos,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });
    res.json(faqs);
  } catch (e) {
    console.error('[faq/list]', e);
    res.status(500).json({ erro: 'Erro ao listar FAQ.' });
  }
});

// POST /faq -> cria um par pergunta/resposta.
roteador.post('/', requerPermissao('BOTS', 'criar'), async (req, res) => {
  try {
    const { pergunta, resposta, ordem, ativo, palavrasChave } = req.body || {};
    if (!pergunta || !resposta) {
      return res.status(400).json({ erro: 'pergunta e resposta sao obrigatorias.' });
    }
    const chaves = normalizarPalavrasChave(palavrasChave);
    if (chaves?.erro) return res.status(400).json({ erro: chaves.erro });

    const faq = await prisma.faq.create({
      data: {
        clienteId: req.usuario.clienteId,
        pergunta: String(pergunta).trim(),
        resposta: String(resposta).trim(),
        ordem: Number.isFinite(Number(ordem)) ? Number(ordem) : 0,
        ativo: ativo === undefined ? true : ativo === true,
        palavrasChave: chaves?.valor || [],
      },
      select: campos,
    });
    res.status(201).json(faq);
  } catch (e) {
    console.error('[faq/create]', e);
    res.status(500).json({ erro: 'Erro ao criar FAQ.' });
  }
});

// PUT /faq/:id -> edita.
roteador.put('/:id', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const existente = await prisma.faq.findFirst({
      where: { id: req.params.id, clienteId: req.usuario.clienteId },
      select: { id: true },
    });
    if (!existente) return res.status(404).json({ erro: 'FAQ nao encontrada.' });

    const { pergunta, resposta, ordem, ativo, palavrasChave } = req.body || {};
    const data = {};
    if (pergunta !== undefined) data.pergunta = String(pergunta).trim();
    if (resposta !== undefined) data.resposta = String(resposta).trim();
    if (ordem !== undefined) data.ordem = Number(ordem) || 0;
    if (ativo !== undefined) data.ativo = ativo === true;
    if (palavrasChave !== undefined) {
      const chaves = normalizarPalavrasChave(palavrasChave);
      if (chaves?.erro) return res.status(400).json({ erro: chaves.erro });
      data.palavrasChave = chaves.valor;
    }

    const faq = await prisma.faq.update({ where: { id: existente.id }, data, select: campos });
    res.json(faq);
  } catch (e) {
    console.error('[faq/update]', e);
    res.status(500).json({ erro: 'Erro ao atualizar FAQ.' });
  }
});

// DELETE /faq/:id -> remove.
roteador.delete('/:id', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const existente = await prisma.faq.findFirst({
      where: { id: req.params.id, clienteId: req.usuario.clienteId },
      select: { id: true },
    });
    if (!existente) return res.status(404).json({ erro: 'FAQ nao encontrada.' });
    await prisma.faq.delete({ where: { id: existente.id } });
    res.json({ message: 'FAQ removida.' });
  } catch (e) {
    console.error('[faq/delete]', e);
    res.status(500).json({ erro: 'Erro ao remover FAQ.' });
  }
});

module.exports = roteador;
