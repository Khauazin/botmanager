const test = require('node:test');
const assert = require('node:assert');
const { calcularExcedente, periodoAtual } = require('./iaRouter');

test('dentro do limite: sem excedente, sem cobranca', () => {
  const r = calcularExcedente({ totalTokens: 80_000, tokensIncluidosMes: 100_000, precoPorMilCentavos: 8 });
  assert.strictEqual(r.tokensExcedentes, 0);
  assert.strictEqual(r.valorExcedenteCentavos, 0);
});

test('exatamente no limite: ainda sem excedente', () => {
  const r = calcularExcedente({ totalTokens: 100_000, tokensIncluidosMes: 100_000, precoPorMilCentavos: 8 });
  assert.strictEqual(r.tokensExcedentes, 0);
});

test('passou do limite: cobra so a diferenca, nao o total', () => {
  // 120.000 usados, 100.000 inclusos -> 20.000 excedentes -> 20 milhares * 8 centavos = 160 centavos
  const r = calcularExcedente({ totalTokens: 120_000, tokensIncluidosMes: 100_000, precoPorMilCentavos: 8 });
  assert.strictEqual(r.tokensExcedentes, 20_000);
  assert.strictEqual(r.valorExcedenteCentavos, 160);
});

test('fracao de milhar arredonda o valor cobrado (nao trunca nem sobra centavo)', () => {
  // 500 tokens excedentes = 0,5 milhar * 8 centavos = 4 centavos exatos
  const a = calcularExcedente({ totalTokens: 100_500, tokensIncluidosMes: 100_000, precoPorMilCentavos: 8 });
  assert.strictEqual(a.valorExcedenteCentavos, 4);

  // 100.300 tokens -> 300 excedentes -> 0,3 milhar * 8 = 2,4 -> arredonda pra 2
  const b = calcularExcedente({ totalTokens: 100_300, tokensIncluidosMes: 100_000, precoPorMilCentavos: 8 });
  assert.strictEqual(b.valorExcedenteCentavos, 2);
});

test('tokensIncluidosMes maior que o uso nunca gera excedente negativo', () => {
  const r = calcularExcedente({ totalTokens: 0, tokensIncluidosMes: 100_000, precoPorMilCentavos: 8 });
  assert.strictEqual(r.tokensExcedentes, 0);
  assert.strictEqual(r.valorExcedenteCentavos, 0);
});

test('periodoAtual devolve AAAA-MM com mes sempre com 2 digitos', () => {
  assert.match(periodoAtual(), /^\d{4}-\d{2}$/);
});
