// Interface (contrato) da camada plugável de envio por WhatsApp.
// Mesmo padrão de ProvedorIA/ProvedorPagamento/ProvedorFiscal: o resto do
// sistema (webhook, cron de devolução, disparo de campanha, ferramentas de
// IA) não sabe qual driver está em uso — só chama enviarTexto/enviarDocumento/
// enviarTemplate. Trocar de provedor não mexe em quem chama.
//
// Dois provedores:
//   - META_CLOUD:  API oficial da Meta (token do tenant + phoneNumberId).
//     Precisa de app aprovado; mensagem fora da janela de 24h exige template
//     (HSM) aprovado. Ver adapters/whatsapp/metaCloud.js.
//   - BAILEYS:     WhatsApp Web não oficial (QR Code, sem app/aprovação).
//     Precisa de uma conexão viva (socket) — não existe fora do processo
//     worker.js, onde o gerenciador de conexão mora. Sem templates: todo
//     envio é texto livre. Ver adapters/whatsapp/baileys.js.
//
// MODO de operação (igual aos outros adapters):
//   - 'fixture': monta o envio mas NÃO bate na rede/socket — devolve sucesso
//     simulado. Usado em desenvolvimento/teste.
//   - 'live': executa o envio de verdade.

class ProvedorWhatsApp {
  /**
   * @param {Object} cfg
   * @param {Object} [cfg.credencial]         { tipo, nome, dados } decifrada do cofre
   * @param {'fixture'|'live'} [cfg.modo]
   * @param {string} [cfg.identificadorCanal] phoneNumberId (só META_CLOUD)
   * @param {Object} [cfg.socket]             conexão Baileys viva (só BAILEYS)
   */
  constructor({ credencial, modo = 'fixture', identificadorCanal = null, socket = null } = {}) {
    if (new.target === ProvedorWhatsApp) {
      throw new Error('ProvedorWhatsApp é abstrata — use um adapter concreto.');
    }
    this.credencial = credencial || null;
    this.modo = modo;
    this.identificadorCanal = identificadorCanal;
    this.socket = socket;
  }

  /** Identificador do provedor. @returns {string} */
  static get provedor() { throw new Error('not implemented'); }

  /**
   * Envia texto simples.
   * @param {{para:string, texto:string}} _p
   * @returns {Promise<{ok:boolean, simulado:boolean, idMensagem?:string, erro?:string}>}
   */
  async enviarTexto(_p) { throw new Error('not implemented'); }

  /**
   * Envia um documento (ex.: catálogo em PDF).
   * @param {{para:string, link:string, filename?:string, caption?:string}} _p
   * @returns {Promise<{ok:boolean, simulado:boolean, idMensagem?:string, erro?:string}>}
   */
  async enviarDocumento(_p) { throw new Error('not implemented'); }

  /**
   * Envia um template HSM aprovado (campanhas / fora da janela de 24h).
   * Só existe no mundo Meta — o adapter Baileys não implementa (texto livre
   * não precisa de template).
   * @param {{para:string, nomeTemplate:string, idioma?:string, componentes?:Array}} _p
   * @returns {Promise<{ok:boolean, simulado:boolean, idMensagem?:string, erro?:string}>}
   */
  async enviarTemplate(_p) { throw new Error('not implemented'); }
}

module.exports = { ProvedorWhatsApp };
