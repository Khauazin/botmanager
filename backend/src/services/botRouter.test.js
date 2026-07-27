const test = require('node:test');
const assert = require('node:assert');
const { montarResposta, ehSaudacao } = require('./botRouter');

// FAQs de exemplo: duas ativas + uma desativada (nao deve aparecer no menu).
const FAQS = [
  { ativo: true, ordem: 1, pergunta: 'Qual o horario de funcionamento?', resposta: 'Seg a Sex, 9h as 18h.' },
  { ativo: true, ordem: 2, pergunta: 'Voces fazem entrega?', resposta: 'Sim, entregamos na regiao.' },
  { ativo: false, ordem: 3, pergunta: 'FAQ desativada', resposta: 'nao deve aparecer' },
];

test('saudacao monta o menu numerado so com as FAQs ativas + opcao atendente', () => {
  const r = montarResposta({ texto: 'oi', faqs: FAQS });
  assert.match(r.texto, /Como posso ajudar/);
  assert.match(r.texto, /1\. Qual o horario/);
  assert.match(r.texto, /2\. Voces fazem entrega/);
  assert.match(r.texto, /3\. Falar com um atendente/); // 2 ativas + atendente
  assert.doesNotMatch(r.texto, /desativada/);           // inativa fica de fora
});

test('opcao numerica devolve a resposta da FAQ correspondente', () => {
  assert.strictEqual(montarResposta({ texto: '1', faqs: FAQS }).texto, 'Seg a Sex, 9h as 18h.');
  assert.strictEqual(montarResposta({ texto: '2', faqs: FAQS }).texto, 'Sim, entregamos na regiao.');
});

test('a ultima opcao (atendente) marca encaminhar para humano', () => {
  const r = montarResposta({ texto: '3', faqs: FAQS });
  assert.strictEqual(r.encaminhar, true);
});

test('casamento por texto acha a FAQ mesmo sem o numero', () => {
  assert.strictEqual(montarResposta({ texto: 'horario', faqs: FAQS }).texto, 'Seg a Sex, 9h as 18h.');
});

test('sem FAQ ativa devolve mensagem neutra em vez de quebrar', () => {
  assert.match(montarResposta({ texto: 'oi', faqs: [] }).texto, /ainda esta sendo configurado/);
});

test('texto desconhecido cai no fallback E reoferece o menu (nunca fica mudo)', () => {
  const r = montarResposta({ texto: 'asdfghjk', faqs: FAQS });
  assert.match(r.texto, /Nao entendi/);
  assert.match(r.texto, /1\. Qual o horario/); // o menu vem junto, nao só o "não entendi"
});

test('numero fora do intervalo cai no fallback (nao devolve FAQ errada)', () => {
  assert.match(montarResposta({ texto: '99', faqs: FAQS }).texto, /Nao entendi/);
});

test('ehSaudacao reconhece acento e caixa, e ignora frase comum', () => {
  assert.ok(ehSaudacao('Olá'));
  assert.ok(ehSaudacao('BOM DIA'));
  assert.ok(!ehSaudacao('quero comprar um produto'));
});

// FAQs com palavras-chave cadastradas (Etapa 4: motor de fluxo).
const FAQS_COM_CHAVES = [
  { ativo: true, ordem: 1, pergunta: 'Qual o horario de funcionamento?', resposta: 'Seg a Sex, 9h as 18h.', palavrasChave: ['que horas'] },
  { ativo: true, ordem: 2, pergunta: 'Voces fazem entrega?', resposta: 'Sim, entregamos na regiao.', palavrasChave: ['entrega'] },
];

test('palavra-chave de uma frase (2+ palavras) casa por trecho, mesmo sem bater com a pergunta', () => {
  // "vcs abrem que horas" nao tem nenhuma palavra em comum com a PERGUNTA
  // cadastrada ("horario de funcionamento") — sem a palavra-chave, cairia no
  // fallback. E exatamente o cenario que o cliente reportou como "horrivel".
  const r = montarResposta({ texto: 'vcs abrem que horas amanha', faqs: FAQS_COM_CHAVES });
  assert.strictEqual(r.texto, 'Seg a Sex, 9h as 18h.');
});

test('palavra-chave de uma palavra so casa por palavra inteira (nao por substring)', () => {
  const bate = montarResposta({ texto: 'voces fazem entrega no bairro?', faqs: FAQS_COM_CHAVES });
  assert.strictEqual(bate.texto, 'Sim, entregamos na regiao.');

  // "reentrega" contem "entrega" como substring, mas e outra palavra —
  // nao pode disparar a FAQ errada por coincidencia de caracteres.
  const naoBate = montarResposta({ texto: 'quero fazer uma reentrega', faqs: FAQS_COM_CHAVES });
  assert.match(naoBate.texto, /Nao entendi/);
});

test('sem palavra-chave cadastrada, o comportamento de antes continua igual', () => {
  // FAQS (sem palavrasChave) nao pode ganhar nem perder casamento so por eu
  // ter mexido no motor — regressao contra a Etapa 4.
  assert.strictEqual(montarResposta({ texto: 'horario', faqs: FAQS }).texto, 'Seg a Sex, 9h as 18h.');
});
