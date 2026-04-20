const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Lista as variáveis de um bot
roteador.get('/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const variables = await prisma.botVariable.findMany({
      where: { botId },
      orderBy: { key: 'asc' }
    });
    res.json(variables);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar variáveis' });
  }
});

// Admin pode criar uma nova variável para o cliente editar
roteador.post('/', async (req, res) => {
  try {
    const { botId, key, value, description, type } = req.body;
    const variable = await prisma.botVariable.create({
      data: { botId, key, value, description, type }
    });
    res.status(201).json(variable);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar variável' });
  }
});

// Cliente (ou Admin) pode atualizar o valor da variável
roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body; // Cliente normalmente só pode mudar o valor
    const variable = await prisma.botVariable.update({
      where: { id },
      data: { value }
    });
    
    // Opcional: avisar o motor de bot via Socket ou internal event
    // req.io.emit('bot_variable_updated', variable);
    
    res.json(variable);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar variável' });
  }
});

roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.botVariable.delete({ where: { id } });
    res.json({ message: 'Variável excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir variável' });
  }
});

module.exports = roteador;
