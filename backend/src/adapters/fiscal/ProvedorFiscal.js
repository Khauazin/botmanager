// Interface (contrato) da camada plugavel fiscal.
// Pos-pivo ERP-first §5: o resto do sistema NAO sabe qual emissor esta em uso.
// Cada emissor (Focus NFe, Nuvem Fiscal) implementa esta interface num adapter;
// trocar de emissor nao mexe em venda/financeiro.
//
// MODO de operacao (igual a camada de pagamento):
//   - 'fixture' (atual): monta o request real (url/headers/body conforme a doc)
//     mas NAO bate na rede — devolve um DTO de fixture ja normalizado.
//   - 'live': executa o fetch de verdade (Fase 4).
//
// Emissao e ASSINCRONA no provedor: o fluxo normal e emitir -> PROCESSANDO ->
// (consultarStatus ate) EMITIDA | ERRO. Todo metodo devolve um DTO normalizado
// no vocabulario do model `DocumentoFiscal` (status do enum StatusDocumentoFiscal).

const { fetchComRetentativa } = require('../../utils/httpSeguro');

/**
 * Status normalizado (espelha o enum `DocumentoFiscal.status`).
 * @typedef {'PENDENTE'|'PROCESSANDO'|'EMITIDA'|'ERRO'|'CANCELADA'} StatusDoc
 */

/**
 * DTO normalizado de um documento fiscal.
 * @typedef {Object} DocumentoDTO
 * @property {string}    provedorDocId  id do documento no emissor
 * @property {StatusDoc} status
 * @property {string}    [numero]
 * @property {string}    [chave]        chave de acesso (44 digitos)
 * @property {string}    [urlPdf]       DANFE/DANFSE em PDF
 * @property {string}    [urlXml]
 * @property {string}    [mensagemErro]
 * @property {Object}    [bruto]        payload cru do emissor (debug)
 */

const STATUS = Object.freeze({
  PENDENTE: 'PENDENTE',
  PROCESSANDO: 'PROCESSANDO',
  EMITIDA: 'EMITIDA',
  ERRO: 'ERRO',
  CANCELADA: 'CANCELADA',
});

class ProvedorFiscal {
  /**
   * @param {Object} cfg
   * @param {Object} cfg.credencial  { tipo, nome, dados } decifrada do cofre
   * @param {Object} cfg.config      ConfiguracaoFiscal do tenant (cnpj, serie, csc, ambiente...)
   * @param {'producao'|'homologacao'} [cfg.ambiente]
   * @param {'fixture'|'live'} [cfg.modo]  default 'fixture' nesta fase
   */
  constructor({ credencial, config, ambiente = 'homologacao', modo = 'fixture' } = {}) {
    if (new.target === ProvedorFiscal) {
      throw new Error('ProvedorFiscal e abstrata — use um adapter concreto.');
    }
    this.credencial = credencial || null;
    this.config = config || {};
    this.ambiente = ambiente;
    this.modo = modo;
  }

  /** Identificador do emissor (espelha enum `DocumentoFiscal.provedor`). */
  static get provedor() { throw new Error('not implemented'); }

  /** Emite NFC-e (loja/varejo). @param {Object} _p @returns {Promise<DocumentoDTO>} */
  async emitirNFCe(_p) { throw new Error('not implemented'); }

  /** Emite NFS-e (servico/clinica). @param {Object} _p @returns {Promise<DocumentoDTO>} */
  async emitirNFSe(_p) { throw new Error('not implemented'); }

  /** Consulta o status atual de um documento no emissor. @returns {Promise<DocumentoDTO>} */
  async consultarStatus(_provedorDocId) { throw new Error('not implemented'); }

  /** Cancela um documento emitido. @returns {Promise<{status:StatusDoc}>} */
  async cancelar(_provedorDocId, _motivo) { throw new Error('not implemented'); }

  // ----------------------------------------------------------------------
  // Infra interna compartilhada — fetch ou fixture, conforme o modo.
  // ----------------------------------------------------------------------
  async _executar(req, fixture) {
    if (this.modo === 'fixture') return fixture();

    // Timeout + retentativa com backoff (429/5xx) — ver utils/httpSeguro.js.
    const resp = await fetchComRetentativa(req.url, {
      method: req.metodo || 'GET',
      headers: { 'content-type': 'application/json', ...(req.headers || {}) },
      body: req.corpo ? JSON.stringify(req.corpo) : undefined,
    });
    const texto = await resp.text();
    const json = texto ? JSON.parse(texto) : {};
    if (!resp.ok) {
      throw Object.assign(new Error(`Emissor ${this.constructor.provedor} HTTP ${resp.status}`), {
        status: 502, codigo: 'FISCAL_ERRO', detalhe: json,
      });
    }
    return json;
  }
}

module.exports = { ProvedorFiscal, STATUS };
