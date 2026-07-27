// Rótulos das integrações e dos campos — compartilhado entre o modal do admin e
// (futuramente) a tela do cliente. Os `tipo`/campos vêm do backend (/credenciais/tipos);
// aqui só damos nome amigável.

export const ROTULO_INTEGRACAO = {
  WHATSAPP_CLOUD_TOKEN: { nome: 'WhatsApp Cloud API', desc: 'Atendimento automático (menu / FAQ)' },
  MERCADO_PAGO_KEY: { nome: 'Mercado Pago', desc: 'Cobrança Pix e link de pagamento' },
  ASAAS_KEY: { nome: 'Asaas', desc: 'Cobrança Pix, boleto e cartão' },
  PAGARME_KEY: { nome: 'Pagar.me', desc: 'Cobrança Pix e cartão' },
  FOCUS_NFE_KEY: { nome: 'Focus NFe', desc: 'Emissão de NFC-e e NFS-e' },
  NUVEM_FISCAL_KEY: { nome: 'Nuvem Fiscal', desc: 'Emissão de NFC-e e NFS-e' },
};

export const ROTULO_CAMPO = {
  accessToken: 'Access token',
  apiKey: 'API key',
  secretKey: 'Secret key',
  token: 'Token',
  webhookSecret: 'Webhook secret',
};

// Ordem de exibição das seções.
export const ORDEM_CATEGORIA = ['Pagamento', 'Fiscal', 'WhatsApp'];
