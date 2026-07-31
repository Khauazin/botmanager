// Infra de filas BullMQ (esqueleto pós-pivô ERP-first).
//
// A execução de fluxo do bot-vendedor foi removida na limpeza do pivô. Esta
// camada permanece como base para os jobs do ERP que entram nas próximas fases:
// lembrete de agendamento, disparo de campanha, emissão fiscal, conciliação de
// pagamento e expiração de cobrança (ver erp-arquitetura-e-operacao.md §8.4).
//
// Para adicionar um job: crie a Queue aqui, registre o consumidor no worker.js
// e exporte os helpers de enfileiramento.

const IORedis = require('ioredis');
const { Queue } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Producer e Worker exigem opcoes de connection diferentes:
//  - Producer: aceita defaults
//  - Worker  : exige `maxRetriesPerRequest: null` (BullMQ usa BLOCKING commands)
function criarConexaoRedis({ paraWorker = false } = {}) {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: paraWorker ? null : 3,
    enableReadyCheck: !paraWorker,
    lazyConnect: false,
  });
}

// ==========================================
// CAMPANHA-DISPARO — 1 job por lead (nao por campanha inteira), pra falha de
// 1 envio nao travar nem repetir os outros. Consumidor registrado em
// worker.js; logica de envio em services/campanhaService.js.
// ==========================================
const NOME_FILA_CAMPANHA = 'campanha-disparo';

let filaCampanhaDisparo = null;
function obterFilaCampanhaDisparo() {
  if (!filaCampanhaDisparo) {
    filaCampanhaDisparo = new Queue(NOME_FILA_CAMPANHA, {
      connection: criarConexaoRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }
  return filaCampanhaDisparo;
}

// jobId = campanhaEnvioId -> BullMQ ignora tentativa de re-enfileirar o mesmo
// envio enquanto o job anterior ainda esta pendente/ativo (idempotencia).
async function enfileirarEnvioCampanha(campanhaEnvioId) {
  await obterFilaCampanhaDisparo().add('enviar', { campanhaEnvioId }, { jobId: campanhaEnvioId });
}

// ==========================================
// CAMPANHA-DISPARO-BAILEYS — fila PROPRIA (nao a de cima), pra poder ter um
// espacamento MUITO mais conservador entre envios do que a Meta precisa.
// BullMQ so aceita 1 limiter por Worker, entao "usar a mesma fila com uma
// regra diferente" nao existe — precisa ser uma fila separada mesmo.
// O espacamento real vem do `delay` calculado POR JOB (nao so um limiter
// estourando em rajada) — intervalo-base + jitter aleatorio, pra parecer
// mais humano. Risco de banimento do numero em disparo de massa por canal
// nao oficial e real (o proprio usuario reconheceu), entao aqui a prioridade
// e ir devagar, nao rapido.
// ==========================================
const NOME_FILA_CAMPANHA_BAILEYS = 'campanha-disparo-baileys';
const BAILEYS_INTERVALO_BASE_MS = 30_000; // ~30s entre envios
const BAILEYS_JITTER_MS = 10_000; // + ate 10s de variacao aleatoria

let filaCampanhaDisparoBaileys = null;
function obterFilaCampanhaDisparoBaileys() {
  if (!filaCampanhaDisparoBaileys) {
    filaCampanhaDisparoBaileys = new Queue(NOME_FILA_CAMPANHA_BAILEYS, {
      connection: criarConexaoRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }
  return filaCampanhaDisparoBaileys;
}

/**
 * @param {string} campanhaEnvioId
 * @param {number} indiceNoLote  posicao do lead dentro deste disparo (0, 1, 2...)
 *   — cada indice espera mais que o anterior, nao todos ao mesmo tempo.
 */
async function enfileirarEnvioCampanhaBaileys(campanhaEnvioId, indiceNoLote) {
  const jitter = Math.floor(Math.random() * BAILEYS_JITTER_MS);
  const delay = indiceNoLote * BAILEYS_INTERVALO_BASE_MS + jitter;
  await obterFilaCampanhaDisparoBaileys().add('enviar', { campanhaEnvioId }, { jobId: campanhaEnvioId, delay });
}

// ==========================================
// BAILEYS-COMANDO — backend (rota HTTP) -> worker (onde a conexao vive de
// verdade). O worker so tem 1 instancia hoje.
//
// SEM jobId fixo de proposito: um jobId deterministico (ex: `conectar-<botId>`)
// parecia uma boa ideia pra evitar 2 comandos empilhados por clique duplo, mas
// o BullMQ nunca reprocessa um job com um ID que ja rodou antes (sucesso OU
// falha) — um job "conectar" que falhou uma vez ficaria bloqueando TODA
// tentativa seguinte pro mesmo bot, silenciosamente (o botao "Conectar"
// pareceria nao fazer nada, sem nenhum log de erro). A protecao contra
// clique duplo real ja existe no lugar certo — gerenciadorConexao.js checa o
// ESTADO da conexao em memoria (`conexoes.has(botId)`), nao "ja tentei uma
// vez", entao permite retry depois de falha sem risco de duplicar conexao viva.
// removeOnComplete/removeOnFail baixos: e so um comando de disparo, nao
// precisa reter historico.
// Consumidor registrado em worker.js; logica em services/baileys/.
// ==========================================
const NOME_FILA_BAILEYS_COMANDO = 'baileys-comando';

let filaBaileysComando = null;
function obterFilaBaileysComando() {
  if (!filaBaileysComando) {
    filaBaileysComando = new Queue(NOME_FILA_BAILEYS_COMANDO, {
      connection: criarConexaoRedis(),
      defaultJobOptions: { attempts: 1, removeOnComplete: 20, removeOnFail: 20 },
    });
  }
  return filaBaileysComando;
}

async function enfileirarComandoBaileys(acao, botId) {
  await obterFilaBaileysComando().add(acao, { acao, botId });
}

// Fecha as filas/conexões no shutdown.
async function fecharFilas() {
  if (filaCampanhaDisparo) await filaCampanhaDisparo.close();
  if (filaCampanhaDisparoBaileys) await filaCampanhaDisparoBaileys.close();
  if (filaBaileysComando) await filaBaileysComando.close();
}

module.exports = {
  criarConexaoRedis,
  fecharFilas,
  enfileirarEnvioCampanha,
  enfileirarEnvioCampanhaBaileys,
  enfileirarComandoBaileys,
  NOME_FILA_CAMPANHA,
  NOME_FILA_CAMPANHA_BAILEYS,
  NOME_FILA_BAILEYS_COMANDO,
  REDIS_URL,
};
