const test = require('node:test');
const assert = require('node:assert');
const VendaController = require('./VendaController');
const { validarClienteFinal, resolverDataDevolucao } = VendaController;

const CPF_VALIDO = '111.444.777-35';

test('validarClienteFinal aceita nome/telefone/cpf validos e normaliza pra so-digitos', () => {
  const r = validarClienteFinal({ nome: '  Ana Silva  ', telefone: '(11) 99999-8888', cpf: CPF_VALIDO });
  assert.strictEqual(r.erro, undefined);
  assert.strictEqual(r.nome, 'Ana Silva');
  assert.strictEqual(r.telefone, '11999998888');
  assert.strictEqual(r.cpf, '11144477735');
});

test('validarClienteFinal rejeita sem nome', () => {
  const r = validarClienteFinal({ nome: '', telefone: '11999998888', cpf: CPF_VALIDO });
  assert.ok(r.erro);
  assert.strictEqual(r.campo, 'clienteFinal.nome');
});

test('validarClienteFinal rejeita sem telefone', () => {
  const r = validarClienteFinal({ nome: 'Ana', telefone: '', cpf: CPF_VALIDO });
  assert.ok(r.erro);
  assert.strictEqual(r.campo, 'clienteFinal.telefone');
});

test('validarClienteFinal rejeita cpf invalido (digito verificador errado)', () => {
  const r = validarClienteFinal({ nome: 'Ana', telefone: '11999998888', cpf: '111.444.777-00' });
  assert.ok(r.erro);
  assert.strictEqual(r.campo, 'clienteFinal.cpf');
});

test('validarClienteFinal rejeita objeto ausente', () => {
  const r = validarClienteFinal(undefined);
  assert.ok(r.erro);
});

test('resolverDataDevolucao usa a data explicita quando informada e valida', () => {
  const agora = new Date('2026-01-01T00:00:00Z');
  const r = resolverDataDevolucao({ dataDevolucaoInput: '2026-01-10', diasParaDevolucaoPadrao: null, nomeProduto: 'Furadeira', agora });
  assert.strictEqual(r.erro, undefined);
  assert.ok(r.data instanceof Date);
  assert.strictEqual(r.data.toISOString().slice(0, 10), '2026-01-10');
});

test('resolverDataDevolucao rejeita data invalida', () => {
  const r = resolverDataDevolucao({ dataDevolucaoInput: 'nao-e-data', diasParaDevolucaoPadrao: null, nomeProduto: 'Furadeira' });
  assert.ok(r.erro);
});

test('resolverDataDevolucao rejeita data no passado ou igual a agora', () => {
  const agora = new Date('2026-01-10T12:00:00Z');
  const r = resolverDataDevolucao({ dataDevolucaoInput: '2026-01-05', diasParaDevolucaoPadrao: null, nomeProduto: 'Furadeira', agora });
  assert.ok(r.erro);
});

test('resolverDataDevolucao cai pro prazo padrao do produto quando a data nao vem', () => {
  const agora = new Date('2026-01-01T00:00:00Z');
  const r = resolverDataDevolucao({ dataDevolucaoInput: undefined, diasParaDevolucaoPadrao: 3, nomeProduto: 'Fantasia', agora });
  assert.strictEqual(r.erro, undefined);
  assert.strictEqual(r.data.toISOString(), '2026-01-04T00:00:00.000Z');
});

test('resolverDataDevolucao exige data manual quando nao ha data nem prazo padrao', () => {
  const r = resolverDataDevolucao({ dataDevolucaoInput: undefined, diasParaDevolucaoPadrao: null, nomeProduto: 'Fantasia' });
  assert.ok(r.erro);
  assert.match(r.erro, /Fantasia/);
});
