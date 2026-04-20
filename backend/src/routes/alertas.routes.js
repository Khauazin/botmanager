const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', async (req, res) => {
  try {
    const alertas = await prisma.alert.findMany({
      include: {
        bot: { select: { name: true } },
        client: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(alertas);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao listar alertas' });
  }
});

roteador.patch('/:id/resolver', async (req, res) => {
  try {
    const { id } = req.params;
    const alerta = await prisma.alert.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), userId: req.usuarioId }
    });
    req.io.emit('alerta_atualizado', alerta);
    res.json(alerta);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao resolver alerta' });
  }
});

roteador.patch('/:id/ignorar', async (req, res) => {
  try {
    const { id } = req.params;
    const alerta = await prisma.alert.update({
      where: { id },
      data: { status: 'IGNORED', userId: req.usuarioId }
    });
    req.io.emit('alerta_atualizado', alerta);
    res.json(alerta);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao ignorar alerta' });
  }
});

module.exports = roteador;
