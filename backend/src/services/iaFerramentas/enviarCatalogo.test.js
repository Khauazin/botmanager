const test = require('node:test');
const assert = require('node:assert');
const { produtoVisivelNoCatalogo } = require('./enviarCatalogo');

const FISICO_COM_ESTOQUE = { tipo: 'FISICO', variacoes: [{ estoqueAtual: 3 }] };
const FISICO_SEM_ESTOQUE = { tipo: 'FISICO', variacoes: [{ estoqueAtual: 0 }] };
const SERVICO = { tipo: 'SERVICO', variacoes: [{ estoqueAtual: 0 }] };

test('FISICO sem estoque some do catalogo quando ocultarSemEstoque esta ligado (padrao)', () => {
  assert.strictEqual(produtoVisivelNoCatalogo(FISICO_SEM_ESTOQUE, null), false);
  assert.strictEqual(produtoVisivelNoCatalogo(FISICO_SEM_ESTOQUE, { ocultarSemEstoque: true }), false);
});

test('FISICO com estoque continua visivel', () => {
  assert.strictEqual(produtoVisivelNoCatalogo(FISICO_COM_ESTOQUE, null), true);
});

test('ocultarSemEstoque=false mostra mesmo sem estoque', () => {
  assert.strictEqual(produtoVisivelNoCatalogo(FISICO_SEM_ESTOQUE, { ocultarSemEstoque: false }), true);
});

test('SERVICO nunca e ocultado por estoque (nao controla quantidade)', () => {
  assert.strictEqual(produtoVisivelNoCatalogo(SERVICO, null), true);
  assert.strictEqual(produtoVisivelNoCatalogo(SERVICO, { ocultarSemEstoque: true }), true);
});
