const test = require('node:test');
const assert = require('node:assert');
const CatalogoController = require('./CatalogoController');
const { validarCamposDevolucao } = CatalogoController;

test('temDevolucao=true em produto FISICO e aceito', () => {
  const r = validarCamposDevolucao({ tipoEfetivo: 'FISICO', temDevolucao: true, diasParaDevolucaoPadrao: undefined });
  assert.strictEqual(r.erro, undefined);
  assert.strictEqual(r.data.temDevolucao, true);
});

test('temDevolucao=true em produto SERVICO e rejeitado', () => {
  const r = validarCamposDevolucao({ tipoEfetivo: 'SERVICO', temDevolucao: true, diasParaDevolucaoPadrao: undefined });
  assert.ok(r.erro);
  assert.strictEqual(r.campo, 'temDevolucao');
});

test('temDevolucao=false em SERVICO e aceito (desligar sempre pode)', () => {
  const r = validarCamposDevolucao({ tipoEfetivo: 'SERVICO', temDevolucao: false, diasParaDevolucaoPadrao: undefined });
  assert.strictEqual(r.erro, undefined);
  assert.strictEqual(r.data.temDevolucao, false);
});

test('temDevolucao nao-booleano e rejeitado', () => {
  const r = validarCamposDevolucao({ tipoEfetivo: 'FISICO', temDevolucao: 'sim', diasParaDevolucaoPadrao: undefined });
  assert.ok(r.erro);
});

test('diasParaDevolucaoPadrao aceita inteiro positivo', () => {
  const r = validarCamposDevolucao({ tipoEfetivo: 'FISICO', temDevolucao: undefined, diasParaDevolucaoPadrao: 3 });
  assert.strictEqual(r.data.diasParaDevolucaoPadrao, 3);
});

test('diasParaDevolucaoPadrao null ou vazio limpa o campo', () => {
  const a = validarCamposDevolucao({ tipoEfetivo: 'FISICO', temDevolucao: undefined, diasParaDevolucaoPadrao: null });
  assert.strictEqual(a.data.diasParaDevolucaoPadrao, null);
  const b = validarCamposDevolucao({ tipoEfetivo: 'FISICO', temDevolucao: undefined, diasParaDevolucaoPadrao: '' });
  assert.strictEqual(b.data.diasParaDevolucaoPadrao, null);
});

test('diasParaDevolucaoPadrao <= 0 ou nao-numerico e rejeitado', () => {
  assert.ok(validarCamposDevolucao({ tipoEfetivo: 'FISICO', diasParaDevolucaoPadrao: 0 }).erro);
  assert.ok(validarCamposDevolucao({ tipoEfetivo: 'FISICO', diasParaDevolucaoPadrao: -2 }).erro);
  assert.ok(validarCamposDevolucao({ tipoEfetivo: 'FISICO', diasParaDevolucaoPadrao: 'abc' }).erro);
});

test('nenhum campo enviado nao gera erro nem data', () => {
  const r = validarCamposDevolucao({ tipoEfetivo: 'FISICO' });
  assert.strictEqual(r.erro, undefined);
  assert.deepStrictEqual(r.data, {});
});
