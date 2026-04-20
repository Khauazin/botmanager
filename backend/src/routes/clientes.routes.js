const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', async (req, res) => {
  try {
    const clientes = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(clientes);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

roteador.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await prisma.client.findUnique({
      where: { id },
      include: {
        bots: true, // Traz os bots associados
      }
    });
    
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    
    res.json(cliente);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar detalhes do cliente' });
  }
});

roteador.post('/', async (req, res) => {
  try {
    const { name, email, phone, segment, plan, monthlyFee } = req.body;
    const cliente = await prisma.client.create({
      data: { name, email, phone, segment, plan, monthlyFee: Number(monthlyFee || 0) }
    });
    res.status(201).json(cliente);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar cliente' });
  }
});

roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, segment, plan, status, monthlyFee } = req.body;
    const cliente = await prisma.client.update({
      where: { id },
      data: { name, email, phone, segment, plan, status, monthlyFee: Number(monthlyFee || 0) }
    });
    res.json(cliente);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar cliente' });
  }
});
roteador.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const cliente = await prisma.client.update({
      where: { id },
      data: { status }
    });
    res.json(cliente);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao alterar status do cliente' });
  }
});

roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.client.delete({ where: { id } });
    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir cliente. Verifique se ele possui bots vinculados.' });
  }
});

module.exports = roteador;
