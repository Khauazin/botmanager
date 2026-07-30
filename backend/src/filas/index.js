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

// Fecha as filas/conexões no shutdown.
async function fecharFilas() {
  if (filaCampanhaDisparo) await filaCampanhaDisparo.close();
}

module.exports = {
  criarConexaoRedis,
  fecharFilas,
  enfileirarEnvioCampanha,
  NOME_FILA_CAMPANHA,
  REDIS_URL,
};
