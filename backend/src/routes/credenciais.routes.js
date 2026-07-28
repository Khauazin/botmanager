// Leitura de credenciais (chaves de API) do tenant.
//
// A ESCRITA saiu daqui: cadastrar e alterar integracao passou a ser
// exclusividade do admin, em /admin/clientes/:clienteId/credenciais
// (admin-credenciais.routes.js). Esta rota ficou somente-leitura para alimentar
// as telas que precisam ESCOLHER uma credencial ja existente — o bot, o provedor
// de pagamento e o emissor fiscal. Nenhuma delas recebe o segredo, so a metadata.
//
// Politica:
//   - GET /credenciais/tipos — lista o enum TipoCredencial com schema.
//   - GET /credenciais — lista metadata (id, nome, tipo, ultimoUsoEm, ...).
//     `dadosCifrados`/`iv`/`tag` NUNCA saem da API.
//   - GET /credenciais/:id — metadata de uma credencial, sem segredos.
//   - POST / PUT / DELETE — bloqueados. Ver o fim do arquivo.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
// Whitelist de tipo, schema e semSegredos vivem no core (fonte unica, reusada
// pela rota admin — sem duplicar = sem divergir).
const {
  TIPOS_VALIDOS,
  CATEGORIA_POR_TIPO,
  SCHEMA_POR_TIPO,
  semSegredos,
} = require('../credenciaisCore');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

async function credencialDoTenant(id, usuario) {
  const where = ehAdmin(usuario)
    ? { id }
    : { id, clienteId: usuario.clienteId };
  return prisma.credencial.findFirst({ where });
}

// ==========================================
// META
// ==========================================
roteador.get('/tipos', (req, res) => {
  res.json(
    Array.from(TIPOS_VALIDOS)
      // DEEPSEEK_KEY e credencial de PLATAFORMA (uma so, da Sellergy) — nao
      // aparece aqui pra nao ser criada por engano escopada a um cliente.
      // Cadastro fica em /admin/plataforma/credencial-ia.
      .filter((tipo) => tipo !== 'DEEPSEEK_KEY')
      .map((tipo) => ({
        tipo,
        categoria: CATEGORIA_POR_TIPO[tipo] || 'Outro',
        schema: SCHEMA_POR_TIPO[tipo],
      }))
  );
});

// ==========================================
// LISTAR — metadata sem segredos
// ==========================================
roteador.get('/', requerPermissao('CONFIGURACOES', 'visualizar'), async (req, res) => {
  try {
    const where = ehAdmin(req.usuario) ? {} : { clienteId: req.usuario.clienteId };
    const itens = await prisma.credencial.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
    });
    res.json(itens.map(semSegredos));
  } catch (erro) {
    console.error('[credenciais/listar]', erro);
    res.status(500).json({ erro: 'Erro ao listar credenciais.' });
  }
});

// ==========================================
// DETALHAR — sem segredos
// ==========================================
roteador.get('/:id', requerPermissao('CONFIGURACOES', 'visualizar'), async (req, res) => {
  try {
    const c = await credencialDoTenant(req.params.id, req.usuario);
    if (!c) return res.status(404).json({ erro: 'Credencial nao encontrada.' });
    res.json(semSegredos(c));
  } catch (erro) {
    console.error('[credenciais/detalhar]', erro);
    res.status(500).json({ erro: 'Erro ao buscar credencial.' });
  }
});

// ==========================================
// ESCRITA — desativada nesta rota
// ==========================================
// Nenhuma tela do app do cliente cadastra integracao: quem faz isso e o admin.
// Sem estes bloqueios os verbos continuariam alcancaveis por chamada direta a
// API, permitindo que um usuario do tenant trocasse uma chave de pagamento sem
// passar por tela nenhuma — superficie de ataque sem contrapartida, e no
// processo mais sensivel do sistema.
//
// Respondem explicitamente, em vez de simplesmente deixarem de existir, por dois
// motivos: a tentativa fica registrada no log, e a decisao fica escrita aqui —
// quem for reintroduzir o CRUD por engano esbarra no comentario primeiro.
function escritaBloqueada(req, res) {
  console.warn(
    '[credenciais] escrita bloqueada',
    req.method,
    req.originalUrl,
    'usuario=', req.usuario?.id,
    'cliente=', req.usuario?.clienteId
  );
  return res.status(403).json({
    erro: 'As integrações são configuradas pelo administrador. Fale com o suporte para cadastrar ou alterar uma chave.',
  });
}

roteador.post('/', escritaBloqueada);
roteador.put('/:id', escritaBloqueada);
roteador.delete('/:id', escritaBloqueada);

module.exports = roteador;
