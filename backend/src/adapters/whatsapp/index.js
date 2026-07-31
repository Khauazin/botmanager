// Factory da camada de WhatsApp: resolve o adapter pelo provedorCanal do Bot.
// Uso (rota/serviço, após carregar a credencial do tenant):
//
//   const { criarProvedorWhatsapp } = require('../adapters/whatsapp');
//   const credencial = await carregarCredencialDecifrada({ credencialId, clienteId });
//   const wpp = criarProvedorWhatsapp(bot.provedorCanal, {
//     credencial, identificadorCanal: bot.identificadorCanal, modo: 'live',
//     // socket só faz sentido pra BAILEYS — resolvido por quem chama (ver
//     // services/baileys/gerenciadorConexao.js), a factory não busca sozinha.
//     socket: bot.provedorCanal === 'BAILEYS' ? gerenciadorConexao.obterSocket(bot.id) : undefined,
//   });
//   await wpp.enviarTexto({ para, texto });
//
// O resto do sistema só conhece esta factory + a interface ProvedorWhatsApp —
// nunca um driver específico.

const { ProvedorWhatsApp } = require('./ProvedorWhatsApp');
const MetaCloudAdapter = require('./metaCloud');
const BaileysAdapter = require('./baileys');

const ADAPTERS = {
  META_CLOUD: MetaCloudAdapter,
  BAILEYS: BaileysAdapter,
};

/** Provedores suportados (espelha enum `Bot.provedorCanal`). */
const PROVEDORES = Object.keys(ADAPTERS);

/** Mapa provedor → TipoCredencial esperado no cofre. */
const TIPO_CREDENCIAL_POR_PROVEDOR = Object.freeze({
  META_CLOUD: 'WHATSAPP_CLOUD_TOKEN',
  BAILEYS: 'WHATSAPP_BAILEYS_SESSION',
});

/**
 * @param {string} provedor  META_CLOUD | BAILEYS
 * @param {Object} cfg        { credencial, modo?, identificadorCanal?, socket? }
 * @returns {ProvedorWhatsApp}
 */
function criarProvedorWhatsapp(provedor, cfg = {}) {
  const Adapter = ADAPTERS[provedor];
  if (!Adapter) {
    throw Object.assign(new Error(`Provedor de WhatsApp desconhecido: ${provedor}.`), {
      status: 400, codigo: 'PROVEDOR_WHATSAPP_INVALIDO',
    });
  }
  return new Adapter(cfg);
}

module.exports = {
  criarProvedorWhatsapp,
  PROVEDORES,
  TIPO_CREDENCIAL_POR_PROVEDOR,
  ProvedorWhatsApp,
};
