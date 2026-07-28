// Factory da camada de IA: resolve o adapter pelo nome do provedor.
// So a DeepSeek hoje, mas segue o mesmo padrao de adapters/pagamento e
// adapters/fiscal — trocar/adicionar provedor nao mexe no motor de decisao
// (services/iaRouter.js).

const { ProvedorIA } = require('./ProvedorIA');
const DeepSeekAdapter = require('./deepseek');

const ADAPTERS = {
  DEEPSEEK: DeepSeekAdapter,
};

const PROVEDORES = Object.keys(ADAPTERS);

/** Mapa provedor → TipoCredencial esperado no cofre. */
const TIPO_CREDENCIAL_POR_PROVEDOR = Object.freeze({
  DEEPSEEK: 'DEEPSEEK_KEY',
});

/**
 * @param {string} provedor  DEEPSEEK
 * @param {Object} cfg        { credencial, modo? }
 * @returns {ProvedorIA}
 */
function criarProvedorIA(provedor, cfg = {}) {
  const Adapter = ADAPTERS[provedor];
  if (!Adapter) {
    throw Object.assign(new Error(`Provedor de IA desconhecido: ${provedor}.`), {
      status: 400, codigo: 'PROVEDOR_IA_INVALIDO',
    });
  }
  return new Adapter(cfg);
}

module.exports = {
  criarProvedorIA,
  PROVEDORES,
  TIPO_CREDENCIAL_POR_PROVEDOR,
  ProvedorIA,
};
