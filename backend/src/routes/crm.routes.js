const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// ==========================================
// LEAD STAGES (Fases do Kanban)
// ==========================================

roteador.get('/stages/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
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
    const { clientId, name, order, color } = req.body;
    const stage = await prisma.leadStage.create({
      data: { clientId, name, order, color }
    });
    res.status(201).json(stage);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar fase no CRM' });
  }
});

roteador.put('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, order, color } = req.body;
    const stage = await prisma.leadStage.update({
      where: { id },
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
    await prisma.leadStage.delete({ where: { id } });
    res.json({ message: 'Fase excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir fase' });
  }
});

// ==========================================
// LEADS
// ==========================================

roteador.get('/leads/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
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
    const { clientId, stageId, name, phone, email, value, notes } = req.body;
    const lead = await prisma.lead.create({
      data: { clientId, stageId, name, phone, email, value, notes }
    });
    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar lead' });
  }
});

roteador.put('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { stageId, name, phone, email, value, notes } = req.body;
    const lead = await prisma.lead.update({
      where: { id },
      data: { stageId, name, phone, email, value, notes }
    });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

roteador.delete('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.lead.delete({ where: { id } });
    res.json({ message: 'Lead excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir lead' });
  }
});

module.exports = roteador;
