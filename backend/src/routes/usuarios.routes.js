const express = require('express');
const { PrismaClient } = require('@prisma/client');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');

const router = express.Router();
const prisma = new PrismaClient();

// Todas as rotas de usuários exigem autenticação
router.use(middlewareAutenticacao);

// Listar todos os usuários
router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      }
    });
    res.json(usuarios);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao buscar usuários' });
  }
});

// Criar novo usuário (Admin)
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const usuarioExistente = await prisma.user.findUnique({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Este e-mail já está em uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHasheada = await bcrypt.hash(password, salt);

    const novoUsuario = await prisma.user.create({
      data: {
        name,
        email,
        password: senhaHasheada,
        role: role || 'ADMIN',
      },
      select: { id: true, name: true, email: true, role: true }
    });

    res.status(201).json(novoUsuario);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// Atualizar usuário
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  try {
    const dataToUpdate = { name, email, role };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.password = await bcrypt.hash(password, salt);
    }

    const usuarioAtualizado = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, name: true, email: true, role: true }
    });

    res.json(usuarioAtualizado);
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Este e-mail já está em uso' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

// Excluir usuário
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  if (id === req.usuarioId) {
    return res.status(400).json({ erro: 'Você não pode excluir a si mesmo' });
  }

  try {
    await prisma.user.delete({ where: { id } });
    res.json({ mensagem: 'Usuário excluído com sucesso' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao excluir usuário' });
  }
});

module.exports = router;
