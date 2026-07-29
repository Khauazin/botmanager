const test = require('node:test');
const assert = require('node:assert');
const { calcularExcedente, periodoAtual, processarComFerramentas } = require('./iaRouter');

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

// --- processarComFerramentas: loop de tool calling ---
// chamarIA/executarFerramenta sao injetados (fakes) — testa o LOOP em si,
// sem precisar da DeepSeek nem do banco de verdade.

test('sem tool_calls: devolve a resposta de texto direto, sem chamar ferramenta nenhuma', async () => {
  const chamarIA = async () => ({ texto: 'Oi! Tudo bem?', toolCalls: [], tokensTotal: 50 });
  const executarFerramenta = async () => { throw new Error('nao deveria ser chamado'); };

  const r = await processarComFerramentas({ mensagens: [{ role: 'user', content: 'oi' }], chamarIA, executarFerramenta });
  assert.strictEqual(r.texto, 'Oi! Tudo bem?');
  assert.strictEqual(r.tokensTotal, 50);
});

test('1 tool_call: executa a ferramenta e faz uma segunda chamada pra resposta final', async () => {
  let chamadas = 0;
  const chamarIA = async (historico) => {
    chamadas++;
    if (chamadas === 1) {
      // 1a chamada: pede a ferramenta.
      assert.strictEqual(historico[historico.length - 1].content, 'quero camiseta azul');
      return { texto: null, toolCalls: [{ id: 'call_1', nome: 'consultar_estoque', argumentos: { produto: 'camiseta azul' } }], tokensTotal: 100 };
    }
    // 2a chamada: ja tem a resposta da ferramenta no historico -> resposta final.
    const msgTool = historico.find((m) => m.role === 'tool');
    assert.ok(msgTool, 'deveria ter injetado a mensagem role:tool no historico');
    const resultado = JSON.parse(msgTool.content);
    return { texto: `Temos ${resultado.itens[0].quantidade} unidades!`, toolCalls: [], tokensTotal: 60 };
  };
  const executarFerramenta = async (nome, argumentos) => {
    assert.strictEqual(nome, 'consultar_estoque');
    assert.deepStrictEqual(argumentos, { produto: 'camiseta azul' });
    return { encontrado: true, itens: [{ produto: 'Camiseta', variacao: 'Azul', quantidade: 7 }] };
  };

  const r = await processarComFerramentas({ mensagens: [{ role: 'user', content: 'quero camiseta azul' }], chamarIA, executarFerramenta });
  assert.strictEqual(r.texto, 'Temos 7 unidades!');
  assert.strictEqual(r.tokensTotal, 160); // soma das 2 chamadas
  assert.strictEqual(chamadas, 2);
});

test('ferramenta que lanca excecao vira resultado de erro pra IA (nao derruba o loop)', async () => {
  let chamadas = 0;
  const chamarIA = async () => {
    chamadas++;
    if (chamadas === 1) return { texto: null, toolCalls: [{ id: 'call_1', nome: 'x', argumentos: {} }], tokensTotal: 10 };
    return { texto: 'Desculpe, algo deu errado.', toolCalls: [], tokensTotal: 10 };
  };
  const executarFerramenta = async () => { throw new Error('falha simulada'); };

  const r = await processarComFerramentas({ mensagens: [{ role: 'user', content: 'oi' }], chamarIA, executarFerramenta });
  assert.strictEqual(r.texto, 'Desculpe, algo deu errado.');
  assert.strictEqual(chamadas, 2);
});

test('estoura o teto de iteracoes sem resposta final: corta o loop em vez de rodar pra sempre', async () => {
  let chamadas = 0;
  // Sempre pede ferramenta, nunca devolve resposta final — simula um modelo insistente.
  const chamarIA = async () => {
    chamadas++;
    return { texto: null, toolCalls: [{ id: `call_${chamadas}`, nome: 'x', argumentos: {} }], tokensTotal: 10 };
  };
  const executarFerramenta = async () => ({ ok: true });

  const r = await processarComFerramentas({ mensagens: [{ role: 'user', content: 'oi' }], chamarIA, executarFerramenta });
  assert.strictEqual(r.limiteAtingido, true);
  assert.ok(chamadas <= 4, `deveria parar no teto (chamou ${chamadas} vezes)`);
  assert.match(r.texto, /Nao consegui concluir/);
});
