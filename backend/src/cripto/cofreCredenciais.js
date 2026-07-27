// Cofre de credenciais (chaves de API). Cifra um objeto JSON com formato livre
// por tipo — a lista de tipos validos e o schema de cada um vivem em
// credenciaisCore.js (fonte unica), ex.:
//   WHATSAPP_CLOUD_TOKEN  -> { accessToken }
//   MERCADO_PAGO_KEY      -> { accessToken, webhookSecret? }
//   FOCUS_NFE_KEY         -> { token }
//
// O proprio JSON serializado e cifrado em AES-256-GCM com chave derivada do
// tenant via HKDF (cofre.js).

const { cifrar, decifrar } = require('./cofre');

const SALT = 'sellergy-credenciais-v1';

function cifrarPayload(clienteId, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload deve ser objeto JSON.');
  }
  return cifrar({ salt: SALT, clienteId, texto: JSON.stringify(payload) });
}

function decifrarPayload(clienteId, registro) {
  // O modelo Prisma `Credencial` chama o campo de `dadosCifrados`, mas o
  // cofre generico (cofre.js) espera `conteudoCifrado`. Traduzimos aqui.
  const json = decifrar({
    salt: SALT,
    clienteId,
    registro: {
      conteudoCifrado: registro.dadosCifrados,
      iv: registro.iv,
      tag: registro.tag,
      versaoChave: registro.versaoChave,
    },
  });
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Payload de credencial corrompido.');
  }
}

// Pequena sanitizacao: remove undefined e trim de strings antes de cifrar.
function normalizarPayload(payload) {
  const limpo = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (v === undefined || v === null) continue;
    limpo[k] = typeof v === 'string' ? v.trim() : v;
  }
  return limpo;
}

module.exports = {
  cifrarPayload,
  decifrarPayload,
  normalizarPayload,
};
