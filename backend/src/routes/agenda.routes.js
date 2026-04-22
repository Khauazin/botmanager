const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Listar agendamentos do cliente logado
roteador.get('/', async (req, res) => {
  try {
    const { clientId } = req.usuario;
    const { month, year, date } = req.query;

    if (!clientId) {
      return res.status(403).json({ erro: 'Apenas clientes podem acessar a agenda' });
    }

    let filtroData = {};

    // Se passou uma data específica (YYYY-MM-DD)
    if (date) {
      const inicioDia = new Date(date);
      inicioDia.setHours(0, 0, 0, 0);
      const fimDia = new Date(date);
      fimDia.setHours(23, 59, 59, 999);
      filtroData = { gte: inicioDia, lte: fimDia };
    }
    // Se passou mês e ano
    else if (month && year) {
      const inicioMes = new Date(year, month - 1, 1);
      const fimMes = new Date(year, month, 0, 23, 59, 59, 999);
      filtroData = { gte: inicioMes, lte: fimMes };
    }

    const agendamentos = await prisma.appointment.findMany({
      where: {
        clientId,
        date: filtroData
      },
      include: {
        lead: {
          select: { name: true, phone: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    res.json(agendamentos);
  } catch (erro) {
    console.error('Erro ao listar agenda:', erro);
    res.status(500).json({ erro: 'Erro ao carregar agenda' });
  }
});

// Criar novo agendamento
roteador.post('/', async (req, res) => {
  try {
    let { clientId } = req.usuario;
    const { leadId, customerName, customerPhone, date, duration, service, price, notes, origin, clientId: bodyClientId } = req.body;

    // Se o usuário logado não tem clientId (é ADMIN), tenta pegar do body ou do leadId
    if (!clientId && req.usuario.role === 'ADMIN') {
      if (bodyClientId) {
        clientId = bodyClientId;
      } else if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) clientId = lead.clientId;
      }
    }

    if (!clientId) {
      return res.status(403).json({ erro: 'Ação não permitida' });
    }

    const novoAgendamento = await prisma.appointment.create({
      data: {
        clientId,
        leadId: leadId || null,
        customerName,
        customerPhone,
        date: new Date(date),
        duration: parseInt(duration) || 30,
        service,
        price: parseFloat(price) || 0,
        notes,
        origin: origin || 'MANUAL',
        status: 'PENDING'
      }
    });

    // Se tiver leadId, registra no histórico do Lead
    if (leadId) {
      await prisma.leadHistory.create({
        data: {
          leadId,
          action: 'EDITADO',
          notes: `Novo agendamento criado: ${service} em ${new Date(date).toLocaleString()}`
        }
      });
    }

    res.status(201).json(novoAgendamento);
  } catch (erro) {
    console.error('Erro ao criar agendamento:', erro);
    res.status(500).json({ erro: 'Erro ao salvar agendamento' });
  }
});

// Atualizar agendamento
roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.usuario;
    const dados = req.body;

    // Converte datas e números se presentes
    if (dados.date) dados.date = new Date(dados.date);
    if (dados.price) dados.price = parseFloat(dados.price);
    if (dados.duration) dados.duration = parseInt(dados.duration);

    const atualizado = await prisma.appointment.update({
      where: { id, clientId },
      data: dados
    });

    res.json(atualizado);
  } catch (erro) {
    console.error('Erro ao atualizar agendamento:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar agendamento' });
  }
});

// Excluir agendamento
roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.usuario;

    await prisma.appointment.delete({
      where: { id, clientId }
    });

    res.status(204).send();
  } catch (erro) {
    console.error('Erro ao excluir agendamento:', erro);
    res.status(500).json({ erro: 'Erro ao excluir agendamento' });
  }
});

roteador.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.usuario;
    const { status } = req.body;

    const statusValidos = ['PENDING', 'CONFIRMED', 'CANCELED', 'COMPLETED'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    const atualizado = await prisma.appointment.update({
      where: { id, clientId },
      data: { status }
    });

    res.json(atualizado);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao mudar status' });
  }
});

module.exports = roteador;
