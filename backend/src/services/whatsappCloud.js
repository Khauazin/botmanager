// =====================================================================
// SERVICO — ENVIO PELO WHATSAPP CLOUD API (Meta)
// =====================================================================
// Camada fina de envio de mensagens pelo WhatsApp Cloud API. Sem IA: o bot
// so dispara textos/menus/templates montados por regra fixa (ver botRouter).
//
// ESTADO (Fase 4 depende de App Review da Meta): o envio real exige um app
// Meta aprovado + token do tenant. Enquanto isso, o modo DRY_RUN registra o
// que SERIA enviado (log) e devolve sucesso simulado — assim o roteador de
// menu, FAQ e agendamento ja sao testaveis localmente com payload simulado.
//
// Liga o envio real definindo WHATSAPP_ENVIO_REAL=1 no ambiente.
// =====================================================================

const { fetchComRetentativa } = require('../utils/httpSeguro');

const GRAPH_VERSAO = process.env.WHATSAPP_GRAPH_VERSAO || 'v21.0';
const ENVIO_REAL = process.env.WHATSAPP_ENVIO_REAL === '1';

// Monta o corpo de uma mensagem de texto simples.
function corpoTexto(para, texto) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: para,
    type: 'text',
    text: { preview_url: false, body: texto },
  };
}

// Monta o corpo de um template HSM aprovado (usado em campanhas e em
// mensagens fora da janela de 24h). `componentes` segue o formato da Meta.
function corpoTemplate(para, nomeTemplate, idioma = 'pt_BR', componentes = []) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: para,
    type: 'template',
    template: {
      name: nomeTemplate,
      language: { code: idioma },
      ...(componentes.length ? { components: componentes } : {}),
    },
  };
}

// Faz o POST no Graph API. Isola o fetch pra um unico ponto (DRY_RUN cobre).
async function enviar({ phoneNumberId, token, corpo }) {
  if (!phoneNumberId || !token) {
    return { ok: false, simulado: false, erro: 'phoneNumberId/token ausentes' };
  }

  if (!ENVIO_REAL) {
    // Modo simulado — nao chama a Meta. Loga o destino e o tipo.
    console.log('[whatsappCloud:DRY_RUN]', phoneNumberId, '->', corpo.to, `(${corpo.type})`);
    return { ok: true, simulado: true, corpo };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSAO}/${phoneNumberId}/messages`;
  try {
    // Timeout + retentativa com backoff (429/5xx) — ver utils/httpSeguro.js.
    const resp = await fetchComRetentativa(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpo),
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // Nunca vaza o token; loga so o erro da Meta.
      console.error('[whatsappCloud] envio falhou', resp.status, dados?.error?.message);
      return { ok: false, simulado: false, status: resp.status, erro: dados?.error?.message || 'falha no envio' };
    }
    return { ok: true, simulado: false, idMensagem: dados?.messages?.[0]?.id || null };
  } catch (erro) {
    console.error('[whatsappCloud] excecao no envio', erro?.message);
    return { ok: false, simulado: false, erro: erro?.message || 'excecao no envio' };
  }
}

// Atalho: envia texto simples.
function enviarTexto({ phoneNumberId, token, para, texto }) {
  return enviar({ phoneNumberId, token, corpo: corpoTexto(para, texto) });
}

// Atalho: envia template HSM (campanhas / fora da janela de 24h).
function enviarTemplate({ phoneNumberId, token, para, nomeTemplate, idioma, componentes }) {
  return enviar({ phoneNumberId, token, corpo: corpoTemplate(para, nomeTemplate, idioma, componentes) });
}

module.exports = {
  enviar,
  enviarTexto,
  enviarTemplate,
  corpoTexto,
  corpoTemplate,
  ENVIO_REAL,
};
