// Núcleo compartilhado das credenciais (integrações): whitelist de tipo, schema
// por tipo, categoria (pra agrupar na UI), validação e o "semSegredos".
//
// FONTE ÚNICA — usada pela rota do TENANT e pela rota do ADMIN. Não duplicar a
// whitelist/validação em dois lugares (evita divergência = evita brecha).
//
// Só as integrações do escopo ERP: Pagamento (PSP), Fiscal, WhatsApp. Os tipos
// genéricos HTTP (Bearer/Basic/API Key) e "Outro" foram removidos — não faziam
// parte do produto e confundiam.

const TIPOS_VALIDOS = new Set([
  'WHATSAPP_CLOUD_TOKEN',
  'MERCADO_PAGO_KEY',
  'ASAAS_KEY',
  'PAGARME_KEY',
  'FOCUS_NFE_KEY',
  'NUVEM_FISCAL_KEY',
]);

// Categoria pra agrupar na tela (admin + cliente).
const CATEGORIA_POR_TIPO = {
  MERCADO_PAGO_KEY: 'Pagamento',
  ASAAS_KEY: 'Pagamento',
  PAGARME_KEY: 'Pagamento',
  FOCUS_NFE_KEY: 'Fiscal',
  NUVEM_FISCAL_KEY: 'Fiscal',
  WHATSAPP_CLOUD_TOKEN: 'WhatsApp',
};

// Schema esperado de `dados` por tipo. Os nomes dos campos batem com o que cada
// adapter lê (adapters/pagamento, adapters/fiscal) — não renomear sem ajustar lá.
//
// WHATSAPP_CLOUD_TOKEN so pede o accessToken: phoneNumberId e businessAccountId
// chegaram a fazer parte do schema, mas nenhum adapter os lia (whatsappCloud.js
// recebe o phoneNumberId do proprio payload da mensagem recebida, nao da
// credencial). Pedir os dois so aumentava a chance de erro de digitacao sem
// nenhum efeito real. O identificador que de fato importa pro roteamento —
// qual numero pertence a qual bot — vive em Bot.identificadorCanal.
const SCHEMA_POR_TIPO = {
  WHATSAPP_CLOUD_TOKEN: { obrigatorios: ['accessToken'], opcionais: [] },
  MERCADO_PAGO_KEY: { obrigatorios: ['accessToken'], opcionais: ['webhookSecret'] },
  ASAAS_KEY: { obrigatorios: ['apiKey'], opcionais: ['webhookSecret'] },
  PAGARME_KEY: { obrigatorios: ['secretKey'], opcionais: ['webhookSecret'] },
  FOCUS_NFE_KEY: { obrigatorios: ['token'], opcionais: [] },
  NUVEM_FISCAL_KEY: { obrigatorios: ['accessToken'], opcionais: [] },
};

const TAM_MAX_NOME = 120;
const TAM_MAX_DESCRICAO = 500;
const TAM_MAX_VALOR_CAMPO = 8_000;

// Valida o payload `dados` conforme o tipo. Rejeita campo obrigatório faltando
// ou valor gigante (anti-abuso). Retorna { ok } ou { erro }.
function validarPayload(tipo, dados) {
  const schema = SCHEMA_POR_TIPO[tipo];
  if (!schema) return { erro: `Tipo invalido: ${tipo}.` };
  if (!dados || typeof dados !== 'object') return { erro: 'dados deve ser objeto.' };
  for (const campo of schema.obrigatorios) {
    const v = dados[campo];
    if (typeof v !== 'string' || !v.trim()) {
      return { erro: `Campo obrigatorio faltando: ${campo}.` };
    }
    if (v.length > TAM_MAX_VALOR_CAMPO) {
      return { erro: `Campo ${campo} excede ${TAM_MAX_VALOR_CAMPO} caracteres.` };
    }
  }
  return { ok: true };
}

// Remove o material secreto antes de devolver pela API. NUNCA sai da API.
function semSegredos(c) {
  if (!c) return c;
  // eslint-disable-next-line no-unused-vars
  const { dadosCifrados, iv, tag, ...resto } = c;
  return resto;
}

module.exports = {
  TIPOS_VALIDOS,
  CATEGORIA_POR_TIPO,
  SCHEMA_POR_TIPO,
  TAM_MAX_NOME,
  TAM_MAX_DESCRICAO,
  TAM_MAX_VALOR_CAMPO,
  validarPayload,
  semSegredos,
};
