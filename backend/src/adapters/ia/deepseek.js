// Adapter DeepSeek — implementa ProvedorIA.
// Auth: Bearer apiKey. Base: https://api.deepseek.com
// Docs oficiais (consultadas em jul/2026): POST /chat/completions, formato
// compativel com OpenAI. Modelos atuais: deepseek-v4-flash (economico) e
// deepseek-v4-pro (mais capaz). Sem stream aqui — o chat do bot precisa da
// resposta completa (e do usage) de uma vez, nao de tokens parciais.
//
// Tool calling: tambem no formato OpenAI (tools no request, tool_calls na
// resposta — a doc da propria DeepSeek confirma isso, guia /guides/tool_calls).
// O modelo NUNCA executa a ferramenta sozinho; so devolve o pedido. Quem
// executa e decide o loop e o iaRouter.js (ver processarComFerramentas).
//
// Preco por milhao de tokens (referencia — cobrado em USD pela DeepSeek; o
// preco do EXCEDENTE que a Sellergy repassa ao cliente e configurado em BRL
// no proprio Bot, nao aqui — ver iaPrecoPorMilTokensExcedenteCentavos):
//   deepseek-v4-flash: US$0,14 entrada (cache miss) / US$0,28 saida
//   deepseek-v4-pro:   US$0,435 entrada (cache miss) / US$0,87 saida

const { ProvedorIA } = require('./ProvedorIA');

const BASE = 'https://api.deepseek.com';
const MODELOS_VALIDOS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro']);
const MODELO_PADRAO = 'deepseek-v4-flash';

/**
 * Normaliza o payload cru da DeepSeek pro formato que o resto do sistema usa.
 * Funcao pura (sem I/O) de proposito — testavel sem precisar de fixture/rede,
 * so passando um `raw` montado a mao.
 * @param {Object} raw
 * @returns {{texto:string, toolCalls:Array<{id:string,nome:string,argumentos:Object}>, tokensPrompt:number, tokensCompletion:number, tokensTotal:number, bruto:Object}}
 */
function normalizarResposta(raw) {
  const msg = raw?.choices?.[0]?.message || {};
  const usage = raw?.usage || {};

  const toolCalls = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((tc) => {
      let argumentos = {};
      try {
        argumentos = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        argumentos = {}; // argumentos malformados: trata como vazio em vez de derrubar o processo
      }
      return { id: tc.id, nome: tc.function?.name, argumentos };
    })
    : [];

  return {
    texto: msg.content || '',
    toolCalls,
    tokensPrompt: usage.prompt_tokens || 0,
    tokensCompletion: usage.completion_tokens || 0,
    tokensTotal: usage.total_tokens || 0,
    bruto: raw,
  };
}

class DeepSeekAdapter extends ProvedorIA {
  static get provedor() { return 'DEEPSEEK'; }

  get _apiKey() { return this.credencial?.dados?.apiKey; }

  /**
   * @param {{mensagens:Array, modelo?:string, temperatura?:number, maxTokens?:number, tools?:Array}} p
   * `tools` no formato OpenAI: [{ type:'function', function:{ name, description, parameters } }].
   * Omitido/vazio = chat comum, sem ferramentas.
   */
  async responder({ mensagens, modelo = MODELO_PADRAO, temperatura = 0.7, maxTokens, tools }) {
    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      throw Object.assign(new Error('mensagens nao pode ser vazio.'), { status: 400, codigo: 'IA_SEM_MENSAGENS' });
    }
    const modeloUsado = MODELOS_VALIDOS.has(modelo) ? modelo : MODELO_PADRAO;
    // Clampa pro range documentado (0-2) em vez de deixar a API rejeitar —
    // um valor fora da faixa vindo de configuracao antiga nao deve quebrar o bot.
    const temp = Math.min(2, Math.max(0, Number(temperatura) || 0.7));
    const temFerramentas = Array.isArray(tools) && tools.length > 0;

    const req = {
      url: `${BASE}/chat/completions`,
      metodo: 'POST',
      headers: { Authorization: `Bearer ${this._apiKey}` },
      corpo: {
        model: modeloUsado,
        messages: mensagens,
        temperature: temp,
        stream: false,
        ...(Number.isInteger(maxTokens) && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
        ...(temFerramentas ? { tools } : {}),
      },
    };

    const raw = await this._executar(req, () => ({
      id: 'fixture-chatcmpl',
      model: modeloUsado,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Resposta simulada (modo fixture).' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 120 },
    }));

    return normalizarResposta(raw);
  }
}

module.exports = DeepSeekAdapter;
module.exports.MODELOS_VALIDOS = MODELOS_VALIDOS;
module.exports.MODELO_PADRAO = MODELO_PADRAO;
module.exports.normalizarResposta = normalizarResposta;
