// Transicoes automaticas de etapa do lead no funil de CRM, disparadas por
// eventos de negocio — nunca por acao manual do usuario (essa ja existe em
// crm.routes.js, rota PUT /leads/:id). Cobre:
//   - venda concluida (produto, aluguel ou servico) -> fecha o lead;
//   - devolucao concluida -> fecha o lead de novo (pode ter sido reaberto
//     pelo aviso de devolucao proxima, abaixo);
//   - aviso de devolucao proxima (cronDevolucoes) -> reabre o lead;
//   - novo contato do cliente pelo WhatsApp -> reabre o lead (se fechado) ou
//     avanca pra 'em-contato' (se ainda estava em 'novo', primeiro contato).
//
// `tx` aceita tanto o client Prisma comum quanto um client de transacao
// (`prisma.$transaction(tx => ...)`) — mesma interface, quem chama decide se
// precisa de atomicidade com outras escritas.
//
// Nunca apaga HistoricoLead antigo: cada transicao vira uma linha nova,
// preservando o rastro de venda/devolucao/aluguel como eventos distintos.

const { buscarEtapaCatalogo } = require('../constants/etapasCatalogo');

const SLUG_FECHADO = 'fechado-ganho';
const SLUG_FECHADO_PERDIDO = 'fechado-perdido';
const SLUG_NOVO = 'novo';
const SLUG_REABERTO = 'em-contato';

// Etapas de onde um novo contato "puxa" o lead pra 'em-contato': terminais
// (fechado, ganho ou perdido) e o estado inicial (novo, nunca conversou).
// Qualquer outra etapa (qualificado, em-negociacao, em-pausa etc.) e
// engajamento manual em andamento — nao mexe.
const SLUGS_QUE_AVANCAM = new Set([SLUG_FECHADO, SLUG_FECHADO_PERDIDO, SLUG_NOVO]);

// Garante que a etapa (slug do catalogo) existe pro tenant, criando com os
// dados padrao do catalogo se o tenant nunca tiver habilitado ela no kanban
// dele. Sem isso, a automacao ficaria refem de o tenant ter mexido no kanban
// manualmente antes.
async function garantirEtapa(tx, clienteId, slug) {
  const existente = await tx.etapaLead.findUnique({
    where: { clienteId_slug: { clienteId, slug } },
  });
  if (existente) return existente;

  const doCatalogo = buscarEtapaCatalogo(slug);
  if (!doCatalogo) throw new Error(`Etapa de catalogo desconhecida: ${slug}.`);

  // Joga pro fim da ordenacao atual do tenant, pra nao embaralhar a posicao
  // das etapas que ele ja configurou manualmente no kanban.
  const ultima = await tx.etapaLead.findFirst({ where: { clienteId }, orderBy: { ordem: 'desc' } });
  return tx.etapaLead.create({
    data: {
      clienteId,
      slug,
      nome: doCatalogo.nome,
      cor: doCatalogo.cor,
      ordem: (ultima?.ordem || 0) + 1,
    },
  });
}

async function moverLeadAutomatico(tx, { clienteId, leadId, slugDestino, motivo }) {
  if (!leadId) return null;

  const lead = await tx.lead.findFirst({ where: { id: leadId, clienteId }, include: { etapa: true } });
  if (!lead) return null; // id invalido ou de outro tenant — nada a fazer

  const etapaAtual = lead.etapa;
  if (etapaAtual?.slug === slugDestino) return lead; // ja esta la — idempotente, sem historico duplicado

  const etapaDestino = await garantirEtapa(tx, clienteId, slugDestino);

  const atualizado = await tx.lead.update({
    where: { id: leadId },
    data: { etapaId: etapaDestino.id },
    include: { etapa: true },
  });

  await tx.historicoLead.create({
    data: {
      leadId,
      acao: 'MOVIDO',
      deEtapa: etapaAtual?.nome || 'N/A',
      paraEtapa: etapaDestino.nome,
      observacoes: motivo,
    },
  });

  return atualizado;
}

function fecharLeadAutomatico(tx, { clienteId, leadId, motivo }) {
  return moverLeadAutomatico(tx, { clienteId, leadId, slugDestino: SLUG_FECHADO, motivo });
}

// So reabre/avanca se o lead estiver em 'novo' ou fechado (ganho/perdido) no
// momento — nunca pra "puxar" um lead que o usuario ja moveu manualmente pra
// outra etapa de engajamento em andamento (ex: 'em-negociacao').
async function reabrirLeadSeFechado(tx, { clienteId, leadId, motivo }) {
  if (!leadId) return null;
  const lead = await tx.lead.findFirst({ where: { id: leadId, clienteId }, include: { etapa: true } });
  if (!lead || !SLUGS_QUE_AVANCAM.has(lead.etapa?.slug)) return null;
  return moverLeadAutomatico(tx, { clienteId, leadId, slugDestino: SLUG_REABERTO, motivo });
}

module.exports = {
  SLUG_FECHADO,
  SLUG_FECHADO_PERDIDO,
  SLUG_NOVO,
  SLUG_REABERTO,
  fecharLeadAutomatico,
  reabrirLeadSeFechado,
};
