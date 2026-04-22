const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// ==========================================
// LEAD STAGES (Fases do Kanban)
// ==========================================

roteador.get('/stages', async (req, res) => {
  try {
    let { clientId } = req.usuario;
    const { clientId: queryClientId } = req.query;

    if (!clientId && req.usuario.role === 'ADMIN') {
      clientId = queryClientId;
    }

    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }

    const stages = await prisma.leadStage.findMany({
      where: { clientId },
      orderBy: { order: 'asc' }
    });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fases do CRM' });
  }
});

roteador.post('/stages', async (req, res) => {
  try {
    let { clientId } = req.usuario;
    const { name, order, color, clientId: bodyClientId } = req.body;

    // Se o usuário logado não tem clientId (é ADMIN), tenta pegar do body
    if (!clientId && req.usuario.role === 'ADMIN') {
      clientId = bodyClientId;
    }

    console.log(`[CRM] Criando stage "${name}" para cliente ${clientId}`);

    if (!clientId) {
      console.error('[CRM] Tentativa de criar stage sem clientId');
      return res.status(400).json({ error: 'clientId é obrigatório para criar fase' });
    }

    const stage = await prisma.leadStage.create({
      data: { clientId, name, order, color }
    });
    res.status(201).json(stage);
  } catch (error) {
    console.error('[CRM] Erro ao criar fase:', error);
    res.status(500).json({ error: 'Erro ao criar fase no CRM' });
  }
});

// ... outros métodos de stages (put/delete) mantendo o clientId do req.usuario
roteador.put('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.usuario;
    const { name, order, color } = req.body;
    const stage = await prisma.leadStage.update({
      where: { id, clientId },
      data: { name, order, color }
    });
    res.json(stage);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar fase do CRM' });
  }
});

roteador.delete('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.usuario;
    await prisma.leadStage.delete({ where: { id, clientId } });
    res.json({ message: 'Fase excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir fase' });
  }
});

// ==========================================
// LEADS
// ==========================================

roteador.get('/leads', async (req, res) => {
  try {
    let { clientId } = req.usuario;
    const { clientId: queryClientId } = req.query;

    if (!clientId && req.usuario.role === 'ADMIN') {
      clientId = queryClientId;
    }

    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }

    const leads = await prisma.lead.findMany({
      where: { clientId },
      include: { stage: true },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar leads' });
  }
});

roteador.post('/leads', async (req, res) => {
  try {
    let { clientId } = req.usuario;
    const { stageId, name, phone, email, value, tags, priority, origin, notes, clientId: bodyClientId } = req.body;

    // Se o usuário logado não tem clientId (é ADMIN), tenta pegar do body
    if (!clientId && req.usuario.role === 'ADMIN') {
      clientId = bodyClientId;
    }

    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório para criar lead' });
    }

    const lead = await prisma.lead.create({
      data: { clientId, stageId, name, phone, email, value: parseFloat(value) || 0, tags, priority, origin, notes },
      include: { stage: true }
    });

    try {
      await prisma.leadHistory.create({
        data: {
          leadId: lead.id,
          action: 'CRIADO',
          toStage: lead.stage?.name || 'Início',
          notes: `Lead "${name}" criado`
        }
      });
    } catch (e) { console.error('Erro Histórico:', e); }

    res.status(201).json(lead);
  } catch (error) {
    console.error('Erro Create Lead:', error);
    res.status(500).json({ error: 'Erro ao criar lead' });
  }
});

roteador.put('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { clientId } = req.usuario;
    const { stageId, name, phone, email, value, tags, priority, origin, notes, clientId: bodyClientId } = req.body;

    // Se for ADMIN, ele pode estar editando um lead de qualquer cliente.
    // O clientId do lead deve ser preservado ou pego do body.
    const anterior = await prisma.lead.findUnique({ where: { id } });

    if (!anterior) return res.status(404).json({ error: 'Lead não encontrado' });

    // Permissão: Admin pode tudo, Cliente só o dele.
    if (req.usuario.role !== 'ADMIN' && anterior.clientId !== clientId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { 
        stageId, name, phone, email, 
        value: parseFloat(value) || 0, 
        tags, priority, origin, notes,
        // Admin pode mudar o lead de cliente se necessário, senão mantém
        clientId: req.usuario.role === 'ADMIN' ? (bodyClientId || anterior.clientId) : anterior.clientId
      },
      include: { stage: true }
    });

    if (anterior && anterior.stageId !== stageId) {
      try {
        await prisma.leadHistory.create({
          data: {
            leadId: id,
            action: 'MOVIDO',
            fromStage: anterior.stage?.name || 'N/A',
            toStage: lead.stage?.name || 'N/A',
            notes: `Movido para ${lead.stage?.name || 'nova etapa'}`
          }
        });
      } catch (e) { console.error('Erro Histórico Move:', e); }
    }

    res.json(lead);
  } catch (error) {
    console.error('Erro Update Lead:', error);
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

roteador.delete('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { clientId } = req.usuario;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    if (req.usuario.role !== 'ADMIN' && lead.clientId !== clientId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await prisma.lead.delete({ where: { id } });
    res.json({ message: 'Lead excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir lead' });
  }
});

// ==========================================
// HISTÓRICO DO LEAD
// ==========================================

roteador.get('/leads/:leadId/history', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { clientId } = req.usuario;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.json([]);

    if (req.usuario.role !== 'ADMIN' && lead.clientId !== clientId) {
      return res.json([]);
    }

    const history = await prisma.leadHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.json([]);
  }
});

roteador.post('/leads/:leadId/history', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { clientId } = req.usuario;
    const { notes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    if (req.usuario.role !== 'ADMIN' && lead.clientId !== clientId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const entry = await prisma.leadHistory.create({
      data: { leadId, action: 'OBSERVACAO', notes }
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar observação' });
  }
});

module.exports = roteador;
