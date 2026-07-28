// Interface (contrato) da camada plugável de pagamentos.
// Pós-pivô ERP-first §4: o resto do sistema NÃO sabe qual PSP está em uso.
// Cada PSP (Mercado Pago, Asaas, Pagar.me) implementa esta mesma interface
// num adapter; trocar de provedor não mexe em venda/agenda/financeiro.
//
// MODO de operação:
//   - 'fixture' (atual): os métodos montam o request real (url/headers/body
//     conforme a doc oficial) mas NÃO batem na rede — retornam um DTO de
//     fixture já normalizado. Pronto pra Fase 4.
//   - 'live': executa o fetch de verdade. Basta a Frente 4 trocar o modo.
//
// Todo método de cobrança devolve um DTO NORMALIZADO (agnóstico de provedor),
// no mesmo formato dos campos do model `Cobranca`. A tradução do vocabulário
// específico de cada PSP (status, nomes de campo) vive SÓ dentro do adapter.

const { fetchComRetentativa } = require('../../utils/httpSeguro');

/**
 * Status normalizado de uma cobrança (espelha o enum `Cobranca.status`).
 * @typedef {'PENDENTE'|'PAGO'|'EXPIRADO'|'CANCELADO'|'ESTORNADO'} StatusCobranca
 */

/**
 * DTO normalizado retornado ao criar/consultar uma cobrança.
 * @typedef {Object} CobrancaDTO
 * @property {string}        provedorCobrancaId  id da cobrança no PSP
 * @property {StatusCobranca} status
 * @property {string}        [qrCode]            copia-e-cola Pix (EMV)
 * @property {string}        [qrCodeBase64]      imagem do QR em base64 (sem data:)
 * @property {string}        [linkUrl]           URL de checkout/fatura
 * @property {string}        [vencimento]        ISO 8601
 * @property {string}        [pagoEm]            ISO 8601, se já pago
 * @property {Object}        [bruto]             payload cru do PSP (debug/auditoria)
 */

/**
 * DTO normalizado da leitura de um webhook.
 * @typedef {Object} WebhookDTO
 * @property {string}        provedorCobrancaId  chave p/ achar a Cobranca local
 * @property {StatusCobranca} status
 * @property {string}        [pagoEm]
 * @property {string}        evento              nome do evento original do PSP
 */

const STATUS = Object.freeze({
  PENDENTE: 'PENDENTE',
  PAGO: 'PAGO',
  EXPIRADO: 'EXPIRADO',
  CANCELADO: 'CANCELADO',
  ESTORNADO: 'ESTORNADO',
});

class ProvedorPagamento {
  /**
   * @param {Object}  cfg
   * @param {Object}  cfg.credencial  resultado de carregarCredencialDecifrada(): { tipo, nome, dados }
   * @param {'producao'|'homologacao'} [cfg.ambiente]
   * @param {'fixture'|'live'} [cfg.modo]  default 'fixture' nesta fase
   */
  constructor({ credencial, ambiente = 'homologacao', modo = 'fixture' } = {}) {
    if (new.target === ProvedorPagamento) {
      throw new Error('ProvedorPagamento é abstrata — use um adapter concreto.');
    }
    this.credencial = credencial || null;
    this.ambiente = ambiente;
    this.modo = modo;
  }

  /** Identificador do provedor (espelha enum `Cobranca.provedor`). @returns {string} */
  static get provedor() {
    throw new Error('not implemented');
  }

  /**
   * Cria uma cobrança Pix (QR + copia-e-cola).
   * @param {{valor:number, descricao:string, refExterna:string,
   *          vencimento?:string, pagador?:{nome?:string,email?:string,documento?:string}}} _p
   * @returns {Promise<CobrancaDTO>}
   */
  async criarCobrancaPix(_p) { throw new Error('not implemented'); }

  /**
   * Cria um link de pagamento (checkout/fatura).
   * @param {{valor:number, descricao:string, refExterna:string, vencimento?:string}} _p
   * @returns {Promise<CobrancaDTO>}
   */
  async criarLink(_p) { throw new Error('not implemented'); }

  /**
   * Cria uma assinatura/recorrência. (Escopo "Depois" — stub nesta fase.)
   * @returns {Promise<CobrancaDTO>}
   */
  async criarRecorrencia(_p) {
    throw Object.assign(new Error('Recorrência ainda não habilitada.'), {
      status: 501, codigo: 'RECORRENCIA_INDISPONIVEL',
    });
  }

  /**
   * Consulta o status atual de uma cobrança no PSP.
   * @param {string} _provedorCobrancaId
   * @returns {Promise<{status:StatusCobranca, pagoEm?:string}>}
   */
  async consultarStatus(_provedorCobrancaId) { throw new Error('not implemented'); }

  /**
   * Estorna (total) uma cobrança paga.
   * @param {string} _provedorCobrancaId
   * @param {{valor?:number}} [_opts]
   * @returns {Promise<{status:StatusCobranca}>}
   */
  async estornar(_provedorCobrancaId, _opts) { throw new Error('not implemented'); }

  /**
   * Valida a assinatura HMAC do webhook do PSP (anti-spoofing).
   * @param {{headers:Object, rawBody:Buffer|string, segredo:string}} _req
   * @returns {boolean}
   */
  verificarAssinatura(_req) { throw new Error('not implemented'); }

  /**
   * Traduz o corpo do webhook do PSP para o DTO normalizado.
   * @param {{headers:Object, body:Object}} _req
   * @returns {WebhookDTO|null}  null = evento irrelevante (ignorar)
   */
  parsearWebhook(_req) { throw new Error('not implemented'); }

  // ----------------------------------------------------------------------
  // Infra interna compartilhada
  // ----------------------------------------------------------------------

  /**
   * Executa uma chamada HTTP — ou devolve o fixture, conforme o modo.
   * Mantém os dois caminhos visíveis: o request real fica montado mesmo em
   * modo fixture, então a Fase 4 só precisa trocar `modo` para 'live'.
   * @param {{url:string, metodo?:string, headers?:Object, corpo?:Object}} req
   * @param {() => any} fixture  factory do payload cru de fixture
   * @returns {Promise<any>}  payload cru do PSP (ainda NÃO normalizado)
   */
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
      // Nunca inclui os headers da requisicao no erro — evita vazar a credencial
      // (Authorization/Bearer) em log de exception.
      throw Object.assign(new Error(`PSP ${this.constructor.provedor} HTTP ${resp.status}`), {
        status: 502, codigo: 'PSP_ERRO', detalhe: json,
      });
    }
    return json;
  }
}

module.exports = { ProvedorPagamento, STATUS };
