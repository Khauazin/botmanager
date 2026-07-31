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
const { criarConexaoRedis, NOME_FILA_CAMPANHA, NOME_FILA_CAMPANHA_BAILEYS, NOME_FILA_BAILEYS_COMANDO } = require('./filas');
const { processarEnvioCampanha } = require('./services/campanhaService');
const gerenciadorConexaoBaileys = require('./services/baileys/gerenciadorConexao');

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

// CAMPANHA-DISPARO-BAILEYS — fila propria (nao a de cima), pra ter um
// espacamento MUITO mais conservador. O pacing real vem do `delay` calculado
// por job em filas/index.js (intervalo-base + jitter) — este limiter aqui e
// so uma rede de seguranca, nao o mecanismo principal de espacamento.
const workerCampanhaBaileys = new Worker(
  NOME_FILA_CAMPANHA_BAILEYS,
  async (job) => processarEnvioCampanha(job.data.campanhaEnvioId),
  {
    connection: criarConexaoRedis({ paraWorker: true }),
    concurrency: 1,
    limiter: { max: 10, duration: 60_000 },
  },
);
workerCampanhaBaileys.on('failed', (job, err) => {
  console.error(`[worker:${NOME_FILA_CAMPANHA_BAILEYS}] job ${job?.id} falhou:`, err?.message);
});
consumidores.push(workerCampanhaBaileys);

// BAILEYS-COMANDO — backend (rota HTTP) manda "conectar"/"desconectar" pra cá,
// que é o único processo que segura a conexão Baileys de verdade (ver
// services/baileys/gerenciadorConexao.js). concurrency baixa: pareamento é
// coisa rara/manual, não precisa de paralelismo.
const workerBaileysComando = new Worker(
  NOME_FILA_BAILEYS_COMANDO,
  async (job) => {
    const { acao, botId } = job.data;
    if (acao === 'conectar') return gerenciadorConexaoBaileys.iniciarPareamento(botId);
    if (acao === 'desconectar') return gerenciadorConexaoBaileys.desconectar(botId);
    console.error(`[worker:${NOME_FILA_BAILEYS_COMANDO}] acao desconhecida:`, acao);
  },
  { connection: criarConexaoRedis({ paraWorker: true }), concurrency: 2 },
);
workerBaileysComando.on('failed', (job, err) => {
  console.error(`[worker:${NOME_FILA_BAILEYS_COMANDO}] job ${job?.id} falhou:`, err?.message);
});
consumidores.push(workerBaileysComando);

// Reconecta sozinho os bots Baileys que já estavam pareados antes do worker
// reiniciar (deploy, crash) — sem isso o tenant precisaria escanear o QR de
// novo toda vez que o container sobe.
gerenciadorConexaoBaileys.reconectarBotsPareados()
  .catch((e) => console.error('[worker] falha ao reconectar bots Baileys no boot:', e?.message));

console.log(`[worker] iniciado · consumidores registrados: ${NOME_FILA_CAMPANHA}, ${NOME_FILA_CAMPANHA_BAILEYS}, ${NOME_FILA_BAILEYS_COMANDO}`);

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
