// Testa so as funcoes puras (chaveDeUrl/urlPublica) — sem bater no MinIO de
// verdade. As credenciais nao importam aqui (so afetam upload/pingar).
const test = require('node:test');
const assert = require('node:assert');
const { chaveDeUrl, urlPublica } = require('./minio');

test('urlPublica + chaveDeUrl sao inversas pra uma key simples', () => {
  const key = 'produtos/cliente1/abc.jpg';
  assert.strictEqual(chaveDeUrl(urlPublica(key)), key);
});

test('chaveDeUrl ignora query string (URL assinada acidentalmente tratada como canonica)', () => {
  const key = 'produtos/cliente1/temp/abc-123.jpg';
  const urlAssinadaFake = `${urlPublica(key)}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef&X-Amz-Expires=86400`;
  assert.strictEqual(chaveDeUrl(urlAssinadaFake), key);
});

test('chaveDeUrl devolve null pra URL que nao e do nosso storage', () => {
  assert.strictEqual(chaveDeUrl('https://outro-dominio.com/imagem.jpg'), null);
});

test('chaveDeUrl devolve null pra entrada invalida', () => {
  assert.strictEqual(chaveDeUrl(null), null);
  assert.strictEqual(chaveDeUrl(''), null);
  assert.strictEqual(chaveDeUrl(123), null);
});
