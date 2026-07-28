// Decide entre atendimento com IA (DeepSeek) e o motor de FAQ existente
// (botRouter, menu fixo), conforme bot.iaAtiva. Quando responde com IA,
// registra o consumo de tokens do mes (ConsumoIA) pro relatorio de excedente.
//
// Nunca lanca: falha da IA (chave ausente, provedor fora do ar, timeout) cai
// numa mensagem de erro tratada — o webhook do WhatsApp nao pode quebrar
// porque a DeepSeek ficou indisponivel.
//
// LIMITACAO CONHECIDA: sem memoria de conversa — cada mensagem e enviada
// isolada (so o prompt de sistema + a mensagem atual), sem historico do que
// foi dito antes. O model `Conversa` foi removido no pivo ERP-first e
// reconstruir estado-por-conversa e um trabalho a parte (store persistente +
// janela de contexto) — fora do escopo desta rodada. O parametro `historico`
// existe pra quando isso for construido, sem precisar mexer aqui de novo.

const prisma = require('../prisma');
const { montarResposta } = require('./botRouter');
const { criarProvedorIA } = require('../adapters/ia');
const { carregarCredencialPlataforma } = require('../credenciais');

const TIPO_CREDENCIAL_IA = 'DEEPSEEK_KEY';
const MENSAGEM_INDISPONIVEL = 'Atendimento indisponivel no momento. Tente novamente em instantes.';

// 'fixture' por padrao (nao bate na rede) — precisa de IA_MODO=live pra
// chamar a DeepSeek de verdade. Mesmo padrao de go-live dos outros adapters
// (FISCAL_LIVE, WHATSAPP_ENVIO_REAL): nunca liga sozinho.
function modoIA() {
  return process.env.IA_MODO === 'live' ? 'live' : 'fixture';
}

function periodoAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Matematica pura do excedente — separada do acesso ao banco pra ser
 * testavel sem precisar de um Prisma/DB real (mesmo padrao dos outros
 * testes deste projeto: logica em funcao pura, I/O fica em volta dela).
 * @param {{totalTokens:number, tokensIncluidosMes:number, precoPorMilCentavos:number}} p
 * @returns {{tokensExcedentes:number, valorExcedenteCentavos:number}}
 */
function calcularExcedente({ totalTokens, tokensIncluidosMes, precoPorMilCentavos }) {
  const tokensExcedentes = Math.max(0, totalTokens - tokensIncluidosMes);
  const valorExcedenteCentavos = Math.round((tokensExcedentes / 1000) * precoPorMilCentavos);
  return { tokensExcedentes, valorExcedenteCentavos };
}

/**
 * Soma o consumo do mes (upsert incremental) e recalcula o excedente.
 * Best-effort: quem chama nao deve deixar uma falha aqui derrubar a resposta
 * ja enviada ao cliente.
 */
async function registrarConsumo({ clienteId, botId, tokensUsados, tokensIncluidosMes, precoPorMilCentavos }) {
  if (!tokensUsados) return;
  const periodo = periodoAtual();
  const atual = await prisma.consumoIA.findUnique({ where: { botId_periodo: { botId, periodo } } });
  const totalTokens = (atual?.tokensUsados || 0) + tokensUsados;
  const { tokensExcedentes, valorExcedenteCentavos } = calcularExcedente({ totalTokens, tokensIncluidosMes, precoPorMilCentavos });

  await prisma.consumoIA.upsert({
    where: { botId_periodo: { botId, periodo } },
    create: { clienteId, botId, periodo, tokensUsados: totalTokens, tokensExcedentes, valorExcedenteCentavos },
    update: { tokensUsados: totalTokens, tokensExcedentes, valorExcedenteCentavos },
  });
}

/**
 * Decide a resposta pra uma mensagem recebida.
 * @param {{bot:Object, texto:string, faqs:Array, historico?:Array<{role:string,content:string}>}} p
 * @returns {Promise<{texto:string, encaminhar?:boolean}>}
 */
async function montarRespostaBot({ bot, texto, faqs, historico = [] }) {
  if (!bot.iaAtiva) {
    return montarResposta({ texto, faqs });
  }

  try {
    const credencialIA = await carregarCredencialPlataforma(TIPO_CREDENCIAL_IA);
    if (!credencialIA) {
      console.error('[iaRouter] bot com iaAtiva=true mas sem credencial de IA de plataforma cadastrada');
      return { texto: MENSAGEM_INDISPONIVEL };
    }

    const provedor = criarProvedorIA('DEEPSEEK', { credencial: credencialIA, modo: modoIA() });
    const mensagens = [
      ...(bot.iaPromptSistema ? [{ role: 'system', content: bot.iaPromptSistema }] : []),
      ...historico,
      { role: 'user', content: texto },
    ];

    const resposta = await provedor.responder({ mensagens, modelo: bot.iaModelo });

    // Best-effort: registrar consumo nao pode atrasar nem quebrar a resposta.
    registrarConsumo({
      clienteId: bot.clienteId,
      botId: bot.id,
      tokensUsados: resposta.tokensTotal,
      tokensIncluidosMes: bot.iaTokensIncluidosMes,
      precoPorMilCentavos: bot.iaPrecoPorMilTokensExcedenteCentavos,
    }).catch((e) => console.error('[iaRouter] falha ao registrar consumo', e?.message));

    return { texto: resposta.texto || 'Desculpe, nao consegui gerar uma resposta agora.' };
  } catch (erro) {
    console.error('[iaRouter] falha na chamada de IA', erro?.message);
    return { texto: MENSAGEM_INDISPONIVEL };
  }
}

module.exports = { montarRespostaBot, registrarConsumo, calcularExcedente, periodoAtual };
