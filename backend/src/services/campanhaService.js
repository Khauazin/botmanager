// Disparo de campanha — logica de ENVIO de 1 CampanhaEnvio (1 lead), chamada
// pelo worker BullMQ (ver filas/index.js + worker.js). Fora daqui, a fila so
// enfileira { campanhaEnvioId } — toda a logica de negocio mora aqui.

const prisma = require('../prisma');
const { criarProvedorWhatsapp } = require('../adapters/whatsapp');
const { carregarCredencialDecifrada } = require('../credenciais');
const { obterSocket } = require('./baileys/gerenciadorConexao');

// Marca 1 envio como falho + soma no contador da campanha.
async function marcarFalha(envio, motivo) {
  await prisma.$transaction([
    prisma.campanhaEnvio.update({ where: { id: envio.id }, data: { status: 'FALHOU', erro: motivo } }),
    prisma.campanha.update({ where: { id: envio.campanhaId }, data: { totalFalhou: { increment: 1 } } }),
  ]);
  await finalizarSeCompleto(envio.campanhaId);
}

// Quando nao sobra nenhum envio PENDENTE, a campanha vira CONCLUIDA. Rodar
// isso mais de uma vez (corrida entre jobs terminando quase juntos) e
// inofensivo — so reescreve o mesmo status/data.
async function finalizarSeCompleto(campanhaId) {
  const pendentes = await prisma.campanhaEnvio.count({ where: { campanhaId, status: 'PENDENTE' } });
  if (pendentes === 0) {
    await prisma.campanha.update({ where: { id: campanhaId }, data: { status: 'CONCLUIDA', enviadoEm: new Date() } });
  }
}

/**
 * Processa 1 envio de campanha: manda a mensagem (template Meta) pro lead e
 * atualiza status + contadores. Idempotente — envio que ja saiu de PENDENTE
 * (ENVIADO/FALHOU) e ignorado, protege contra reprocessamento (retry do
 * BullMQ, job duplicado).
 * @param {string} campanhaEnvioId
 */
async function processarEnvioCampanha(campanhaEnvioId) {
  const envio = await prisma.campanhaEnvio.findUnique({
    where: { id: campanhaEnvioId },
    include: {
      campanha: { select: { id: true, clienteId: true, nomeTemplate: true, mensagem: true } },
      lead: { select: { id: true, nome: true, telefone: true } },
    },
  });
  if (!envio || envio.status !== 'PENDENTE') return;

  if (!envio.lead.telefone) return marcarFalha(envio, 'Lead sem telefone cadastrado.');

  const bot = await prisma.bot.findFirst({
    where: { clienteId: envio.campanha.clienteId, identificadorCanal: { not: null } },
    select: { id: true, provedorCanal: true, identificadorCanal: true, credencialCanalId: true },
  });
  if (!bot?.identificadorCanal || !bot.credencialCanalId) {
    return marcarFalha(envio, 'Nenhum bot com WhatsApp conectado.');
  }

  let resultado;
  if (bot.provedorCanal === 'BAILEYS') {
    // Sem template no WhatsApp Web — a mensagem da campanha e o texto de
    // verdade que sai (pra Meta, esse campo e so preview: o que sai la e o
    // template aprovado). Precisa da conexao viva (socket) do proprio worker.
    const socket = obterSocket(bot.id);
    if (!socket) return marcarFalha(envio, 'WhatsApp Web nao esta conectado no momento.');
    const adapter = criarProvedorWhatsapp('BAILEYS', { modo: 'live', socket });
    resultado = await adapter.enviarTexto({ para: envio.lead.telefone, texto: envio.campanha.mensagem });
  } else {
    if (!envio.campanha.nomeTemplate) return marcarFalha(envio, 'Campanha sem template aprovado configurado.');

    const credencial = await carregarCredencialDecifrada({
      credencialId: bot.credencialCanalId, clienteId: envio.campanha.clienteId,
    }).catch(() => null);
    const token = credencial?.dados?.token || credencial?.dados?.accessToken || null;
    if (!token) return marcarFalha(envio, 'Credencial do WhatsApp invalida ou ausente.');

    const adapter = criarProvedorWhatsapp('META_CLOUD', {
      credencial: { dados: { accessToken: token } }, identificadorCanal: bot.identificadorCanal, modo: 'live',
    });
    resultado = await adapter.enviarTemplate({ para: envio.lead.telefone, nomeTemplate: envio.campanha.nomeTemplate, idioma: 'pt_BR' });
  }

  if (!resultado.ok) {
    return marcarFalha(envio, resultado.erro || 'Falha no envio pelo WhatsApp.');
  }

  await prisma.$transaction([
    prisma.campanhaEnvio.update({ where: { id: envio.id }, data: { status: 'ENVIADO', enviadoEm: new Date() } }),
    prisma.campanha.update({ where: { id: envio.campanhaId }, data: { totalEnviado: { increment: 1 } } }),
  ]);
  await finalizarSeCompleto(envio.campanhaId);
}

module.exports = { processarEnvioCampanha };
