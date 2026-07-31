// Gerenciador de conexao Baileys (WhatsApp Web nao oficial) — vive DENTRO do
// processo worker.js, o unico que segura estado de longa duracao sem
// hot-reload (ver plano de implementacao). Registro em memoria (Map<botId,
// {sock}>) — 1 processo worker hoje, sem clustering.
//
// NAO VERIFICADO nesta sessao contra a versao exata do pacote instalado —
// makeWASocket/DisconnectReason/Browsers/os eventos connection.update,
// creds.update, messages.upsert sao API publica estavel do
// @whiskeysockets/baileys ha varias versoes, mas confirme depois de rodar
// `npm install`.
//
// Fluxo:
//   iniciarPareamento(botId)  -> abre socket, gera QR se preciso
//   obterSocket(botId)        -> usado pelo BaileysAdapter (envio) e pelo
//                                 disparo de campanha (services/campanhaService.js)
//   desconectar(botId, {logout}) -> fecha e opcionalmente limpa a sessao
//   reconectarBotsPareados()  -> chamado 1x no boot do worker.js

const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  DisconnectReason,
  Browsers,
} = require('@whiskeysockets/baileys');

const prisma = require('../../prisma');
const { criarAuthState, limparAuthState } = require('./authStateStore');
const { processarMensagemRecebida } = require('../whatsappInbound');
const { criarProvedorWhatsapp } = require('../../adapters/whatsapp');

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'warn' });

// Map<botId, {sock}> — o socket em si guarda tudo que o Baileys precisa
// internamente; so mantemos a referencia pra outros modulos (adapter,
// campanha) conseguirem mandar mensagem.
const conexoes = new Map();

function obterSocket(botId) {
  return conexoes.get(botId)?.sock || null;
}

async function publicarEvento(botId, tipo, dados) {
  // Redis pub/sub e o unico jeito do worker (sem req.io) avisar o backend em
  // tempo real — o backend relay em index.js repassa pro socket.io da sala
  // do bot. Best-effort: se o Redis cair, o front ainda pode consultar
  // GET /bots/:id/canal/baileys/status como fallback.
  try {
    const IORedis = require('ioredis');
    if (!publicarEvento._pub) {
      publicarEvento._pub = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
    await publicarEvento._pub.publish('baileys:eventos', JSON.stringify({ botId, tipo, dados }));
  } catch (e) {
    console.error('[baileys/publicarEvento] falha ao publicar', e?.message);
  }
}

async function atualizarStatus(botId, dados) {
  const bot = await prisma.bot.update({
    where: { id: botId },
    data: { ...dados, baileysAtualizadoEm: new Date() },
    select: { clienteId: true, statusConexaoBaileys: true, qrCodeAtual: true, baileysNumeroConectado: true },
  });
  await publicarEvento(botId, 'baileys_status', bot);
  return bot;
}

async function tratarMensagemRecebida(bot, upsert) {
  if (upsert.type !== 'notify') return;
  const sock = obterSocket(bot.id);
  if (!sock) return;

  const faqs = bot.iaAtiva ? [] : await prisma.faq.findMany({
    where: { clienteId: bot.clienteId, ativo: true },
    orderBy: { ordem: 'asc' },
  });
  const adapter = criarProvedorWhatsapp('BAILEYS', { modo: 'live', socket: sock });

  for (const msg of upsert.messages || []) {
    // Ignora mensagem enviada pelo proprio bot (eco) e mensagem de grupo — o
    // modelo de Lead do sistema e 1:1 por cliente final, nao por grupo.
    if (msg.key?.fromMe) continue;
    const remoteJid = msg.key?.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) continue;

    const de = remoteJid.replace('@s.whatsapp.net', '');
    const texto = msg.message?.conversation
      || msg.message?.extendedTextMessage?.text
      || msg.message?.buttonsResponseMessage?.selectedDisplayText
      || msg.message?.listResponseMessage?.title
      || '';
    if (!texto) continue;

    await processarMensagemRecebida({
      bot, texto, de, faqs, adapter,
      canalContexto: { phoneNumberId: null, token: null, telefoneCliente: de },
    }).catch((e) => console.error(`[baileys/mensagem] falha ao processar (bot ${bot.id}):`, e?.message));
  }

  prisma.bot.update({
    where: { id: bot.id },
    data: { totalMensagens: { increment: upsert.messages?.length || 0 }, ultimaAtividadeEm: new Date() },
  }).catch((e) => console.error('[baileys/stats]', e?.message));
}

async function iniciarPareamento(botId) {
  if (conexoes.has(botId)) return; // ja conectado/conectando — no-op

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      id: true, clienteId: true, credencialCanalId: true, provedorCanal: true,
      iaAtiva: true, iaModelo: true, iaPromptSistema: true,
      iaTokensIncluidosMes: true, iaPrecoPorMilTokensExcedenteCentavos: true,
    },
  });
  if (!bot || bot.provedorCanal !== 'BAILEYS' || !bot.credencialCanalId) {
    console.error(`[baileys] iniciarPareamento: bot ${botId} invalido ou sem credencial associada.`);
    return;
  }

  await atualizarStatus(botId, { statusConexaoBaileys: 'CONECTANDO' });

  const { state, saveCreds } = await criarAuthState({
    credencialId: bot.credencialCanalId, clienteId: bot.clienteId, botId, logger,
  });

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: Browsers.ubuntu('Sellergy Cloud'),
    printQRInTerminal: false,
  });
  conexoes.set(botId, { sock });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', (upsert) => {
    tratarMensagemRecebida(bot, upsert).catch((e) => console.error(`[baileys] erro no messages.upsert (bot ${botId}):`, e?.message));
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrPng = await QRCode.toDataURL(qr).catch(() => null);
      await atualizarStatus(botId, { statusConexaoBaileys: 'AGUARDANDO_QR', qrCodeAtual: qrPng });
      return;
    }

    if (connection === 'open') {
      const numero = sock.user?.id?.split(':')[0] || null;
      await atualizarStatus(botId, { statusConexaoBaileys: 'CONECTADO', qrCodeAtual: null, baileysNumeroConectado: numero, identificadorCanal: numero });
      return;
    }

    if (connection === 'close') {
      conexoes.delete(botId);
      const codigoDesconexao = lastDisconnect?.error?.output?.statusCode;
      const foiLogout = codigoDesconexao === DisconnectReason.loggedOut;

      if (foiLogout) {
        // Dispositivo desvinculado no celular — limpa a sessao, exige novo QR.
        await limparAuthState({ credencialId: bot.credencialCanalId, clienteId: bot.clienteId }).catch(() => {});
        await atualizarStatus(botId, { statusConexaoBaileys: 'LOGOUT', qrCodeAtual: null, baileysNumeroConectado: null });
        return;
      }

      // Desconexao transitoria (rede, restart) — tenta de novo com a mesma
      // sessao, sem exigir acao do usuario.
      await atualizarStatus(botId, { statusConexaoBaileys: 'CONECTANDO' });
      setTimeout(() => iniciarPareamento(botId).catch((e) => console.error(`[baileys] falha ao reconectar bot ${botId}:`, e?.message)), 3000);
    }
  });
}

async function desconectar(botId) {
  const conexao = conexoes.get(botId);
  if (conexao?.sock) {
    await conexao.sock.logout().catch(() => {});
    conexoes.delete(botId);
  }
  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { clienteId: true, credencialCanalId: true } });
  if (bot?.credencialCanalId) {
    await limparAuthState({ credencialId: bot.credencialCanalId, clienteId: bot.clienteId }).catch(() => {});
  }
  await atualizarStatus(botId, { statusConexaoBaileys: 'DESCONECTADO', qrCodeAtual: null, baileysNumeroConectado: null });
}

/** Chamado 1x no boot do worker.js — reconecta sozinho os bots ja pareados. */
async function reconectarBotsPareados() {
  const bots = await prisma.bot.findMany({
    where: { provedorCanal: 'BAILEYS', statusConexaoBaileys: 'CONECTADO' },
    select: { id: true },
  });
  for (const bot of bots) {
    iniciarPareamento(bot.id).catch((e) => console.error(`[baileys] falha ao reconectar bot ${bot.id} no boot:`, e?.message));
  }
  if (bots.length > 0) console.log(`[baileys] reconectando ${bots.length} bot(s) pareado(s) do boot.`);
}

module.exports = { iniciarPareamento, desconectar, reconectarBotsPareados, obterSocket };
