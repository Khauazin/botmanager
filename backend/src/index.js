require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const rotasAutenticacao = require('./routes/auth.routes');
const rotasClientes = require('./routes/clientes.routes');
const rotasBots = require('./routes/bots.routes');
const rotasAlertas = require('./routes/alertas.routes');
const rotasCRM = require('./routes/crm.routes');
const rotasBuilder = require('./routes/builder.routes');
const rotasBotVariables = require('./routes/bot-variables.routes');
const rotasUsuarios = require('./routes/usuarios.routes');
const rotasAgenda = require('./routes/agenda.routes');
const rotasCatalogo = require('./routes/catalogo.routes');
const rotasEstoque = require('./routes/estoque.routes');
const rotasFinanceiro = require('./routes/financeiro.routes');

const app = express();
const servidor = http.createServer(app);
const io = new Server(servidor, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());

// Injeção do Socket.io nas requisições
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rotas Base
app.use('/autenticacao', rotasAutenticacao);
app.use('/usuarios', rotasUsuarios);
app.use('/clientes', rotasClientes);
app.use('/bots', rotasBots);
app.use('/alertas', rotasAlertas);
app.use('/crm', rotasCRM);
app.use('/builder', rotasBuilder);
app.use('/bot-variables', rotasBotVariables);
app.use('/agenda', rotasAgenda);
app.use('/catalogo', rotasCatalogo);
app.use('/estoque', rotasEstoque);
app.use('/financeiro', rotasFinanceiro);

// Rota de Teste de Saúde (Health Check)
app.get('/saude', (req, res) => {
  res.json({ status: 'ok', data: new Date() });
});

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORTA = process.env.BACKEND_PORT || 3333;

servidor.listen(PORTA, () => {
  console.log(`🚀 Servidor rodando na porta ${PORTA}`);
});
