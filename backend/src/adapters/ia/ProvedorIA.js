// Interface (contrato) da camada plugavel de IA conversacional.
// Mesmo padrao de ProvedorPagamento/ProvedorFiscal: o resto do sistema nao
// sabe qual provedor de IA esta em uso, e trocar de provedor nao mexe no
// motor de decisao (services/iaRouter.js) nem no roteador de FAQ.
//
// MODO de operacao (igual aos outros dois):
//   - 'fixture': monta o request real mas NAO bate na rede — devolve uma
//     resposta de fixture ja normalizada. Usado em desenvolvimento/teste.
//   - 'live': executa a chamada de verdade.
//
// Diferenca de proposito pros outros dois adapters: pagamento/fiscal usam
// credencial POR TENANT (cada cliente tem a propria conta no PSP/emissor). A
// IA usa credencial de PLATAFORMA — uma chave da DeepSeek, da Sellergy, que
// atende todos os bots. Ver credenciais.js (carregarCredencialPlataforma).

const { fetchComRetentativa } = require('../../utils/httpSeguro');

/**
 * Resposta normalizada de uma chamada de chat (agnostica de provedor).
 * @typedef {Object} RespostaIA
 * @property {string} texto
 * @property {number} tokensPrompt
 * @property {number} tokensCompletion
 * @property {number} tokensTotal
 * @property {Object} [bruto]  payload cru do provedor (debug)
 */

class ProvedorIA {
  /**
   * @param {Object} cfg
   * @param {Object} cfg.credencial  { tipo, nome, dados } decifrada do cofre
   * @param {'fixture'|'live'} [cfg.modo]
   */
  constructor({ credencial, modo = 'fixture' } = {}) {
    if (new.target === ProvedorIA) {
      throw new Error('ProvedorIA e abstrata — use um adapter concreto.');
    }
    this.credencial = credencial || null;
    this.modo = modo;
  }

  /** Identificador do provedor. @returns {string} */
  static get provedor() { throw new Error('not implemented'); }

  /**
   * Gera uma resposta de chat.
   * @param {{mensagens:Array<{role:string,content:string}>, modelo?:string, temperatura?:number, maxTokens?:number}} _p
   * @returns {Promise<RespostaIA>}
   */
  async responder(_p) { throw new Error('not implemented'); }

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
    }, { timeoutMs: 30_000 }); // resposta de chat pode demorar mais que um webhook de pagamento
    const texto = await resp.text();
    const json = texto ? JSON.parse(texto) : {};
    if (!resp.ok) {
      throw Object.assign(new Error(`IA ${this.constructor.provedor} HTTP ${resp.status}`), {
        status: 502, codigo: 'IA_ERRO', detalhe: json,
      });
    }
    return json;
  }
}

module.exports = { ProvedorIA };
