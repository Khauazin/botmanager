const test = require('node:test');
const assert = require('node:assert');
const DeepSeekAdapter = require('./deepseek');
const { normalizarResposta } = DeepSeekAdapter;

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

// --- normalizarResposta: parsing do tool calling (formato OpenAI) ---

test('normalizarResposta extrai tool_calls e faz parse dos argumentos', () => {
  const raw = {
    choices: [{
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'consultar_estoque', arguments: '{"produto":"camiseta azul"}' },
        }],
      },
    }],
    usage: { prompt_tokens: 200, completion_tokens: 20, total_tokens: 220 },
  };
  const r = normalizarResposta(raw);
  assert.strictEqual(r.toolCalls.length, 1);
  assert.strictEqual(r.toolCalls[0].id, 'call_1');
  assert.strictEqual(r.toolCalls[0].nome, 'consultar_estoque');
  assert.deepStrictEqual(r.toolCalls[0].argumentos, { produto: 'camiseta azul' });
  assert.strictEqual(r.tokensTotal, 220);
});

test('normalizarResposta sem tool_calls devolve array vazio (resposta de texto normal)', () => {
  const raw = { choices: [{ message: { role: 'assistant', content: 'Oi! Como posso ajudar?' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
  const r = normalizarResposta(raw);
  assert.strictEqual(r.toolCalls.length, 0);
  assert.strictEqual(r.texto, 'Oi! Como posso ajudar?');
});

test('normalizarResposta com argumentos malformados nao lanca — trata como vazio', () => {
  const raw = {
    choices: [{ message: { tool_calls: [{ id: 'call_2', function: { name: 'x', arguments: '{invalido' } }] } }],
    usage: {},
  };
  const r = normalizarResposta(raw);
  assert.deepStrictEqual(r.toolCalls[0].argumentos, {});
});
