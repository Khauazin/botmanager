// Adapter BAILEYS — WhatsApp Web não oficial (QR Code), sem app/aprovação da
// Meta. Precisa de uma conexão viva (`this.socket`, um `sock` do Baileys) —
// só existe dentro do processo worker.js, onde o gerenciador de conexão
// (services/baileys/gerenciadorConexao.js) mantém o registro por bot. Quem
// chama resolve o socket ANTES de instanciar este adapter (ver
// gerenciadorConexao.obterSocket) — o adapter não sabe de onde ele veio.
//
// Sem templates: WhatsApp Web não tem HSM aprovado, é tudo texto livre.
// enviarTemplate lança — quem dispara campanha (routes/campanhas.routes.js)
// já decide ANTES de chegar aqui que bot BAILEYS nunca chama enviarTemplate;
// isso aqui é defesa em profundidade, não um caminho esperado em uso normal.
//
// BAILEYS_ENVIO_REAL: interruptor global próprio (mesmo padrão de
// WHATSAPP_ENVIO_REAL), separado do da Meta — dado o risco de banimento já
// reconhecido, faz sentido ops poder desligar só o envio não oficial.

const { ProvedorWhatsApp } = require('./ProvedorWhatsApp');

const ENVIO_REAL = process.env.BAILEYS_ENVIO_REAL === '1';

function paraJid(para) {
  const digitos = String(para || '').replace(/\D/g, '');
  return `${digitos}@s.whatsapp.net`;
}

class BaileysAdapter extends ProvedorWhatsApp {
  static get provedor() { return 'BAILEYS'; }

  async _enviar(descricao, montarPayload) {
    if (!ENVIO_REAL || this.modo !== 'live') {
      console.log('[baileys:DRY_RUN]', descricao);
      return { ok: true, simulado: true };
    }
    if (!this.socket) {
      return { ok: false, simulado: false, erro: 'Sessão WhatsApp Web não conectada.' };
    }
    try {
      const resultado = await this.socket.sendMessage(...montarPayload());
      return { ok: true, simulado: false, idMensagem: resultado?.key?.id || null };
    } catch (erro) {
      console.error('[baileys] envio falhou', erro?.message);
      return { ok: false, simulado: false, erro: erro?.message || 'falha no envio' };
    }
  }

  enviarTexto({ para, texto }) {
    return this._enviar(`texto -> ${para}`, () => [paraJid(para), { text: texto }]);
  }

  enviarDocumento({ para, link, filename, caption }) {
    return this._enviar(`documento -> ${para}`, () => [
      paraJid(para),
      { document: { url: link }, fileName: filename, caption, mimetype: 'application/pdf' },
    ]);
  }

  async enviarTemplate() {
    throw Object.assign(new Error('Templates HSM não existem no WhatsApp Web.'), {
      status: 501, codigo: 'BAILEYS_TEMPLATE_INDISPONIVEL',
    });
  }
}

module.exports = BaileysAdapter;
