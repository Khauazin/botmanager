// Adapter META_CLOUD — wrapper fino sobre services/whatsappCloud.js (existente,
// intocado). Não duplica a lógica de envio/DRY_RUN — só traduz a interface de
// classe (ProvedorWhatsApp) pras funções que já existiam antes de haver mais
// de um provedor. O ENVIO_REAL/DRY_RUN interno do whatsappCloud.js continua
// sendo a autoridade pra Meta; `this.modo` aqui é só por simetria de interface.

const { ProvedorWhatsApp } = require('./ProvedorWhatsApp');
const whatsappCloud = require('../../services/whatsappCloud');

class MetaCloudAdapter extends ProvedorWhatsApp {
  static get provedor() { return 'META_CLOUD'; }

  get _token() { return this.credencial?.dados?.accessToken || this.credencial?.dados?.token || null; }

  enviarTexto({ para, texto }) {
    return whatsappCloud.enviarTexto({ phoneNumberId: this.identificadorCanal, token: this._token, para, texto });
  }

  enviarDocumento({ para, link, filename, caption }) {
    return whatsappCloud.enviarDocumento({ phoneNumberId: this.identificadorCanal, token: this._token, para, link, filename, caption });
  }

  enviarTemplate({ para, nomeTemplate, idioma, componentes }) {
    return whatsappCloud.enviarTemplate({ phoneNumberId: this.identificadorCanal, token: this._token, para, nomeTemplate, idioma, componentes });
  }
}

module.exports = MetaCloudAdapter;
