// Webhook do WhatsApp Cloud (Meta) — Frente 4. SEM middlewareAutenticacao:
// quem chama e a Meta, nao um usuario logado.
//   GET  /webhooks/whatsapp  -> verificacao do endpoint (ecoa hub.challenge se
//        o verify token casar com algum bot conectado).
//   POST /webhooks/whatsapp  -> mensagens recebidas -> processarMensagemRecebida
//        decide entre IA (DeepSeek, se bot.iaAtiva) e o roteador de menu fixo
//        (botRouter) -> resposta via adapter META_CLOUD (DRY_RUN ate o App
//        Review da Meta). Ref: erp-arquitetura-e-operacao.md §6.
//
// So atende bot.provedorCanal=META_CLOUD — o canal Baileys (WhatsApp Web nao
// oficial) nao tem webhook HTTP, a mensagem chega direto no processo worker.js
// via evento messages.upsert (ver services/baileys/gerenciadorConexao.js), que
// chama a MESMA processarMensagemRecebida (services/whatsappInbound.js).
//
// Arquivo proprio (nao o webhooks.routes.js de pagamento) pra as Frentes 2 e 4
// nao colidirem no mesmo arquivo. Montado em /webhooks no index.js.
//
// SEAM: validacao da assinatura x-hub-signature-256 (app secret da Meta) entra
// junto com o App Review; por ora o gating e o verify token + match do bot.

const express = require('express');
const prisma = require('../prisma');
const { processarMensagemRecebida } = require('../services/whatsappInbound');
const { carregarCredencialDecifrada } = require('../credenciais');
const { criarProvedorWhatsapp } = require('../adapters/whatsapp');

const roteador = express.Router();

// GET — a Meta valida o endpoint ecoando hub.challenge se o verify token bater.
roteador.get('/whatsapp', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode !== 'subscribe' || !token) return res.sendStatus(400);

    const bot = await prisma.bot.findFirst({
      where: { verifyTokenCanal: String(token) },
      select: { id: true },
    });
    if (!bot) return res.sendStatus(403);
    return res.status(200).send(String(challenge ?? ''));
  } catch (e) {
    console.error('[webhook/whatsapp verify]', e);
    return res.sendStatus(500);
  }
});

// POST — recebe eventos. Ack 200 imediato (a Meta re-tenta se demorar), e
// processa em seguida sem bloquear a resposta.
roteador.post('/whatsapp', async (req, res) => {
  res.sendStatus(200);
  try {
    const entradas = req.body?.entry || [];
    for (const entry of entradas) {
      for (const mudanca of entry.changes || []) {
        const value = mudanca.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        const mensagens = value.messages || [];
        if (!phoneNumberId || mensagens.length === 0) continue;

        const bot = await prisma.bot.findFirst({
          where: { identificadorCanal: String(phoneNumberId) },
          select: {
            id: true, clienteId: true, credencialCanalId: true, provedorCanal: true,
            iaAtiva: true, iaModelo: true, iaPromptSistema: true,
            iaTokensIncluidosMes: true, iaPrecoPorMilTokensExcedenteCentavos: true,
          },
        });
        if (!bot) continue;

        // So carrega FAQ se o bot nao estiver no modo IA — economiza uma
        // query que o motor de decisao nem vai usar.
        const faqs = bot.iaAtiva ? [] : await prisma.faq.findMany({
          where: { clienteId: bot.clienteId, ativo: true },
          orderBy: { ordem: 'asc' },
        });

        // Token do canal (decifrado) pra responder — best-effort.
        let token = null;
        if (bot.credencialCanalId) {
          const cred = await carregarCredencialDecifrada({ credencialId: bot.credencialCanalId, clienteId: bot.clienteId }).catch(() => null);
          token = cred?.dados?.token || cred?.dados?.accessToken || null;
        }
        const adapter = criarProvedorWhatsapp('META_CLOUD', {
          credencial: { dados: { accessToken: token } },
          identificadorCanal: phoneNumberId,
          modo: 'live',
        });

        for (const msg of mensagens) {
          const de = msg.from;
          const texto = msg.text?.body || msg.button?.text || msg.interactive?.list_reply?.title || '';
          // canalContexto: so usado por ferramentas que enviam midia direto
          // (ex.: CATALOGO manda o PDF como documento, fora da resposta de texto).
          await processarMensagemRecebida({
            bot, texto, de, faqs, adapter,
            canalContexto: { phoneNumberId, token, telefoneCliente: de },
          });
          // TODO(seam): resposta.encaminhar -> notificar a equipe (fila/atendimento).
        }

        // Estatistica leve do bot (best-effort, nao bloqueia).
        prisma.bot.update({
          where: { id: bot.id },
          data: { totalMensagens: { increment: mensagens.length }, ultimaAtividadeEm: new Date() },
        }).catch((e) => console.error('[webhook/whatsapp stats]', e?.message));
      }
    }
  } catch (e) {
    console.error('[webhook/whatsapp]', e);
  }
});

module.exports = roteador;
