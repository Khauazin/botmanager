// Campanhas — v1: RECOMPRA POR CADENCIA (recompra leve).
//
// O plano define campanhas completas (disparo HSM em massa, templates Meta)
// como fase 2 do produto — depende de aprovacao de template pela Meta e da
// infra de envio. Aqui entregamos o nucleo nao-bloqueado e de valor imediato:
// a FILA DE RECOMPRA. Calcula quem comprou ha >= N dias e nao voltou, pra a
// equipe agir manualmente (abrir conversa no WhatsApp). Nada e disparado
// automaticamente nesta versao.
//
// Gating: modulo CRM (recompra e relacionamento/funil) + permissao CRM.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { mesclarConversoes, formatarListaLeads, LIMITE_RECORRENTE, DIAS_MIN_LEAD_NOVO } = require('../services/segmentacaoLeads');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('CRM'));

const MS_DIA = 24 * 60 * 60 * 1000;
const DIAS_PADRAO = 30;
const DIAS_MIN = 1;
const DIAS_MAX = 365;

// GET /campanhas/recompra?dias=30
// Candidatos: leads cuja ULTIMA compra (venda COMPLETED) foi ha >= `dias` dias
// e que nao compraram de novo desde entao. Ordena do mais "vencido" ao mais
// recente. v1: lista pra acao manual; nao dispara mensagem.
roteador.get('/recompra', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam a recompra.' });
    }

    const diasBruto = parseInt(req.query.dias, 10);
    const dias = Math.min(Math.max(Number.isFinite(diasBruto) ? diasBruto : DIAS_PADRAO, DIAS_MIN), DIAS_MAX);
    const corte = new Date(Date.now() - dias * MS_DIA);

    // Ultima compra por lead (so vendas concluidas, com lead vinculado).
    const grupos = await prisma.venda.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _max: { data: true },
      _count: { _all: true },
      _sum: { valor: true },
    });

    // Vencidos: ultima compra <= corte (nao voltaram dentro da janela).
    const vencidos = grupos.filter((g) => g._max.data && new Date(g._max.data) <= corte);
    const leadIds = vencidos.map((g) => g.leadId);
    if (leadIds.length === 0) {
      return res.json({ dias, corte, candidatos: [] });
    }

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, clienteId },
      select: { id: true, nome: true, telefone: true, ultimoContato: true },
    });
    const mapaLead = new Map(leads.map((l) => [l.id, l]));

    const candidatos = vencidos
      .map((g) => {
        const lead = mapaLead.get(g.leadId);
        if (!lead) return null;
        const ultimaCompra = g._max.data;
        const diasDesde = Math.floor((Date.now() - new Date(ultimaCompra).getTime()) / MS_DIA);
        return {
          leadId: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          ultimaCompra,
          diasDesde,
          totalCompras: g._count._all,
          valorTotal: g._sum.valor || 0,
          // Pra UI sinalizar quem ja foi contatado depois da ultima compra.
          ultimoContato: lead.ultimoContato,
          contatadoAposCompra: lead.ultimoContato ? new Date(lead.ultimoContato) > new Date(ultimaCompra) : false,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.diasDesde - a.diasDesde);

    res.json({ dias, corte, candidatos });
  } catch (erro) {
    console.error('[campanhas/recompra]', erro);
    res.status(500).json({ erro: 'Erro ao calcular a fila de recompra.' });
  }
});

// ==========================================
// SEGMENTACAO DE LEADS — pra fidelizar quem ja passou pela base (loja ou
// clinica/servico). "Conversao" conta tanto VENDA quanto ATENDIMENTO
// concluido, porque um tenant de servico nao tem venda de produto. Regras
// puras (merge/formatacao) vivem em services/segmentacaoLeads.js.
// ==========================================

// Agrega vendas COMPLETED + agendamentos COMPLETED por lead num unico mapa.
async function buscarConversoesPorLead(clienteId) {
  const [vendasPorLead, agendamentosPorLead] = await Promise.all([
    prisma.venda.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _count: { _all: true },
      _sum: { valor: true },
      _max: { data: true },
    }),
    prisma.agendamento.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _count: { _all: true },
      _max: { data: true },
    }),
  ]);
  return mesclarConversoes(vendasPorLead, agendamentosPorLead);
}

// Busca os dados de contato dos leads e monta a resposta.
async function montarListaLeads(clienteId, entradas) {
  const leadIds = entradas.map((e) => e.leadId);
  if (leadIds.length === 0) return [];
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, clienteId },
    select: { id: true, nome: true, telefone: true },
  });
  return formatarListaLeads(entradas, leads);
}

// GET /campanhas/recorrentes — leads com 2+ compras/atendimentos concluidos.
// Ja fidelizados; uteis pra campanha de fidelidade/indicacao.
roteador.get('/recorrentes', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const mapa = await buscarConversoesPorLead(clienteId);
    const entradas = [...mapa.values()].filter((e) => (e.compras + e.atendimentos) >= LIMITE_RECORRENTE);
    const leads = await montarListaLeads(clienteId, entradas);
    res.json({ leads });
  } catch (erro) {
    console.error('[campanhas/recorrentes]', erro);
    res.status(500).json({ erro: 'Erro ao buscar leads recorrentes.' });
  }
});

// GET /campanhas/convertidos — todo lead com pelo menos 1 conversao (venda ou
// atendimento concluido). Superset de recorrentes + fila de recompra.
roteador.get('/convertidos', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const mapa = await buscarConversoesPorLead(clienteId);
    const leads = await montarListaLeads(clienteId, [...mapa.values()]);
    res.json({ leads });
  } catch (erro) {
    console.error('[campanhas/convertidos]', erro);
    res.status(500).json({ erro: 'Erro ao buscar leads convertidos.' });
  }
});

// GET /campanhas/nunca-converteram — leads sem nenhuma venda/atendimento
// concluido, cadastrados ha 7+ dias (lead novo ainda esta no funil normal,
// nao "perdeu a chance" ainda).
roteador.get('/nunca-converteram', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam campanhas.' });
    const mapa = await buscarConversoesPorLead(clienteId);
    const corte = new Date(Date.now() - DIAS_MIN_LEAD_NOVO * MS_DIA);
    const leads = await prisma.lead.findMany({
      where: { clienteId, criadoEm: { lte: corte }, id: { notIn: [...mapa.keys()] } },
      select: { id: true, nome: true, telefone: true, criadoEm: true },
      orderBy: { criadoEm: 'asc' },
    });
    res.json({
      leads: leads.map((l) => ({
        leadId: l.id,
        nome: l.nome,
        telefone: l.telefone,
        criadoEm: l.criadoEm,
        diasSemConverter: Math.floor((Date.now() - new Date(l.criadoEm).getTime()) / MS_DIA),
      })),
    });
  } catch (erro) {
    console.error('[campanhas/nunca-converteram]', erro);
    res.status(500).json({ erro: 'Erro ao buscar leads sem conversao.' });
  }
});

module.exports = roteador;
