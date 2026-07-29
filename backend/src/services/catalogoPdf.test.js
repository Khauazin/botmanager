const test = require('node:test');
const assert = require('node:assert');
const { montarHtml, formatarPreco } = require('./catalogoPdf');

const PRODUTOS = [
  { nome: 'Camiseta', descricao: 'Algodao', imagemUrl: 'https://x/img.jpg', categoriaNome: 'Roupas', preco: 49.9 },
  { nome: 'Corte de cabelo', descricao: null, imagemUrl: null, categoriaNome: 'Servicos', preco: 60 },
];

test('formatarPreco devolve moeda BRL', () => {
  assert.strictEqual(formatarPreco(49.9), 'R$ 49,90');
});

test('montarHtml inclui o nome do negocio e os produtos', () => {
  const html = montarHtml({ nomeNegocio: 'Loja da Ana', produtos: PRODUTOS, config: null });
  assert.match(html, /Loja da Ana/);
  assert.match(html, /Camiseta/);
  assert.match(html, /Corte de cabelo/);
});

test('agrupa por categoria por padrao (config null usa o default)', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: null });
  assert.match(html, /Roupas/);
  assert.match(html, /Servicos/);
});

test('agruparPor NENHUM nao mostra titulo de secao', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: { agruparPor: 'NENHUM' } });
  assert.doesNotMatch(html, /<h2>Roupas<\/h2>/);
});

test('mostrarPreco=false esconde o preco', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: { mostrarPreco: false } });
  assert.doesNotMatch(html, /49,90/);
});

test('mostrarDescricao=true mostra a descricao quando existe', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: { mostrarDescricao: true } });
  assert.match(html, /Algodao/);
});

test('descricao vem ligada por padrao (config null ou sem o campo)', () => {
  const semConfig = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: null });
  assert.match(semConfig, /Algodao/);

  const configVazio = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: {} });
  assert.match(configVazio, /Algodao/);
});

test('mostrarDescricao=false esconde a descricao mesmo quando existe', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: { mostrarDescricao: false } });
  assert.doesNotMatch(html, /Algodao/);
});

// --- template: cada modelo tem sua propria estrutura, nao so CSS ---

test('template invalido ou ausente cai no padrao FOTOS_GRANDES (item-card)', () => {
  const semTemplate = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: null });
  assert.match(semTemplate, /item-card/);

  const templateInvalido = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: { template: 'GIGANTE_3D' } });
  assert.match(templateInvalido, /item-card/);
});

test('LISTA_COMPACTA monta linhas (item-linha), nao cards', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: { template: 'LISTA_COMPACTA' } });
  assert.match(html, /class="item item-linha"/);
  // O CSS de .item-card fica sempre na folha de estilo (nao muda por request),
  // o que nao deve aparecer e o elemento de verdade com essa classe.
  assert.doesNotMatch(html, /class="item item-card"/);
});

test('MINIMALISTA nunca mostra foto nem descricao, mesmo com os toggles ligados', () => {
  const produtosComFoto = [
    { nome: 'Camiseta', descricao: 'Algodao', imagemUrl: 'https://x/img.jpg', categoriaNome: 'Roupas', preco: 49.9 },
  ];
  const html = montarHtml({
    nomeNegocio: 'Loja',
    produtos: produtosComFoto,
    config: { template: 'MINIMALISTA', mostrarFoto: true, mostrarDescricao: true },
  });
  assert.match(html, /item-minimo/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /Algodao/);
  assert.match(html, /Camiseta/);
});

test('cor de destaque invalida cai no padrao em vez de injetar CSS quebrado', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: PRODUTOS, config: { corDestaque: 'javascript:alert(1)' } });
  assert.match(html, /#2563EB/);
  assert.doesNotMatch(html, /javascript:/);
});

test('nomes e descricoes sao escapados (anti-injecao no HTML do PDF)', () => {
  const produtosMaliciosos = [{ nome: '<script>alert(1)</script>', descricao: null, imagemUrl: null, categoriaNome: null, preco: 10 }];
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: produtosMaliciosos, config: { agruparPor: 'NENHUM' } });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('catalogo vazio nao quebra — mostra mensagem em vez de secao vazia', () => {
  const html = montarHtml({ nomeNegocio: 'Loja', produtos: [], config: null });
  assert.match(html, /Nenhum produto cadastrado/);
});
