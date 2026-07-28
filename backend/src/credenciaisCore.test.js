// Testes do núcleo de credenciais (segurança): whitelist limpa, validação de
// payload e "semSegredos". Rodar com: node --test

const { test } = require('node:test');
const assert = require('node:assert');
const {
  TIPOS_VALIDOS, CATEGORIA_POR_TIPO, validarPayload, semSegredos,
} = require('./credenciaisCore');

test('whitelist tem as integrações do escopo + DeepSeek (HTTP genérico fora)', () => {
  assert.equal(TIPOS_VALIDOS.size, 7);
  for (const t of ['MERCADO_PAGO_KEY', 'ASAAS_KEY', 'PAGARME_KEY', 'FOCUS_NFE_KEY', 'NUVEM_FISCAL_KEY', 'WHATSAPP_CLOUD_TOKEN', 'DEEPSEEK_KEY']) {
    assert.ok(TIPOS_VALIDOS.has(t), `${t} deveria estar`);
  }
  for (const t of ['HTTP_BEARER', 'HTTP_BASIC', 'HTTP_API_KEY', 'OUTRO', 'OPENAI_API_KEY']) {
    assert.ok(!TIPOS_VALIDOS.has(t), `${t} deveria ter saído`);
  }
});

test('validarPayload: tipo fora da whitelist, campo faltando, vazio e gigante', () => {
  assert.ok(validarPayload('OUTRO', {}).erro);                                  // tipo removido
  assert.ok(validarPayload('MERCADO_PAGO_KEY', {}).erro);                        // falta accessToken
  assert.ok(validarPayload('MERCADO_PAGO_KEY', { accessToken: '   ' }).erro);    // só espaço
  assert.ok(validarPayload('MERCADO_PAGO_KEY', { accessToken: 'x'.repeat(9000) }).erro); // gigante (anti-abuso)
  assert.ok(validarPayload('MERCADO_PAGO_KEY', { accessToken: 'APP-123' }).ok);  // válido
});

test('semSegredos remove dadosCifrados/iv/tag (nunca sai da API)', () => {
  const r = semSegredos({
    id: '1', nome: 'MP', tipo: 'MERCADO_PAGO_KEY',
    dadosCifrados: Buffer.from('x'), iv: Buffer.from('y'), tag: Buffer.from('z'),
  });
  assert.equal(r.dadosCifrados, undefined);
  assert.equal(r.iv, undefined);
  assert.equal(r.tag, undefined);
  assert.equal(r.nome, 'MP'); // metadata continua
});

test('categoria mapeada pra agrupar na UI', () => {
  assert.equal(CATEGORIA_POR_TIPO.MERCADO_PAGO_KEY, 'Pagamento');
  assert.equal(CATEGORIA_POR_TIPO.NUVEM_FISCAL_KEY, 'Fiscal');
  assert.equal(CATEGORIA_POR_TIPO.WHATSAPP_CLOUD_TOKEN, 'WhatsApp');
  assert.equal(CATEGORIA_POR_TIPO.DEEPSEEK_KEY, 'IA');
});

test('DeepSeek so exige apiKey', () => {
  assert.ok(validarPayload('DEEPSEEK_KEY', { apiKey: 'sk-abc123' }).ok);
  assert.ok(validarPayload('DEEPSEEK_KEY', {}).erro);
});

test('WhatsApp so exige o accessToken — phoneNumberId nao e lido por nenhum adapter', () => {
  // Regressao: phoneNumberId/businessAccountId chegaram a ser pedidos aqui, mas
  // o roteamento de verdade usa Bot.identificadorCanal, nunca a credencial. Pedir
  // de novo so recria a confusao (dois lugares pro mesmo dado, um deles morto).
  assert.ok(validarPayload('WHATSAPP_CLOUD_TOKEN', { accessToken: 'EAAxyz' }).ok);
  assert.ok(validarPayload('WHATSAPP_CLOUD_TOKEN', {}).erro);
});
