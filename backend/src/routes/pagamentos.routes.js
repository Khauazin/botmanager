// Pagamentos (PSP) — Frente 2. Fiacao sobre a camada de adapters
// (adapters/pagamento): config do provedor por tenant + ciclo de vida da
// Cobranca (criar Pix/link, listar, sincronizar status). A confirmacao
// automatica chega pelo webhook (webhooks.routes.js -> cobrancaPagamento).
//
// Gating: modulo PAGAMENTOS + papel privilegiado (dono/admin). Dinheiro e
// sensivel — fora da matriz de colaborador por enquanto (ver permissoes).
// Ref: docs/erp-arquitetura-e-operacao.md §4. Models: Cobranca / ConfiguracaoPagamento.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPapelPrivilegiado,
} = require('../middlewares/permissoes.middleware');
const {
  PROVEDORES,
  TIPO_CREDENCIAL_POR_PROVEDOR,
} = require('../adapters/pagamento');
const { aplicarStatusCobranca, CAMPOS_COBRANCA } = require('../services/cobrancaPagamento');
const { provedorDoTenant, criarCobranca } = require('../services/pagamentoService');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('PAGAMENTOS'));
roteador.use(requerPapelPrivilegiado);

const METODOS = ['PIX', 'LINK'];
const ORIGENS = ['VENDA', 'AGENDAMENTO', 'AVULSA'];

// --- Configuracao do provedor (1 por tenant) ---

// GET /pagamentos/config -> config atual (sem expor a credencial em si).
roteador.get('/config', async (req, res) => {
  try {
    const config = await prisma.configuracaoPagamento.findUnique({
      where: { clienteId: req.usuario.clienteId },
      select: { provedor: true, credencialId: true, ativo: true, atualizadoEm: true },
    });
    res.json(config || null);
  } catch (e) {
    console.error('[pagamentos/config get]', e);
    res.status(500).json({ erro: 'Erro ao carregar configuracao de pagamento.' });
  }
});

// PUT /pagamentos/config -> escolhe provedor + credencial (referencia do cofre).
roteador.put('/config', async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const { provedor, credencialId, ativo } = req.body || {};

    if (!PROVEDORES.includes(provedor)) {
      return res.status(400).json({ erro: `Provedor invalido. Use: ${PROVEDORES.join(', ')}.` });
    }
    // Valida a credencial: existe, e do tenant, e e do tipo certo pro provedor.
    if (credencialId) {
      const cred = await prisma.credencial.findFirst({
        where: { id: credencialId, clienteId },
        select: { tipo: true },
      });
      if (!cred) return res.status(400).json({ erro: 'Credencial nao encontrada para este tenant.' });
      const tipoEsperado = TIPO_CREDENCIAL_POR_PROVEDOR[provedor];
      if (cred.tipo !== tipoEsperado) {
        return res.status(400).json({ erro: `A credencial precisa ser do tipo ${tipoEsperado} para ${provedor}.` });
      }
    }

    const dados = {
      provedor,
      credencialId: credencialId || null,
      ativo: ativo === undefined ? true : ativo === true,
    };
    const config = await prisma.configuracaoPagamento.upsert({
      where: { clienteId },
      create: { clienteId, ...dados },
      update: dados,
      select: { provedor: true, credencialId: true, ativo: true, atualizadoEm: true },
    });
    res.json(config);
  } catch (e) {
    console.error('[pagamentos/config put]', e);
    res.status(500).json({ erro: 'Erro ao salvar configuracao de pagamento.' });
  }
});

// --- Cobrancas ---

// GET /pagamentos/cobrancas?status=PENDENTE
roteador.get('/cobrancas', async (req, res) => {
  try {
    const where = { clienteId: req.usuario.clienteId };
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    const cobrancas = await prisma.cobranca.findMany({
      where, select: CAMPOS_COBRANCA, orderBy: { criadoEm: 'desc' }, take: 100,
    });
    res.json(cobrancas);
  } catch (e) {
    console.error('[pagamentos/cobrancas list]', e);
    res.status(500).json({ erro: 'Erro ao listar cobrancas.' });
  }
});

// POST /pagamentos/cobrancas -> cria Pix ou link via adapter, persiste Cobranca.
roteador.post('/cobrancas', async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const { origem, refId, valor, metodo, descricao, vencimento, pagador } = req.body || {};

    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return res.status(400).json({ erro: 'Valor invalido.' });
    }
    const met = String(metodo || 'PIX').toUpperCase();
    if (!METODOS.includes(met)) {
      return res.status(400).json({ erro: `Metodo invalido. Use: ${METODOS.join(', ')}.` });
    }
    const org = String(origem || 'AVULSA').toUpperCase();
    if (!ORIGENS.includes(org)) {
      return res.status(400).json({ erro: `Origem invalida. Use: ${ORIGENS.join(', ')}.` });
    }

    // Nucleo (cria PENDENTE, chama o PSP, atualiza com o resultado) vive em
    // services/pagamentoService.js — reusado tambem pela ferramenta do bot.
    const resultado = await criarCobranca({
      clienteId, origem: org, refId: refId || null, valor: valorNum, metodo: met, descricao, vencimento, pagador,
    });
    // Filtra de volta pro mesmo contrato de sempre (o service devolve o
    // registro completo + qrCodeBase64; a rota HTTP nunca expos clienteId
    // nem itensPendentes).
    const camposFiltrados = Object.fromEntries(
      Object.entries(resultado).filter(([k]) => k in CAMPOS_COBRANCA || k === 'qrCodeBase64')
    );
    res.status(201).json(camposFiltrados);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error('[pagamentos/cobrancas create]', e);
    res.status(500).json({ erro: 'Erro ao criar cobranca.' });
  }
});

// GET /pagamentos/cobrancas/:id -> detalhe.
roteador.get('/cobrancas/:id', async (req, res) => {
  try {
    const cobranca = await prisma.cobranca.findFirst({
      where: { id: req.params.id, clienteId: req.usuario.clienteId },
      select: CAMPOS_COBRANCA,
    });
    if (!cobranca) return res.status(404).json({ erro: 'Cobranca nao encontrada.' });
    res.json(cobranca);
  } catch (e) {
    console.error('[pagamentos/cobrancas get]', e);
    res.status(500).json({ erro: 'Erro ao carregar cobranca.' });
  }
});

// POST /pagamentos/cobrancas/:id/sincronizar -> consulta o status no PSP e
// aplica (mesma regra idempotente do webhook).
roteador.post('/cobrancas/:id/sincronizar', async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const cobranca = await prisma.cobranca.findFirst({ where: { id: req.params.id, clienteId } });
    if (!cobranca) return res.status(404).json({ erro: 'Cobranca nao encontrada.' });
    if (!cobranca.provedorCobrancaId) {
      return res.status(400).json({ erro: 'Cobranca sem id no provedor — nada a sincronizar.' });
    }
    const { psp } = await provedorDoTenant(clienteId);
    const { status, pagoEm } = await psp.consultarStatus(cobranca.provedorCobrancaId);
    const atualizada = await aplicarStatusCobranca(cobranca, status, pagoEm);
    res.json(atualizada);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error('[pagamentos/cobrancas sync]', e);
    res.status(500).json({ erro: 'Erro ao sincronizar cobranca.' });
  }
});

module.exports = roteador;
