// Helper para acessar credenciais cifradas do tenant just-in-time.
// Pós-pivô ERP-first: será usado pelos adaptadores de PSP (pagamento) e fiscal
// para decifrar a chave de API do tenant no momento da chamada externa.
//
// Filosofia: credenciais saem do banco em texto cifrado, sao decifradas
// no momento do uso, e o resultado em claro NUNCA e logado, persistido nem
// retornado pelas rotas de leitura.
//
// Ao usar uma credencial, atualizamos `ultimoUsoEm` em background
// (best-effort, nao bloqueia o uso).

const prisma = require('./prisma');
const { cifrarPayload, decifrarPayload } = require('./cripto/cofreCredenciais');

// Contexto fixo de derivacao pra credencial de PLATAFORMA (ex.: a chave da
// DeepSeek — uma so, da Sellergy, nao de um tenant). O parametro "clienteId"
// que cifrarPayload/decifrarPayload recebem e usado como contexto de
// derivacao HKDF (nao precisa ser segredo, so precisa ser estavel e unico
// pra esse dominio — HKDF.info e publico por design, a seguranca vem da
// master key). Nao reaproveita nenhum clienteId real: uma string fixa que
// nunca colide com um UUID de tenant.
//
// Isolado deste jeito, em vez de reabrir o caminho "clienteId null" em
// carregarCredencialDecifrada(), porque aquele foi fechado de proposito no
// pivo (comentario ali: "credenciais de plataforma foram removidas") — nao
// quero reabrir uma trava geral pra resolver um caso especifico.
const CONTEXTO_PLATAFORMA = 'sellergy-plataforma-v1';

async function carregarCredencialDecifrada({ credencialId, clienteId }) {
  if (!credencialId) return null;
  const credencial = await prisma.credencial.findFirst({
    where: clienteId ? { id: credencialId, clienteId } : { id: credencialId },
  });
  if (!credencial) {
    throw new Error(`Credencial ${credencialId} nao encontrada (ou nao pertence ao tenant).`);
  }
  // Cifra derivada por tenant. Credenciais de plataforma (clienteId null) foram
  // removidas no pivô — toda credencial agora pertence a um tenant.
  if (!credencial.clienteId) {
    throw new Error(`Credencial ${credencialId} sem tenant — credenciais de plataforma foram removidas.`);
  }
  const chaveCripto = credencial.clienteId;
  let dados;
  try {
    dados = decifrarPayload(chaveCripto, credencial);
  } catch (err) {
    throw new Error(`Falha ao decifrar credencial ${credencialId}: ${err.message}`);
  }

  // Stats em background — silencioso se falhar.
  prisma.credencial
    .update({ where: { id: credencial.id }, data: { ultimoUsoEm: new Date() } })
    .catch((e) => console.error('[credencial/stats]', e?.message || e));

  return { tipo: credencial.tipo, nome: credencial.nome, dados };
}

/**
 * Carrega a UNICA credencial de plataforma de um tipo (ex.: DEEPSEEK_KEY).
 * Diferente de carregarCredencialDecifrada: nao recebe id nem clienteId —
 * a credencial de plataforma nao pertence a nenhum tenant, entao a busca e
 * so pelo tipo, com clienteId IS NULL.
 */
async function carregarCredencialPlataforma(tipo) {
  const credencial = await prisma.credencial.findFirst({
    where: { clienteId: null, tipo },
    orderBy: { criadoEm: 'desc' },
  });
  if (!credencial) return null;

  let dados;
  try {
    dados = decifrarPayload(CONTEXTO_PLATAFORMA, credencial);
  } catch (err) {
    throw new Error(`Falha ao decifrar credencial de plataforma (${tipo}): ${err.message}`);
  }

  prisma.credencial
    .update({ where: { id: credencial.id }, data: { ultimoUsoEm: new Date() } })
    .catch((e) => console.error('[credencial-plataforma/stats]', e?.message || e));

  return { id: credencial.id, tipo: credencial.tipo, nome: credencial.nome, dados };
}

/**
 * Cria ou atualiza a UNICA credencial de plataforma de um tipo. Usado pela
 * rota admin (admin-credencial-ia.routes.js) — nunca exposta ao tenant.
 */
async function salvarCredencialPlataforma({ tipo, nome, payload, criadoPorId }) {
  const cifrado = cifrarPayload(CONTEXTO_PLATAFORMA, payload);
  const existente = await prisma.credencial.findFirst({ where: { clienteId: null, tipo } });

  const data = {
    nome,
    tipo,
    dadosCifrados: cifrado.conteudoCifrado,
    iv: cifrado.iv,
    tag: cifrado.tag,
    versaoChave: cifrado.versaoChave,
  };

  if (existente) {
    return prisma.credencial.update({ where: { id: existente.id }, data });
  }
  return prisma.credencial.create({ data: { ...data, clienteId: null, criadoPorId: criadoPorId || null } });
}

// Aplica a credencial ao objeto de cabecalhos HTTP conforme o tipo.
// Retorna NOVO objeto de cabecalhos — nao muta o original.
function aplicarCredencialEmCabecalhos(cabecalhos, credencialDecifrada) {
  if (!credencialDecifrada) return { ...cabecalhos };
  const out = { ...cabecalhos };
  const { tipo, dados } = credencialDecifrada;

  switch (tipo) {
    case 'HTTP_BEARER':
      out['Authorization'] = `Bearer ${dados.token}`;
      break;
    case 'HTTP_BASIC': {
      const b64 = Buffer.from(`${dados.usuario}:${dados.senha}`, 'utf8').toString('base64');
      out['Authorization'] = `Basic ${b64}`;
      break;
    }
    case 'HTTP_API_KEY':
      out[dados.headerName] = dados.key;
      break;
    case 'OPENAI_API_KEY':
      out['Authorization'] = `Bearer ${dados.apiKey}`;
      if (dados.organizationId) out['OpenAI-Organization'] = dados.organizationId;
      break;
    case 'ANTHROPIC_API_KEY':
      out['x-api-key'] = dados.apiKey;
      out['anthropic-version'] = '2023-06-01';
      break;
    case 'GEMINI_API_KEY':
      // Gemini usa query param, nao header — quem chama trata.
      break;
    default:
      // Tipos especificos de canal (Whatsapp, Telegram) usam credencial
      // direto no executor especifico, nao aqui.
      break;
  }
  return out;
}

module.exports = {
  carregarCredencialDecifrada,
  carregarCredencialPlataforma,
  salvarCredencialPlataforma,
  aplicarCredencialEmCabecalhos,
};
