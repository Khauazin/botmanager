const test = require('node:test');
const assert = require('node:assert');
const { validarCupom, normalizarCodigo } = require('./cupomService');

const CUPOM_PERCENTUAL = { ativo: true, tipo: 'PERCENTUAL', valor: 10, validoAte: null, usoMaximo: null, usosAtuais: 0 };
const CUPOM_VALOR_FIXO = { ativo: true, tipo: 'VALOR', valor: 50, validoAte: null, usoMaximo: null, usosAtuais: 0 };

test('normalizarCodigo tira espaco e deixa maiusculo', () => {
  assert.strictEqual(normalizarCodigo('  promo10 '), 'PROMO10');
});

test('cupom inexistente e rejeitado', () => {
  const r = validarCupom({ cupom: null, valorTotal: 100 });
  assert.strictEqual(r.valido, false);
});

test('cupom inativo e rejeitado', () => {
  const r = validarCupom({ cupom: { ...CUPOM_PERCENTUAL, ativo: false }, valorTotal: 100 });
  assert.strictEqual(r.valido, false);
  assert.match(r.motivo, /inativo/i);
});

test('cupom expirado e rejeitado', () => {
  const agora = new Date('2026-06-01');
  const cupom = { ...CUPOM_PERCENTUAL, validoAte: new Date('2026-05-01') };
  const r = validarCupom({ cupom, valorTotal: 100, agora });
  assert.strictEqual(r.valido, false);
  assert.match(r.motivo, /expirado/i);
});

test('cupom dentro da validade e aceito', () => {
  const agora = new Date('2026-06-01');
  const cupom = { ...CUPOM_PERCENTUAL, validoAte: new Date('2026-12-31') };
  const r = validarCupom({ cupom, valorTotal: 100, agora });
  assert.strictEqual(r.valido, true);
});

test('cupom com limite de uso esgotado e rejeitado', () => {
  const cupom = { ...CUPOM_PERCENTUAL, usoMaximo: 5, usosAtuais: 5 };
  const r = validarCupom({ cupom, valorTotal: 100 });
  assert.strictEqual(r.valido, false);
  assert.match(r.motivo, /esgotado/i);
});

test('cupom com limite de uso ainda nao esgotado e aceito', () => {
  const cupom = { ...CUPOM_PERCENTUAL, usoMaximo: 5, usosAtuais: 4 };
  const r = validarCupom({ cupom, valorTotal: 100 });
  assert.strictEqual(r.valido, true);
});

test('desconto PERCENTUAL calcula corretamente', () => {
  const r = validarCupom({ cupom: CUPOM_PERCENTUAL, valorTotal: 200 });
  assert.strictEqual(r.valido, true);
  assert.strictEqual(r.valorDesconto, 20);
  assert.strictEqual(r.valorComDesconto, 180);
});

test('desconto VALOR fixo calcula corretamente', () => {
  const r = validarCupom({ cupom: CUPOM_VALOR_FIXO, valorTotal: 200 });
  assert.strictEqual(r.valido, true);
  assert.strictEqual(r.valorDesconto, 50);
  assert.strictEqual(r.valorComDesconto, 150);
});

test('desconto VALOR fixo nunca deixa a venda negativa (trava no total)', () => {
  const r = validarCupom({ cupom: CUPOM_VALOR_FIXO, valorTotal: 30 });
  assert.strictEqual(r.valido, true);
  assert.strictEqual(r.valorDesconto, 30);
  assert.strictEqual(r.valorComDesconto, 0);
});

test('valorTotal invalido (zero ou negativo) e rejeitado', () => {
  assert.strictEqual(validarCupom({ cupom: CUPOM_PERCENTUAL, valorTotal: 0 }).valido, false);
  assert.strictEqual(validarCupom({ cupom: CUPOM_PERCENTUAL, valorTotal: -10 }).valido, false);
});
