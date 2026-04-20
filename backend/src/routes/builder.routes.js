const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// ==========================================
// FLOWS
// ==========================================

roteador.get('/flows/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const flows = await prisma.flow.findMany({
      where: { botId },
      include: { nodes: true, edges: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(flows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fluxos' });
  }
});

roteador.post('/flows', async (req, res) => {
  try {
    const { botId, name, isActive, triggerType, triggerKeyword } = req.body;
    const flow = await prisma.flow.create({
      data: { botId, name, isActive, triggerType, triggerKeyword }
    });
    res.status(201).json(flow);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar fluxo' });
  }
});

roteador.put('/flows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive, triggerType, triggerKeyword } = req.body;
    const flow = await prisma.flow.update({
      where: { id },
      data: { name, isActive, triggerType, triggerKeyword }
    });
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar fluxo' });
  }
});

roteador.delete('/flows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.flow.delete({ where: { id } });
    res.json({ message: 'Fluxo excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir fluxo' });
  }
});

// ==========================================
// NODES & EDGES (Salvar Canvas completo)
// ==========================================

roteador.post('/flows/:flowId/canvas', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { nodes, edges } = req.body; // Arrays vindo do React Flow

    // Deleta os antigos
    await prisma.node.deleteMany({ where: { flowId } });
    await prisma.edge.deleteMany({ where: { flowId } });

    // Cria os novos
    if (nodes && nodes.length > 0) {
      await prisma.node.createMany({
        data: nodes.map(n => ({
          id: n.id,
          flowId,
          type: n.data?.dbType || 'MESSAGE',
          positionX: n.position.x,
          positionY: n.position.y,
          data: n.data || {}
        }))
      });
    }

    if (edges && edges.length > 0) {
      await prisma.edge.createMany({
        data: edges.map(e => ({
          id: e.id,
          flowId,
          sourceNodeId: e.source,
          targetNodeId: e.target,
          sourceHandle: e.sourceHandle || null
        }))
      });
    }

    res.json({ message: 'Canvas salvo com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar canvas:', error);
    res.status(500).json({ error: 'Erro ao salvar construtor de fluxo' });
  }
});

module.exports = roteador;
