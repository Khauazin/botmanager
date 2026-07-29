const test = require('node:test');
const assert = require('node:assert');
const { limiteJanelaAviso } = require('./cronDevolucoes');

test('diasAvisoDevolucao=0 limita ao fim do dia atual', () => {
  const agora = new Date('2026-03-10T10:00:00');
  const limite = limiteJanelaAviso(0, agora);
  assert.strictEqual(limite.getDate(), 10);
  assert.strictEqual(limite.getHours(), 23);
  assert.strictEqual(limite.getMinutes(), 59);
});

test('diasAvisoDevolucao=1 estende o limite pro fim do dia seguinte', () => {
  const agora = new Date('2026-03-10T10:00:00');
  const limite = limiteJanelaAviso(1, agora);
  assert.strictEqual(limite.getDate(), 11);
});

test('diasAvisoDevolucao negativo ou ausente nao quebra (trata como 0)', () => {
  const agora = new Date('2026-03-10T10:00:00');
  assert.strictEqual(limiteJanelaAviso(-5, agora).getDate(), 10);
  assert.strictEqual(limiteJanelaAviso(undefined, agora).getDate(), 10);
});
