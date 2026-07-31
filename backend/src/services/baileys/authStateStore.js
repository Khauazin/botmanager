// Persistencia do auth-state do Baileys na Credencial cifrada do bot (Opcao A
// do plano de implementacao: 1 blob {creds, keys} por bot, reescrito com
// debounce). Substitui o useMultiFileAuthState de disco que o Baileys usa por
// padrao — o container worker NAO tem volume persistente (ver
// docker-compose.prod.yml), entao gravar em arquivo se perderia a cada deploy.
//
// NAO VERIFICADO nesta sessao contra a versao exata do pacote instalado —
// initAuthCreds/BufferJSON/makeCacheableSignalKeyStore sao API publica
// estavel do @whiskeysockets/baileys ha varias versoes, mas confirme depois
// de rodar `npm install` (ver nomes exatos exportados pelo pacote).

const { initAuthCreds, BufferJSON, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { carregarCredencialDecifrada } = require('../../credenciais');
const { cifrarPayload } = require('../../cripto/cofreCredenciais');
const prisma = require('../../prisma');

const DEBOUNCE_MS = 3000;

/**
 * Monta {state, saveCreds} pro makeWASocket, carregando o payload atual da
 * Credencial (vazio no primeiro pareamento) e persistindo de volta (debounced)
 * a cada creds.update/mutacao de chave.
 * @param {{credencialId:string, clienteId:string, botId:string, logger?:Object}} p
 */
async function criarAuthState({ credencialId, clienteId, botId, logger }) {
  const credencial = await carregarCredencialDecifrada({ credencialId, clienteId }).catch(() => null);
  const salvo = credencial?.dados?.creds ? credencial.dados : null;

  const creds = salvo?.creds
    ? JSON.parse(JSON.stringify(salvo.creds), BufferJSON.reviver)
    : initAuthCreds();
  const chaves = salvo?.keys
    ? JSON.parse(JSON.stringify(salvo.keys), BufferJSON.reviver)
    : {};

  let timer = null;
  function agendarPersistencia() {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      try {
        const payload = JSON.parse(JSON.stringify({ creds, keys: chaves }, BufferJSON.replacer));
        const cifrado = cifrarPayload(clienteId, payload);
        await prisma.credencial.update({
          where: { id: credencialId },
          data: {
            dadosCifrados: cifrado.conteudoCifrado,
            iv: cifrado.iv,
            tag: cifrado.tag,
            versaoChave: cifrado.versaoChave,
          },
        });
      } catch (e) {
        console.error(`[baileys/authState] falha ao persistir sessao do bot ${botId}:`, e?.message);
      }
    }, DEBOUNCE_MS);
  }

  // Store cru (get/set em memoria) — o Baileys envolve isso com cache/lock
  // via makeCacheableSignalKeyStore antes de usar de verdade.
  const storeCru = {
    get: async (tipo, ids) => {
      const resultado = {};
      for (const id of ids) {
        const valor = chaves[tipo]?.[id];
        if (valor !== undefined) resultado[id] = valor;
      }
      return resultado;
    },
    set: async (dados) => {
      for (const tipo of Object.keys(dados)) {
        chaves[tipo] = chaves[tipo] || {};
        for (const id of Object.keys(dados[tipo])) {
          const valor = dados[tipo][id];
          if (valor === null) delete chaves[tipo][id];
          else chaves[tipo][id] = valor;
        }
      }
      agendarPersistencia();
    },
  };

  return {
    state: { creds, keys: makeCacheableSignalKeyStore(storeCru, logger) },
    saveCreds: async () => agendarPersistencia(),
  };
}

/** Limpa a sessao (logout real — dispositivo desvinculado no celular). */
async function limparAuthState({ credencialId, clienteId }) {
  const cifrado = cifrarPayload(clienteId, {});
  await prisma.credencial.update({
    where: { id: credencialId },
    data: {
      dadosCifrados: cifrado.conteudoCifrado,
      iv: cifrado.iv,
      tag: cifrado.tag,
      versaoChave: cifrado.versaoChave,
    },
  });
}

module.exports = { criarAuthState, limparAuthState };
