const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
  requerPapelPrivilegiado,
} = require('../middlewares/permissoes.middleware');
const {
  substituirVinculosDoLead,
  adicionarVinculo,
  removerVinculo,
} = require('../leadProdutos');
const {
  ETAPAS_CATALOGO,
  buscarEtapaCatalogo,
} = require('../constants/etapasCatalogo');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('CRM'));

// Inclui produtos vinculados ao retornar lead (`variacoes` com produto/categoria
// pra o front montar UI sem N+1). Reutilizado em todas as rotas de leitura.
const INCLUDE_LEAD = {
  etapa: true,
  variacoes: {
    include: {
      variacao: {
        include: {
          produto: { include: { categoria: true } },
        },
      },
    },
  },
};

function tenantDoSolicitante(req, queryClienteId) {
  if (ehAdmin(req.usuario)) return queryClienteId || null;
  return req.usuario.clienteId || null;
}

// ==========================================
// LEAD STAGES (Fases do Kanban)
// ==========================================

roteador.get('/stages', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = tenantDoSolicitante(req, req.query.clienteId);
    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio' });
    }

    const stages = await prisma.etapaLead.findMany({
      where: { clienteId },
      orderBy: { ordem: 'asc' }
    });
    res.json(stages);
  } catch (error) {
    console.error('[crm/stages-list]', error);
    res.status(500).json({ error: 'Erro ao buscar fases do CRM' });
  }
});

// =====================================================================
// CATALOGO DE ETAPAS PRE-DEFINIDAS
// =====================================================================
// O usuario nao cria etapa com nome livre — escolhe do catalogo curado.
// Mantemos esses endpoints sob requerPapelPrivilegiado: VENDEDOR nao mexe
// na estrutura do funil, mesmo com permissao CRM/criar.

// GET /crm/stages/catalogo
// Retorna o catalogo completo + flag 'habilitada' (se ja existe no tenant).
// Visualizacao e liberada pra qualquer perfil do tenant — assim o front mostra
// o estado pro vendedor (so leitura) sem precisar de chamada extra.
roteador.get('/stages/catalogo', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = tenantDoSolicitante(req, req.query.clienteId);
    if (!clienteId) return res.status(400).json({ error: 'clienteId eh obrigatorio' });

    // Pega o que ja existe pro tenant pra marcar 'habilitada'.
    const existentes = await prisma.etapaLead.findMany({
      where: { clienteId, slug: { not: null } },
      select: { id: true, slug: true },
    });
    const habilitadas = new Map(existentes.map((e) => [e.slug, e.id]));

    const catalogo = ETAPAS_CATALOGO.map((e) => ({
      ...e,
      habilitada: habilitadas.has(e.slug),
      etapaId: habilitadas.get(e.slug) || null,
    }));
    res.json(catalogo);
  } catch (error) {
    console.error('[crm/stages-catalogo]', error);
    res.status(500).json({ error: 'Erro ao carregar catalogo de etapas' });
  }
});

// POST /crm/stages/catalogo/:slug
// Habilita uma etapa do catalogo pro tenant. Idempotente: se ja existe,
// retorna a existente sem erro.
roteador.post('/stages/catalogo/:slug', requerPapelPrivilegiado, async (req, res) => {
  try {
    const { slug } = req.params;
    const def = buscarEtapaCatalogo(slug);
    if (!def) return res.status(400).json({ error: 'Slug invalido. Use um do catalogo.' });

    const clienteId = tenantDoSolicitante(req, req.body?.clienteId);
    if (!clienteId) return res.status(400).json({ error: 'clienteId eh obrigatorio' });

    // Upsert pra ser idempotente: 2 cliques no toggle nao quebra.
    const stage = await prisma.etapaLead.upsert({
      where: { clienteId_slug: { clienteId, slug } },
      create: { clienteId, slug, nome: def.nome, ordem: def.ordem, cor: def.cor },
      update: {}, // se ja existe, nao mexe (preserva customizacoes)
    });
    res.status(201).json(stage);
  } catch (error) {
    console.error('[crm/stages-catalogo-habilitar]', error);
    res.status(500).json({ error: 'Erro ao habilitar etapa' });
  }
});

// DELETE /crm/stages/catalogo/:slug
// Desabilita (deleta) a etapa do tenant. Bloqueia se houver leads — o cliente
// precisa mover ou excluir os leads antes pra evitar perda silenciosa.
roteador.delete('/stages/catalogo/:slug', requerPapelPrivilegiado, async (req, res) => {
  try {
    const { slug } = req.params;
    const clienteId = tenantDoSolicitante(req, req.query?.clienteId);
    if (!clienteId) return res.status(400).json({ error: 'clienteId eh obrigatorio' });

    const stage = await prisma.etapaLead.findUnique({
      where: { clienteId_slug: { clienteId, slug } },
      include: { _count: { select: { leads: true } } },
    });
    if (!stage) return res.status(404).json({ error: 'Etapa nao esta habilitada.' });

    if (stage._count.leads > 0) {
      return res.status(409).json({
        error: `Esta etapa tem ${stage._count.leads} lead(s). Mova ou exclua eles antes de desabilitar.`,
        codigo: 'ETAPA_COM_LEADS',
        totalLeads: stage._count.leads,
      });
    }

    await prisma.etapaLead.delete({ where: { id: stage.id } });
    res.json({ message: 'Etapa desabilitada' });
  } catch (error) {
    console.error('[crm/stages-catalogo-desabilitar]', error);
    res.status(500).json({ error: 'Erro ao desabilitar etapa' });
  }
});

// =====================================================================
// ETAPAS LIVRES (LEGACY — nao expor mais no front)
// =====================================================================
// Mantemos o POST/PUT/DELETE livres pra migracao/uso interno, mas sob
// requerPapelPrivilegiado (CLIENT + ADMINISTRADOR). VENDEDOR nao mexe.

roteador.post('/stages', requerPapelPrivilegiado, async (req, res) => {
  try {
    const { nome, ordem, cor, clienteId: bodyClienteId } = req.body;
    const clienteId = tenantDoSolicitante(req, bodyClienteId);

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio para criar fase' });
    }

    const stage = await prisma.etapaLead.create({
      data: { clienteId, nome, ordem: parseInt(ordem) || 0, cor }
    });
    res.status(201).json(stage);
  } catch (error) {
    console.error('[crm/stage-create]', error);
    res.status(500).json({ error: 'Erro ao criar fase no CRM' });
  }
});

roteador.put('/stages/:id', requerPapelPrivilegiado, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ordem, cor } = req.body;

    // Verifica posse do stage antes de atualizar.
    const stageOriginal = await prisma.etapaLead.findUnique({ where: { id } });
    if (!stageOriginal) return res.status(404).json({ error: 'Fase nao encontrada.' });

    if (!ehAdmin(req.usuario) && stageOriginal.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const stage = await prisma.etapaLead.update({
      where: { id },
      data: { nome, ordem: parseInt(ordem) || undefined, cor }
    });
    res.json(stage);
  } catch (error) {
    console.error('[crm/stage-update]', error);
    res.status(500).json({ error: 'Erro ao atualizar fase do CRM' });
  }
});

roteador.delete('/stages/:id', requerPapelPrivilegiado, async (req, res) => {
  try {
    const { id } = req.params;

    const stageOriginal = await prisma.etapaLead.findUnique({ where: { id } });
    if (!stageOriginal) return res.status(404).json({ error: 'Fase nao encontrada.' });

    if (!ehAdmin(req.usuario) && stageOriginal.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    await prisma.etapaLead.delete({ where: { id } });
    res.json({ message: 'Fase excluida com sucesso' });
  } catch (error) {
    console.error('[crm/stage-delete]', error);
    res.status(500).json({ error: 'Erro ao excluir fase' });
  }
});

// ==========================================
// LEADS
// ==========================================

roteador.get('/leads', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = tenantDoSolicitante(req, req.query.clienteId);
    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio' });
    }

    const leads = await prisma.lead.findMany({
      where: { clienteId },
      include: INCLUDE_LEAD,
      orderBy: { atualizadoEm: 'desc' }
    });
    res.json(leads);
  } catch (error) {
    console.error('[crm/leads-list]', error);
    res.status(500).json({ error: 'Erro ao buscar leads' });
  }
});

// Normaliza CPF — guarda so digitos (front manda com mascara). Vazio = null.
function normalizarCpf(cpf) {
  if (!cpf) return null;
  const d = String(cpf).replace(/\D/g, '');
  return d.length > 0 ? d : null;
}

// Normaliza dataNascimento — aceita ISO ou null/undefined. String vazia = null.
function normalizarDataNasc(data) {
  if (!data) return null;
  const d = new Date(data);
  return Number.isNaN(d.getTime()) ? null : d;
}

roteador.post('/leads', requerPermissao('CRM', 'criar'), async (req, res) => {
  try {
    const {
      etapaId, nome, telefone, email, tags, prioridade, origem, observacoes,
      cpf, dataNascimento,
      variacoes, // novo: [{ variacaoId, quantidade?, observacao? }]
      clienteId: bodyClienteId,
    } = req.body;
    const clienteId = tenantDoSolicitante(req, bodyClienteId);

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio para criar lead' });
    }

    // Cria o lead + vinculos em uma transacao. O valor inicial e 0 — vai ser
    // recalculado por `substituirVinculosDoLead` se houver variacoes.
    const lead = await prisma.$transaction(async (tx) => {
      const novo = await tx.lead.create({
        data: {
          clienteId, etapaId, nome, telefone, email, valor: 0,
          tags, prioridade, origem, observacoes,
          cpf: normalizarCpf(cpf),
          dataNascimento: normalizarDataNasc(dataNascimento),
        },
      });
      if (Array.isArray(variacoes) && variacoes.length > 0) {
        await substituirVinculosDoLead({ leadId: novo.id, clienteId, vinculos: variacoes, tx });
      }
      return tx.lead.findUnique({ where: { id: novo.id }, include: INCLUDE_LEAD });
    });

    try {
      await prisma.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: 'CRIADO',
          paraEtapa: lead.etapa?.nome || 'Inicio',
          observacoes: `Lead "${nome}" criado`
        }
      });
    } catch (e) { console.error('Erro Historico:', e); }

    res.status(201).json(lead);
  } catch (error) {
    console.error('[crm/leads-create]', error);
    res.status(500).json({ error: error?.message || 'Erro ao criar lead' });
  }
});

roteador.put('/leads/:id', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      etapaId, nome, telefone, email, tags, prioridade, origem, observacoes,
      cpf, dataNascimento,
      variacoes, // novo: se vier, substitui o conjunto de produtos vinculados
      clienteId: bodyClienteId,
    } = req.body;

    const anterior = await prisma.lead.findUnique({ where: { id }, include: { etapa: true } });
    if (!anterior) return res.status(404).json({ error: 'Lead nao encontrado' });

    if (!ehAdmin(req.usuario) && anterior.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Lead fechado (ganho ou perdido) e etapa final — nao move manualmente.
    // Reabertura so acontece automaticamente (novo contato, devolucao
    // proxima — ver services/etapaLeadAuto.js). Outros campos do lead
    // continuam editaveis normalmente.
    const ETAPAS_FECHADAS = new Set(['fechado-ganho', 'fechado-perdido']);
    if (ETAPAS_FECHADAS.has(anterior.etapa?.slug) && etapaId !== undefined && etapaId !== anterior.etapaId) {
      return res.status(409).json({ error: 'Lead fechado nao pode ser movido manualmente.' });
    }

    const clienteIdEfetivo = ehAdmin(req.usuario) ? (bodyClienteId || anterior.clienteId) : anterior.clienteId;

    const lead = await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          etapaId, nome, telefone, email,
          tags, prioridade, origem, observacoes,
          clienteId: clienteIdEfetivo,
          // CPF/nascimento: undefined no body = nao atualiza; null/'' = limpa.
          ...(cpf !== undefined ? { cpf: normalizarCpf(cpf) } : {}),
          ...(dataNascimento !== undefined ? { dataNascimento: normalizarDataNasc(dataNascimento) } : {}),
          // valor sera recalculado por substituirVinculosDoLead se variacoes vier
        },
      });

      if (Array.isArray(variacoes)) {
        await substituirVinculosDoLead({ leadId: id, clienteId: clienteIdEfetivo, vinculos: variacoes, tx });
      }

      return tx.lead.findUnique({ where: { id }, include: INCLUDE_LEAD });
    });

    if (anterior && anterior.etapaId !== etapaId) {
      try {
        await prisma.historicoLead.create({
          data: {
            leadId: id,
            acao: 'MOVIDO',
            deEtapa: anterior.etapa?.nome || 'N/A',
            paraEtapa: lead.etapa?.nome || 'N/A',
            observacoes: `Movido para ${lead.etapa?.nome || 'nova etapa'}`
          }
        });
      } catch (e) { console.error('Erro Historico Move:', e); }
    }

    res.json(lead);
  } catch (error) {
    console.error('[crm/leads-update]', error);
    res.status(500).json({ error: error?.message || 'Erro ao atualizar lead' });
  }
});

// ==========================================
// PRODUTOS VINCULADOS AO LEAD
// ==========================================
// Helper: garante que o lead pertence ao tenant do solicitante.
async function leadDoSolicitante(req, leadId) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { erro: 'Lead nao encontrado.', status: 404 };
  if (!ehAdmin(req.usuario) && lead.clienteId !== req.usuario.clienteId) {
    return { erro: 'Acesso negado.', status: 403 };
  }
  return { lead };
}

// Adiciona (ou incrementa quantidade de) uma variacao no lead.
roteador.post('/leads/:leadId/variacoes', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { leadId } = req.params;
    const { variacaoId, quantidade, observacao } = req.body;
    const r = await leadDoSolicitante(req, leadId);
    if (r.erro) return res.status(r.status).json({ error: r.erro });
    const out = await adicionarVinculo({
      leadId,
      clienteId: r.lead.clienteId,
      variacaoId,
      quantidade,
      observacao,
    });
    res.json(out);
  } catch (error) {
    console.error('[crm/leads-add-variacao]', error);
    res.status(400).json({ error: error?.message || 'Erro ao vincular produto.' });
  }
});

// Remove uma variacao do lead.
roteador.delete('/leads/:leadId/variacoes/:variacaoId', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { leadId, variacaoId } = req.params;
    const r = await leadDoSolicitante(req, leadId);
    if (r.erro) return res.status(r.status).json({ error: r.erro });
    const out = await removerVinculo({ leadId, variacaoId });
    res.json(out);
  } catch (error) {
    console.error('[crm/leads-remove-variacao]', error);
    res.status(500).json({ error: 'Erro ao desvincular produto.' });
  }
});

// Atualiza quantidade/observacao de uma variacao ja vinculada.
roteador.patch('/leads/:leadId/variacoes/:variacaoId', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { leadId, variacaoId } = req.params;
    const { quantidade, observacao } = req.body;
    const r = await leadDoSolicitante(req, leadId);
    if (r.erro) return res.status(r.status).json({ error: r.erro });

    const dadosUpdate = {};
    if (quantidade !== undefined) dadosUpdate.quantidade = Math.max(1, Number(quantidade) || 1);
    if (observacao !== undefined) dadosUpdate.observacao = observacao || null;
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({ error: 'Nada pra atualizar.' });
    }

    await prisma.leadVariacao.update({
      where: { leadId_variacaoId: { leadId, variacaoId } },
      data: dadosUpdate,
    });

    // Recalcula valor.
    const { calcularValorAgregado } = require('../leadProdutos');
    const vinculos = await prisma.leadVariacao.findMany({
      where: { leadId },
      include: { variacao: true },
    });
    const { valorTotal } = calcularValorAgregado(vinculos);
    await prisma.lead.update({ where: { id: leadId }, data: { valor: valorTotal } });
    res.json({ vinculos, valorTotal });
  } catch (error) {
    console.error('[crm/leads-patch-variacao]', error);
    res.status(500).json({ error: 'Erro ao atualizar vinculo.' });
  }
});

roteador.delete('/leads/:id', requerPermissao('CRM', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: 'Lead nao encontrado' });

    if (!ehAdmin(req.usuario) && lead.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await prisma.lead.delete({ where: { id } });
    res.json({ message: 'Lead excluido com sucesso' });
  } catch (error) {
    // P2003 = FK bloqueando (venda, devolucao, agendamento ou lancamento
    // financeiro vinculados) — nunca perde rastro fiscal/financeiro apagando
    // o lead. Mensagem clara em vez do erro cru do Prisma.
    if (error?.code === 'P2003') {
      return res.status(409).json({
        error: 'Este lead tem vendas, devoluções, agendamentos ou lançamentos financeiros vinculados e não pode ser excluído. Considere movê-lo para uma etapa de encerramento em vez de excluir.',
      });
    }
    console.error('[crm/leads-delete]', error);
    res.status(500).json({ error: 'Erro ao excluir lead' });
  }
});

// ==========================================
// HISTORICO DO LEAD
// ==========================================

roteador.get('/leads/:leadId/history', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const { leadId } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.json([]);

    if (!ehAdmin(req.usuario) && lead.clienteId !== req.usuario.clienteId) {
      return res.json([]);
    }

    const history = await prisma.historicoLead.findMany({
      where: { leadId },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error('[crm/leads-history]', error);
    res.json([]);
  }
});

roteador.post('/leads/:leadId/history', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { leadId } = req.params;
    const { observacoes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead nao encontrado' });

    if (!ehAdmin(req.usuario) && lead.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const entry = await prisma.historicoLead.create({
      data: { leadId, acao: 'OBSERVACAO', observacoes }
    });
    res.status(201).json(entry);
  } catch (error) {
    console.error('[crm/leads-history-create]', error);
    res.status(500).json({ error: 'Erro ao adicionar observacao' });
  }
});

module.exports = roteador;
