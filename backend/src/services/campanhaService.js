// Disparo de campanha — logica de ENVIO de 1 CampanhaEnvio (1 lead), chamada
// pelo worker BullMQ (ver filas/index.js + worker.js). Fora daqui, a fila so
// enfileira { campanhaEnvioId } — toda a logica de negocio mora aqui.

const prisma = require('../prisma');
const { enviarTemplate } = require('./whatsappCloud');
const { carregarCredencialDecifrada } = require('../credenciais');

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
      campanha: { select: { id: true, clienteId: true, nomeTemplate: true } },
      lead: { select: { id: true, nome: true, telefone: true } },
    },
  });
  if (!envio || envio.status !== 'PENDENTE') return;

  if (!envio.lead.telefone) return marcarFalha(envio, 'Lead sem telefone cadastrado.');
  if (!envio.campanha.nomeTemplate) return marcarFalha(envio, 'Campanha sem template aprovado configurado.');

  const bot = await prisma.bot.findFirst({
    where: { clienteId: envio.campanha.clienteId, identificadorCanal: { not: null } },
    select: { identificadorCanal: true, credencialCanalId: true },
  });
  if (!bot?.identificadorCanal || !bot.credencialCanalId) {
    return marcarFalha(envio, 'Nenhum bot com WhatsApp conectado.');
  }

  const credencial = await carregarCredencialDecifrada({
    credencialId: bot.credencialCanalId, clienteId: envio.campanha.clienteId,
  }).catch(() => null);
  const token = credencial?.dados?.token || credencial?.dados?.accessToken || null;
  if (!token) return marcarFalha(envio, 'Credencial do WhatsApp invalida ou ausente.');

  const resultado = await enviarTemplate({
    phoneNumberId: bot.identificadorCanal,
    token,
    para: envio.lead.telefone,
    nomeTemplate: envio.campanha.nomeTemplate,
    idioma: 'pt_BR',
  });

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
