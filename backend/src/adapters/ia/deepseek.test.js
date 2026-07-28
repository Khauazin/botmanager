const test = require('node:test');
const assert = require('node:assert');
const DeepSeekAdapter = require('./deepseek');

function criarAdapter() {
  return new DeepSeekAdapter({ credencial: { dados: { apiKey: 'sk-teste' } }, modo: 'fixture' });
}

test('modo fixture nao bate na rede e devolve resposta normalizada com tokens', async () => {
  const adapter = criarAdapter();
  const r = await adapter.responder({ mensagens: [{ role: 'user', content: 'oi' }] });
  assert.strictEqual(typeof r.texto, 'string');
  assert.ok(r.texto.length > 0);
  assert.strictEqual(r.tokensTotal, r.tokensPrompt + r.tokensCompletion);
  assert.ok(r.tokensTotal > 0);
});

test('mensagens vazio lanca erro tratavel (400, nao derruba o processo)', async () => {
  const adapter = criarAdapter();
  await assert.rejects(
    () => adapter.responder({ mensagens: [] }),
    (erro) => erro.codigo === 'IA_SEM_MENSAGENS' && erro.status === 400,
  );
});

test('modelo invalido cai pro modelo padrao em vez de quebrar', async () => {
  const adapter = criarAdapter();
  const r = await adapter.responder({ mensagens: [{ role: 'user', content: 'oi' }], modelo: 'gpt-4o-mini' });
  assert.strictEqual(r.bruto.model, 'deepseek-v4-flash');
});

test('modelo valido (pro) e respeitado', async () => {
  const adapter = criarAdapter();
  const r = await adapter.responder({ mensagens: [{ role: 'user', content: 'oi' }], modelo: 'deepseek-v4-pro' });
  assert.strictEqual(r.bruto.model, 'deepseek-v4-pro');
});
