const test = require('node:test');
const assert = require('node:assert');
const { mesclarConversoes, formatarListaLeads, LIMITE_RECORRENTE } = require('./segmentacaoLeads');

test('LIMITE_RECORRENTE e 2 (2+ conversoes conta como fidelizado)', () => {
  assert.strictEqual(LIMITE_RECORRENTE, 2);
});

test('mesclarConversoes: lead so com venda', () => {
  const vendas = [{ leadId: 'l1', _count: { _all: 3 }, _sum: { valor: 300 }, _max: { data: new Date('2026-01-10') } }];
  const mapa = mesclarConversoes(vendas, []);
  const l1 = mapa.get('l1');
  assert.strictEqual(l1.compras, 3);
  assert.strictEqual(l1.atendimentos, 0);
  assert.strictEqual(l1.valorTotal, 300);
});

test('mesclarConversoes: lead so com atendimento (tenant de servico, sem venda)', () => {
  const agendamentos = [{ leadId: 'l2', _count: { _all: 2 }, _max: { data: new Date('2026-02-01') } }];
  const mapa = mesclarConversoes([], agendamentos);
  const l2 = mapa.get('l2');
  assert.strictEqual(l2.compras, 0);
  assert.strictEqual(l2.atendimentos, 2);
  assert.strictEqual(l2.valorTotal, 0);
});

test('mesclarConversoes: lead com venda E atendimento soma os dois, sem perder a compra', () => {
  const vendas = [{ leadId: 'l3', _count: { _all: 1 }, _sum: { valor: 100 }, _max: { data: new Date('2026-01-01') } }];
  const agendamentos = [{ leadId: 'l3', _count: { _all: 4 }, _max: { data: new Date('2026-03-01') } }];
  const mapa = mesclarConversoes(vendas, agendamentos);
  const l3 = mapa.get('l3');
  assert.strictEqual(l3.compras, 1);
  assert.strictEqual(l3.atendimentos, 4);
  assert.strictEqual(l3.valorTotal, 100);
});

test('mesclarConversoes: ultimaConversao pega a mais recente entre venda e atendimento', () => {
  const vendas = [{ leadId: 'l4', _count: { _all: 1 }, _sum: { valor: 50 }, _max: { data: new Date('2026-01-01') } }];
  const agendamentosDepois = [{ leadId: 'l4', _count: { _all: 1 }, _max: { data: new Date('2026-06-01') } }];
  const r1 = mesclarConversoes(vendas, agendamentosDepois).get('l4');
  assert.strictEqual(r1.ultimaConversao.getTime(), new Date('2026-06-01').getTime());

  const agendamentosAntes = [{ leadId: 'l4', _count: { _all: 1 }, _max: { data: new Date('2025-12-01') } }];
  const r2 = mesclarConversoes(vendas, agendamentosAntes).get('l4');
  assert.strictEqual(r2.ultimaConversao.getTime(), new Date('2026-01-01').getTime());
});

test('formatarListaLeads: junta com o lead, calcula totalConversoes e ordena pela mais recente', () => {
  const entradas = [
    { leadId: 'a', compras: 1, atendimentos: 0, valorTotal: 100, ultimaConversao: new Date('2026-01-01') },
    { leadId: 'b', compras: 2, atendimentos: 3, valorTotal: 500, ultimaConversao: new Date('2026-05-01') },
  ];
  const leads = [
    { id: 'a', nome: 'Ana', telefone: '111' },
    { id: 'b', nome: 'Bruno', telefone: '222' },
  ];
  const r = formatarListaLeads(entradas, leads);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].leadId, 'b'); // mais recente primeiro
  assert.strictEqual(r[0].totalConversoes, 5);
  assert.strictEqual(r[1].leadId, 'a');
  assert.strictEqual(r[1].totalConversoes, 1);
});

test('formatarListaLeads: ignora entrada sem lead correspondente (lead apagado/de outro tenant)', () => {
  const entradas = [{ leadId: 'fantasma', compras: 1, atendimentos: 0, valorTotal: 10, ultimaConversao: new Date() }];
  const r = formatarListaLeads(entradas, []);
  assert.deepStrictEqual(r, []);
});
