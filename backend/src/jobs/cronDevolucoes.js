// =====================================================================
// CRON DIÁRIO DE AVISO DE DEVOLUÇÃO — roda às 08:00 BRT todo dia
// =====================================================================
// Para cada tenant ativo, acha Devolucao pendentes (devolvidoEm null,
// lembreteEnviadoEm null) cuja dataDevolucao esta dentro da janela de aviso
// configurada (Cliente.diasAvisoDevolucao). Pra cada uma:
//   - cria notificacao na plataforma (tipo DEVOLUCAO_PROXIMA) — canal garantido;
//   - tenta mandar WhatsApp pro cliente final (best-effort: a Meta bloqueia
//     mensagem livre se a ultima conversa foi ha mais de 24h — o alerta na
//     plataforma acima e o que sempre funciona);
//   - marca lembreteEnviadoEm pra nao avisar de novo no proximo tick.
//
// setTimeout encadeado (mesma estrategia do cronRelatorioMensal/cronCaixaDiario
// — projeto nao tem node-cron e e so 1 trigger diario).

const prisma = require('../prisma');
const { criarNotificacaoTenant } = require('../utils/notificacoes');
const { enviarTexto } = require('../services/whatsappCloud');
const { carregarCredencialDecifrada } = require('../credenciais');
const { reabrirLeadSeFechado } = require('../services/etapaLeadAuto');

const TZ = 'America/Sao_Paulo';

// Calcula o próximo 08:00 BRT em ms.
function proximaExecucaoMs() {
  const agora = new Date();
  const agoraBRT = agora.toLocaleDateString('en-CA', { timeZone: TZ });
  const [ano, mes, dia] = agoraBRT.split('-').map(Number);
  // 08:00 BRT = 11:00 UTC
  const hojeAs8 = new Date(Date.UTC(ano, mes - 1, dia, 11, 0, 0, 0));
  if (hojeAs8.getTime() > agora.getTime()) return hojeAs8.getTime() - agora.getTime();
  const amanhaAs8 = new Date(Date.UTC(ano, mes - 1, dia + 1, 11, 0, 0, 0));
  return amanhaAs8.getTime() - agora.getTime();
}

/**
 * Data-limite da janela de aviso: dataDevolucao <= hoje + diasAviso dias
 * (23:59:59 do dia-limite, pra cobrir o dia inteiro). Funcao pura — `agora`
 * injetavel pra teste deterministico.
 */
function limiteJanelaAviso(diasAvisoDevolucao, agora = new Date()) {
  const limite = new Date(agora.getTime() + Math.max(0, diasAvisoDevolucao || 0) * 24 * 60 * 60 * 1000);
  limite.setHours(23, 59, 59, 999);
  return limite;
}

async function processarTenant(tenant) {
  const limite = limiteJanelaAviso(tenant.diasAvisoDevolucao);
  const pendentes = await prisma.devolucao.findMany({
    where: {
      clienteId: tenant.id,
      devolvidoEm: null,
      lembreteEnviadoEm: null,
      dataDevolucao: { lte: limite },
    },
    include: {
      lead: { select: { nome: true, telefone: true } },
      variacao: { select: { nome: true, produto: { select: { nome: true } } } },
    },
  });
  if (pendentes.length === 0) return { avisos: 0 };

  // Bot/credencial do tenant — best-effort pro WhatsApp. Sem bot configurado
  // (ou sem token), so o alerta na plataforma acontece — ja e util sozinho.
  const bot = await prisma.bot.findFirst({
    where: { clienteId: tenant.id, identificadorCanal: { not: null } },
    select: { identificadorCanal: true, credencialCanalId: true },
  });
  let tokenWhatsapp = null;
  if (bot?.credencialCanalId) {
    const cred = await carregarCredencialDecifrada({ credencialId: bot.credencialCanalId, clienteId: tenant.id }).catch(() => null);
    tokenWhatsapp = cred?.dados?.token || cred?.dados?.accessToken || null;
  }

  let avisos = 0;
  for (const d of pendentes) {
    const nomeProduto = `${d.variacao.produto.nome} (${d.variacao.nome})`;
    const dataFmt = d.dataDevolucao.toLocaleDateString('pt-BR', { timeZone: TZ });
    try {
      await criarNotificacaoTenant(prisma, {
        clienteId: tenant.id,
        tipo: 'DEVOLUCAO_PROXIMA',
        titulo: `Devolução de ${nomeProduto}`,
        mensagem: `${d.lead?.nome || 'Cliente'} precisa devolver "${nomeProduto}" em ${dataFmt}.`,
        link: '/app/devolucoes',
        dados: { devolucaoId: d.id, vendaId: d.vendaId },
      });

      if (bot?.identificadorCanal && tokenWhatsapp && d.lead?.telefone) {
        await enviarTexto({
          phoneNumberId: bot.identificadorCanal,
          token: tokenWhatsapp,
          para: d.lead.telefone,
          texto: `Olá${d.lead.nome ? `, ${d.lead.nome}` : ''}! Passando pra lembrar que a devolução de "${nomeProduto}" é em ${dataFmt}. Qualquer dúvida, é só chamar por aqui.`,
        }).catch((e) => console.error('[cronDevolucoes] falha ao mandar WhatsApp', e?.message));
      }

      await prisma.devolucao.update({ where: { id: d.id }, data: { lembreteEnviadoEm: new Date() } });

      // Devolucao se aproximando: se o lead tinha sido fechado (venda
      // concluida), reabre pro kanban mostrar que ainda precisa de
      // acompanhamento ate o item voltar.
      await reabrirLeadSeFechado(prisma, {
        clienteId: tenant.id,
        leadId: d.leadId,
        motivo: `Reaberto automaticamente: devolução de "${nomeProduto}" prevista para ${dataFmt}.`,
      }).catch((e) => console.error('[cronDevolucoes] falha ao reabrir lead', e?.message));

      avisos++;
    } catch (e) {
      console.error(`[cronDevolucoes] falha ao processar devolucao ${d.id}:`, e?.message);
    }
  }
  return { avisos };
}

async function executar() {
  console.log('[cronDevolucoes] Tick às 08:00 BRT');
  try {
    const tenants = await prisma.cliente.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, nome: true, diasAvisoDevolucao: true },
    });
    for (const tenant of tenants) {
      try {
        const r = await processarTenant(tenant);
        if (r.avisos > 0) console.log(`[cronDevolucoes] ${tenant.nome}: ${r.avisos} aviso(s)`);
      } catch (e) {
        console.error(`[cronDevolucoes] falha no tenant ${tenant.nome}:`, e?.message);
      }
    }
  } catch (e) {
    console.error('[cronDevolucoes] Falha geral:', e?.message);
  }
}

function agendar() {
  const ms = proximaExecucaoMs();
  const horas = (ms / 1000 / 60 / 60).toFixed(2);
  console.log(`[cronDevolucoes] Próxima execução em ~${horas}h`);
  setTimeout(async () => {
    await executar();
    agendar();
  }, ms);
}

function iniciar() {
  console.log('[cronDevolucoes] Inicializado.');
  agendar();
}

module.exports = { iniciar, executar, limiteJanelaAviso };
