// Regras puras de segmentacao de leads pra campanhas de fidelizacao. Sem
// dependencia de Express/banco — so os dados ja buscados entram aqui.
// "Conversao" conta tanto VENDA quanto ATENDIMENTO concluido, porque um
// tenant de servico (clinica) nao tem venda de produto.

const LIMITE_RECORRENTE = 2; // 2+ conversoes = recorrente
const DIAS_MIN_LEAD_NOVO = 7; // lead com menos de 7 dias ainda nao "perdeu a chance"

// Combina os 2 groupBy (vendas + agendamentos) num unico mapa por lead.
function mesclarConversoes(vendasPorLead, agendamentosPorLead) {
  const mapa = new Map();
  for (const v of vendasPorLead) {
    mapa.set(v.leadId, {
      leadId: v.leadId, compras: v._count._all, atendimentos: 0,
      valorTotal: v._sum.valor || 0, ultimaConversao: v._max.data,
    });
  }
  for (const a of agendamentosPorLead) {
    const atual = mapa.get(a.leadId) || { leadId: a.leadId, compras: 0, atendimentos: 0, valorTotal: 0, ultimaConversao: null };
    atual.atendimentos = a._count._all;
    if (!atual.ultimaConversao || (a._max.data && new Date(a._max.data) > new Date(atual.ultimaConversao))) {
      atual.ultimaConversao = a._max.data;
    }
    mapa.set(a.leadId, atual);
  }
  return mapa;
}

// Junta entradas (mapa de conversao) com os dados de contato do lead, ordenada
// da conversao mais recente pra mais antiga.
function formatarListaLeads(entradas, leads) {
  const mapaLead = new Map(leads.map((l) => [l.id, l]));
  return entradas
    .map((e) => {
      const lead = mapaLead.get(e.leadId);
      if (!lead) return null;
      return {
        leadId: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        totalConversoes: e.compras + e.atendimentos,
        compras: e.compras,
        atendimentos: e.atendimentos,
        valorTotal: e.valorTotal,
        ultimaConversao: e.ultimaConversao,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.ultimaConversao) - new Date(a.ultimaConversao));
}

module.exports = { mesclarConversoes, formatarListaLeads, LIMITE_RECORRENTE, DIAS_MIN_LEAD_NOVO };
