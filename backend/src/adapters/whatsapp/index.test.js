const test = require('node:test');
const assert = require('node:assert/strict');
const { criarProvedorWhatsapp, PROVEDORES, TIPO_CREDENCIAL_POR_PROVEDOR } = require('./index');

test('PROVEDORES lista META_CLOUD e BAILEYS', () => {
  assert.deepEqual(PROVEDORES.sort(), ['BAILEYS', 'META_CLOUD']);
});

test('TIPO_CREDENCIAL_POR_PROVEDOR mapeia pro tipo certo no cofre', () => {
  assert.equal(TIPO_CREDENCIAL_POR_PROVEDOR.META_CLOUD, 'WHATSAPP_CLOUD_TOKEN');
  assert.equal(TIPO_CREDENCIAL_POR_PROVEDOR.BAILEYS, 'WHATSAPP_BAILEYS_SESSION');
});

test('criarProvedorWhatsapp lanca em provedor desconhecido', () => {
  assert.throws(() => criarProvedorWhatsapp('TELEGRAM'), /Provedor de WhatsApp desconhecido/);
});

test('criarProvedorWhatsapp(META_CLOUD) devolve um adapter com os 3 metodos', () => {
  const wpp = criarProvedorWhatsapp('META_CLOUD', { credencial: { dados: { accessToken: 'x' } }, identificadorCanal: '123' });
  assert.equal(typeof wpp.enviarTexto, 'function');
  assert.equal(typeof wpp.enviarDocumento, 'function');
  assert.equal(typeof wpp.enviarTemplate, 'function');
});

test('criarProvedorWhatsapp(BAILEYS) em modo fixture nao toca a rede/socket', async () => {
  const wpp = criarProvedorWhatsapp('BAILEYS', { modo: 'fixture' });
  const r = await wpp.enviarTexto({ para: '5562999998888', texto: 'oi' });
  assert.deepEqual(r, { ok: true, simulado: true });
});

// BAILEYS_ENVIO_REAL e um interruptor global lido em module-load-time (mesmo
// padrao do WHATSAPP_ENVIO_REAL em whatsappCloud.js) — pra testar o caminho
// "live" de verdade, precisa setar o env ANTES do require e limpar o cache
// dos dois modulos depois, senao a constante fica presa no valor da primeira
// vez que o modulo carregou.
function comBaileysEnvioReal(fn) {
  return async () => {
    process.env.BAILEYS_ENVIO_REAL = '1';
    delete require.cache[require.resolve('./baileys')];
    delete require.cache[require.resolve('./index')];
    try {
      const { criarProvedorWhatsapp: criar } = require('./index');
      await fn(criar);
    } finally {
      delete process.env.BAILEYS_ENVIO_REAL;
      delete require.cache[require.resolve('./baileys')];
      delete require.cache[require.resolve('./index')];
    }
  };
}

test('BAILEYS em modo live sem socket devolve erro claro, nao lanca', comBaileysEnvioReal(async (criar) => {
  const wpp = criar('BAILEYS', { modo: 'live', socket: null });
  const r = await wpp.enviarTexto({ para: '5562999998888', texto: 'oi' });
  assert.equal(r.ok, false);
  assert.match(r.erro, /não conectada/);
}));

test('BAILEYS em modo live com socket chama sendMessage e devolve idMensagem', comBaileysEnvioReal(async (criar) => {
  const socketFake = {
    sendMessage: async (jid, corpo) => {
      assert.equal(jid, '5562999998888@s.whatsapp.net');
      assert.deepEqual(corpo, { text: 'oi' });
      return { key: { id: 'ABC123' } };
    },
  };
  const wpp = criar('BAILEYS', { modo: 'live', socket: socketFake });
  const r = await wpp.enviarTexto({ para: '5562999998888', texto: 'oi' });
  assert.deepEqual(r, { ok: true, simulado: false, idMensagem: 'ABC123' });
}));

test('BAILEYS enviarTemplate sempre lanca (nao existe HSM no WhatsApp Web)', async () => {
  const wpp = criarProvedorWhatsapp('BAILEYS', { modo: 'fixture' });
  await assert.rejects(() => wpp.enviarTemplate({ para: 'x', nomeTemplate: 'y' }), /Templates HSM/);
});
