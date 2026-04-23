const express = require('express');
const FinanceiroController = require('../controllers/FinanceiroController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Lançamentos
roteador.get('/lancamentos', FinanceiroController.listarLancamentos);
roteador.post('/lancamentos', FinanceiroController.criarLancamento);
roteador.patch('/lancamentos/:id/status', FinanceiroController.atualizarStatus);

// Categorias
roteador.get('/categorias', FinanceiroController.listarCategorias);
roteador.post('/categorias', FinanceiroController.criarCategoria);

module.exports = roteador;
