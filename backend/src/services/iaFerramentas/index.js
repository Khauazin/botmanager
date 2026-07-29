// Registro das ferramentas (acoes autonomas) que o bot pode executar durante
// o atendimento com IA — tool calling da DeepSeek. Cada ferramenta declara seu
// schema (formato OpenAI, exigido pela DeepSeek) e um executor que roda a
// logica de verdade contra o banco do tenant.
//
// Pra adicionar uma ferramenta nova: criar ./<nome>.js exportando
// { chave, definicao, executar(argumentos, contexto) }, e registrar abaixo.
// `chave` e o valor que entra em Bot.acoesPermitidas (configurado pelo
// cliente); `definicao.function.name` e o nome tecnico que a IA usa.

const consultarEstoque = require('./consultarEstoque');
const gerarCobrancaPix = require('./gerarCobrancaPix');
const enviarCatalogo = require('./enviarCatalogo');

const REGISTRO = {
  [consultarEstoque.chave]: consultarEstoque,
  [gerarCobrancaPix.chave]: gerarCobrancaPix,
  [enviarCatalogo.chave]: enviarCatalogo,
};

/**
 * Monta a lista de "tools" (formato DeepSeek/OpenAI) e o executor pras acoes
 * que ESTE bot tem permitidas.
 * @param {string[]} acoesPermitidas
 * @returns {{tools: Array|undefined, executar: (nome:string, argumentos:Object, contexto:Object) => Promise<Object>}}
 */
function ferramentasDoBot(acoesPermitidas) {
  const chaves = Array.isArray(acoesPermitidas) ? acoesPermitidas : [];
  const ativas = chaves.map((c) => REGISTRO[c]).filter(Boolean);

  return {
    // undefined (nao []) quando nao ha nenhuma — o adapter so manda "tools" no
    // request se for um array nao-vazio; mandar [] sem necessidade e ruido.
    tools: ativas.length > 0 ? ativas.map((f) => f.definicao) : undefined,
    executar: async (nome, argumentos, contexto) => {
      const ferramenta = ativas.find((f) => f.definicao.function.name === nome);
      if (!ferramenta) {
        return { erro: `Ferramenta "${nome}" nao esta habilitada pra este bot.` };
      }
      return ferramenta.executar(argumentos || {}, contexto);
    },
  };
}

module.exports = { ferramentasDoBot, REGISTRO };
