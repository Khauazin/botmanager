const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();

roteador.post('/registrar', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const usuarioExiste = await prisma.user.findUnique({ where: { email } });
    if (usuarioExiste) {
      return res.status(400).json({ erro: 'E-mail já cadastrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHasheada = await bcrypt.hash(password, salt);

    const usuario = await prisma.user.create({
      data: {
        name,
        email,
        password: senhaHasheada,
      },
    });

    res.status(201).json({ id: usuario.id, name: usuario.name, email: usuario.email });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
});

roteador.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const usuario = await prisma.user.findUnique({ where: { email } });
    
    if (!usuario) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }

    // Tenta validar com bcrypt
    let senhaValida = false;
    try {
      senhaValida = await bcrypt.compare(password, usuario.password);
    } catch (e) {
      senhaValida = false;
    }

    // Fallback: Se for a senha antiga em base64 (gerada antes da atualização)
    if (!senhaValida) {
      const hashAntigo = Buffer.from(password).toString('base64');
      if (usuario.password === hashAntigo) {
        senhaValida = true;
        // Atualiza a senha no banco para o novo padrão bcrypt
        const salt = await bcrypt.genSalt(10);
        const novaSenhaHashed = await bcrypt.hash(password, salt);
        await prisma.user.update({
          where: { id: usuario.id },
          data: { password: novaSenhaHashed }
        });
      }
    }

    if (!senhaValida) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: usuario.id, role: usuario.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key_botmanager_2024',
      { expiresIn: '7d' }
    );

    res.json({
      usuario: { id: usuario.id, name: usuario.name, email: usuario.email, role: usuario.role },
      token
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

roteador.get('/perfil', middlewareAutenticacao, async (req, res) => {
  try {
    const usuario = await prisma.user.findUnique({ where: { id: req.usuarioId } });
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    
    res.json({ id: usuario.id, name: usuario.name, email: usuario.email, role: usuario.role });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar perfil' });
  }
});

module.exports = roteador;
