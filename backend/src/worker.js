// Worker BullMQ (esqueleto pós-pivô ERP-first).
//
// Os consumidores de execução de fluxo (execucao-fluxo / agendamento-disparo /
// retencao-execucoes) foram removidos na limpeza do pivô. Este processo segue
// vivo como base para os jobs do ERP das próximas fases (lembrete de
// agendamento, disparo de campanha, emissão fiscal, conciliação de pagamento,
// expiração de cobrança — ver erp-arquitetura-e-operacao.md §8.4).
//
// Para registrar um job: crie a Queue em ./filas, instancie um `new Worker(...)`
// aqui com sua conexão própria, e trate o shutdown abaixo.
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const { criarConexaoRedis, NOME_FILA_CAMPANHA } = require('./filas');
const { processarEnvioCampanha } = require('./services/campanhaService');

// Conexão base mantida viva para o processo continuar disponível ao orquestrador
// (Docker Compose) enquanto ainda não há consumidores registrados.
const conexao = criarConexaoRedis({ paraWorker: true });

const consumidores = [];

// CAMPANHA-DISPARO — envia a mensagem (template Meta) de 1 lead por job.
// concurrency baixa + limiter conservador pra nao estourar rate limit da
// Meta em campanhas grandes.
const workerCampanha = new Worker(
  NOME_FILA_CAMPANHA,
  async (job) => processarEnvioCampanha(job.data.campanhaEnvioId),
  {
    connection: criarConexaoRedis({ paraWorker: true }),
    concurrency: 5,
    limiter: { max: 20, duration: 60_000 },
  },
);
workerCampanha.on('failed', (job, err) => {
  console.error(`[worker:${NOME_FILA_CAMPANHA}] job ${job?.id} falhou:`, err?.message);
});
consumidores.push(workerCampanha);

console.log(`[worker] iniciado · consumidor registrado: ${NOME_FILA_CAMPANHA}`);

async function shutdown(sinal) {
  console.log(`[worker] sinal ${sinal} recebido, encerrando...`);
  try {
    for (const w of consumidores) await w.close();
    await conexao.quit();
  } catch (err) {
    console.error('[worker] erro ao encerrar:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
