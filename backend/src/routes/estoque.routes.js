const express = require('express');
const EstoqueController = require('../controllers/EstoqueController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/movimentacoes', EstoqueController.listarMovimentacoes);
roteador.get('/saldo/:variacaoId', EstoqueController.buscarSaldoPorVariacao);
roteador.post('/movimentar', (req, res) => EstoqueController.registrarMovimentacao(req, res));
roteador.post('/reservar', (req, res) => EstoqueController.reservarEstoque(req, res));

module.exports = roteador;
