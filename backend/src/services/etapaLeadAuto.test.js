const test = require('node:test');
const assert = require('node:assert/strict');
const { fecharLeadAutomatico, reabrirLeadSeFechado, SLUG_FECHADO, SLUG_REABERTO } = require('./etapaLeadAuto');

const CLIENTE_ID = 'cliente-1';
const LEAD_ID = 'lead-1';

// Fake do client Prisma (comum ou de transacao — mesma interface). So o
// suficiente pra exercitar a logica de transicao sem precisar de banco real.
function criarTxFake({ lead, etapasExistentes = [] } = {}) {
  const etapas = [...etapasExistentes];
  const historico = [];
  let leadAtual = lead;

  return {
    _historico: historico,
    _etapas: etapas,
    _leadAtual: () => leadAtual,
    lead: {
      findFirst: async ({ where }) => {
        if (!leadAtual || leadAtual.id !== where.id || leadAtual.clienteId !== where.clienteId) return null;
        const etapa = etapas.find((e) => e.id === leadAtual.etapaId) || null;
        return { ...leadAtual, etapa };
      },
      update: async ({ where, data }) => {
        leadAtual = { ...leadAtual, ...data };
        const etapa = etapas.find((e) => e.id === leadAtual.etapaId) || null;
        return { ...leadAtual, etapa };
      },
    },
    etapaLead: {
      findUnique: async ({ where }) => {
        const { clienteId, slug } = where.clienteId_slug;
        return etapas.find((e) => e.clienteId === clienteId && e.slug === slug) || null;
      },
      findFirst: async ({ where }) => {
        const doTenant = etapas.filter((e) => e.clienteId === where.clienteId);
        if (doTenant.length === 0) return null;
        return doTenant.reduce((a, b) => (a.ordem > b.ordem ? a : b));
      },
      create: async ({ data }) => {
        const nova = { id: `etapa-${etapas.length + 1}`, ...data };
        etapas.push(nova);
        return nova;
      },
    },
    historicoLead: {
      create: async ({ data }) => {
        historico.push(data);
        return { id: `hist-${historico.length}`, ...data };
      },
    },
  };
}

test('fecharLeadAutomatico cria a etapa fechado-ganho se o tenant nunca habilitou', async () => {
  const tx = criarTxFake({ lead: { id: LEAD_ID, clienteId: CLIENTE_ID, etapaId: null } });
  const atualizado = await fecharLeadAutomatico(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'venda concluida' });

  assert.equal(atualizado.etapa.slug, SLUG_FECHADO);
  assert.equal(tx._etapas.length, 1);
  assert.equal(tx._historico.length, 1);
  assert.equal(tx._historico[0].acao, 'MOVIDO');
  assert.equal(tx._historico[0].paraEtapa, 'Fechado - Ganho');
});

test('fecharLeadAutomatico reaproveita a etapa se o tenant ja tem', async () => {
  const etapaExistente = { id: 'etapa-x', clienteId: CLIENTE_ID, slug: SLUG_FECHADO, nome: 'Fechado - Ganho (custom)', ordem: 5 };
  const tx = criarTxFake({ lead: { id: LEAD_ID, clienteId: CLIENTE_ID, etapaId: null }, etapasExistentes: [etapaExistente] });

  const atualizado = await fecharLeadAutomatico(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'venda concluida' });

  assert.equal(atualizado.etapaId, 'etapa-x');
  assert.equal(tx._etapas.length, 1); // nao criou etapa duplicada
});

test('fecharLeadAutomatico e idempotente: nao duplica historico se ja esta fechado', async () => {
  const etapaFechado = { id: 'etapa-fechado', clienteId: CLIENTE_ID, slug: SLUG_FECHADO, nome: 'Fechado - Ganho', ordem: 1 };
  const tx = criarTxFake({
    lead: { id: LEAD_ID, clienteId: CLIENTE_ID, etapaId: 'etapa-fechado' },
    etapasExistentes: [etapaFechado],
  });

  await fecharLeadAutomatico(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'venda concluida' });

  assert.equal(tx._historico.length, 0);
});

test('fecharLeadAutomatico ignora leadId nulo (venda sem cliente identificado)', async () => {
  const tx = criarTxFake({ lead: null });
  const resultado = await fecharLeadAutomatico(tx, { clienteId: CLIENTE_ID, leadId: null, motivo: 'venda concluida' });
  assert.equal(resultado, null);
  assert.equal(tx._historico.length, 0);
});

test('reabrirLeadSeFechado move de fechado-ganho pra em-contato', async () => {
  const etapaFechado = { id: 'etapa-fechado', clienteId: CLIENTE_ID, slug: SLUG_FECHADO, nome: 'Fechado - Ganho', ordem: 6 };
  const tx = criarTxFake({
    lead: { id: LEAD_ID, clienteId: CLIENTE_ID, etapaId: 'etapa-fechado' },
    etapasExistentes: [etapaFechado],
  });

  const atualizado = await reabrirLeadSeFechado(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'novo contato' });

  assert.equal(atualizado.etapa.slug, SLUG_REABERTO);
  assert.equal(tx._historico[0].deEtapa, 'Fechado - Ganho');
  assert.equal(tx._historico[0].paraEtapa, 'Em contato');
});

test('reabrirLeadSeFechado avanca lead "novo" pra "em-contato" (primeiro contato)', async () => {
  const etapaNovo = { id: 'etapa-novo', clienteId: CLIENTE_ID, slug: 'novo', nome: 'Novo', ordem: 1 };
  const tx = criarTxFake({
    lead: { id: LEAD_ID, clienteId: CLIENTE_ID, etapaId: 'etapa-novo' },
    etapasExistentes: [etapaNovo],
  });

  const atualizado = await reabrirLeadSeFechado(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'primeiro contato' });

  assert.equal(atualizado.etapa.slug, SLUG_REABERTO);
});

test('reabrirLeadSeFechado tambem reabre a partir de fechado-perdido', async () => {
  const etapaPerdido = { id: 'etapa-perdido', clienteId: CLIENTE_ID, slug: 'fechado-perdido', nome: 'Fechado - Perdido', ordem: 7 };
  const tx = criarTxFake({
    lead: { id: LEAD_ID, clienteId: CLIENTE_ID, etapaId: 'etapa-perdido' },
    etapasExistentes: [etapaPerdido],
  });

  const atualizado = await reabrirLeadSeFechado(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'novo contato' });

  assert.equal(atualizado.etapa.slug, SLUG_REABERTO);
});

test('reabrirLeadSeFechado nao mexe em lead que esta em outra etapa manual', async () => {
  const etapaNegociacao = { id: 'etapa-neg', clienteId: CLIENTE_ID, slug: 'em-negociacao', nome: 'Em negociacao', ordem: 4 };
  const tx = criarTxFake({
    lead: { id: LEAD_ID, clienteId: CLIENTE_ID, etapaId: 'etapa-neg' },
    etapasExistentes: [etapaNegociacao],
  });

  const resultado = await reabrirLeadSeFechado(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'novo contato' });

  assert.equal(resultado, null);
  assert.equal(tx._historico.length, 0);
  assert.equal(tx._leadAtual().etapaId, 'etapa-neg'); // nao mudou
});

test('reabrirLeadSeFechado ignora lead de outro tenant', async () => {
  const etapaFechado = { id: 'etapa-fechado', clienteId: 'outro-cliente', slug: SLUG_FECHADO, nome: 'Fechado - Ganho', ordem: 1 };
  const tx = criarTxFake({
    lead: { id: LEAD_ID, clienteId: 'outro-cliente', etapaId: 'etapa-fechado' },
    etapasExistentes: [etapaFechado],
  });

  const resultado = await reabrirLeadSeFechado(tx, { clienteId: CLIENTE_ID, leadId: LEAD_ID, motivo: 'novo contato' });
  assert.equal(resultado, null);
});
