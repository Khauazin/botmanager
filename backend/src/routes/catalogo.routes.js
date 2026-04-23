const express = require('express');
const CatalogoController = require('../controllers/CatalogoController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', CatalogoController.listar);
roteador.post('/', CatalogoController.criar);
roteador.get('/:id', CatalogoController.buscarPorId);
roteador.put('/:id', CatalogoController.atualizar);
roteador.delete('/:id', CatalogoController.excluir);

module.exports = roteador;
