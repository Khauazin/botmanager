const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', async (req, res) => {
  try {
    const bots = await prisma.bot.findMany({
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bots);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao listar bots' });
  }
});

roteador.get('/:id', async (req, res) => {
  try {
    const bot = await prisma.bot.findUnique({
      where: { id: req.params.id }
    });
    if (!bot) return res.status(404).json({ erro: 'Bot não encontrado' });
    res.json(bot);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar bot' });
  }
});

roteador.post('/', async (req, res) => {
  try {
    const { clientId, name, channel, phoneNumber, aiProvider, aiModel, aiSystemPrompt, aiTemperature } = req.body;
    const bot = await prisma.bot.create({
      data: { clientId, name, channel, phoneNumber, aiProvider, aiModel, aiSystemPrompt, aiTemperature: aiTemperature ? parseFloat(aiTemperature) : 0.7 }
    });
    res.status(201).json(bot);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar bot' });
  }
});

roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, channel, status, phoneNumber, aiProvider, aiModel, aiSystemPrompt, aiTemperature, aiApiKey } = req.body;
    const bot = await prisma.bot.update({
      where: { id },
      data: { name, channel, status, phoneNumber, aiProvider, aiModel, aiSystemPrompt, aiApiKey, aiTemperature: aiTemperature ? parseFloat(aiTemperature) : 0.7 }
    });
    
    // Avisar todos os clientes via socket que o bot atualizou
    req.io.emit('bot_atualizado', bot);
    
    res.json(bot);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar bot' });
  }
});

roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.bot.delete({ where: { id } });
    req.io.emit('bot_deletado', id);
    res.json({ message: 'Bot excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir bot.' });
  }
});

roteador.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Busca o bot original completo
    const botOriginal = await prisma.bot.findUnique({
      where: { id },
      include: {
        flows: {
          include: {
            nodes: true,
            edges: true
          }
        },
        variables: true
      }
    });

    if (!botOriginal) return res.status(404).json({ erro: 'Bot não encontrado' });

    // 2. Clona o Bot Base
    const novoBot = await prisma.bot.create({
      data: {
        clientId: botOriginal.clientId,
        name: `${botOriginal.name} (Cópia)`,
        channel: botOriginal.channel,
        phoneNumber: botOriginal.phoneNumber,
        aiProvider: botOriginal.aiProvider,
        aiModel: botOriginal.aiModel,
        aiApiKey: botOriginal.aiApiKey,
        aiSystemPrompt: botOriginal.aiSystemPrompt,
        aiTemperature: botOriginal.aiTemperature,
        status: 'OFFLINE'
      }
    });

    // 3. Clona as Variáveis
    if (botOriginal.variables.length > 0) {
      await prisma.botVariable.createMany({
        data: botOriginal.variables.map(v => ({
          botId: novoBot.id,
          key: v.key,
          value: v.value,
          description: v.description,
          type: v.type
        }))
      });
    }

    // 4. Clona os Fluxos e seus nós/arestas
    for (const flowOriginal of botOriginal.flows) {
      const novoFluxo = await prisma.flow.create({
        data: {
          botId: novoBot.id,
          name: flowOriginal.name,
          isActive: flowOriginal.isActive,
          triggerType: flowOriginal.triggerType,
          triggerKeyword: flowOriginal.triggerKeyword
        }
      });

      // Como o React Flow gera IDs de nó na ponta do cliente, para clonarmos precisamos mapear os velhos IDs para os novos IDs
      // Assim mantemos as arestas (edges) corretas
      const mapNodes = {};

      if (flowOriginal.nodes.length > 0) {
        const createNodesPromise = flowOriginal.nodes.map(n => {
          const novoIdNode = `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          mapNodes[n.id] = novoIdNode;
          
          return prisma.node.create({
            data: {
              id: novoIdNode,
              flowId: novoFluxo.id,
              type: n.type,
              positionX: n.positionX,
              positionY: n.positionY,
              data: n.data
            }
          });
        });
        await Promise.all(createNodesPromise);
      }

      if (flowOriginal.edges.length > 0) {
        const createEdgesPromise = flowOriginal.edges.map(e => {
          const novoIdEdge = `edge_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          return prisma.edge.create({
            data: {
              id: novoIdEdge,
              flowId: novoFluxo.id,
              sourceNodeId: mapNodes[e.sourceNodeId],
              targetNodeId: mapNodes[e.targetNodeId],
              sourceHandle: e.sourceHandle
            }
          });
        });
        await Promise.all(createEdgesPromise);
      }
    }

    // Notifica frontend
    const botCompleto = await prisma.bot.findUnique({
      where: { id: novoBot.id },
      include: { client: { select: { name: true } } }
    });
    
    req.io.emit('bot_criado', botCompleto);
    
    res.status(201).json(botCompleto);
  } catch (error) {
    console.error('Erro ao duplicar bot:', error);
    res.status(500).json({ error: 'Erro ao duplicar o bot.' });
  }
});

module.exports = roteador;
