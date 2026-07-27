// Roteador de menu fixo do bot WhatsApp — SEM IA. Regra simples: saudacao ->
// menu numerado a partir das FAQs; opcao numerica / casamento de texto ->
// resposta da FAQ; opcao "atendente" -> encaminhar; senao -> fallback.
//
// Funcoes PURAS (sem I/O) pra serem testaveis isoladamente — o webhook
// (webhooksWhatsapp.routes.js) faz o I/O (acha o bot, carrega FAQs, envia).
//
// SEAM documentado: o agendamento guiado (servico -> especialista -> horario)
// exige ESTADO POR CONVERSA (store persistente) + agenda.listarHorariosLivres.
// Como o pivo removeu o model Conversa, o estado entra junto com a definicao
// desse store (proxima iteracao). Por ora o bot responde menu + FAQ + fallback.

// Normaliza pra casar texto sem acento/caixa.
function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const SAUDACOES = ['oi', 'ola', 'menu', 'bom dia', 'boa tarde', 'boa noite', 'inicio', 'start'];

function ehSaudacao(texto) {
  const t = norm(texto);
  return SAUDACOES.some((s) => t === s || t.startsWith(s));
}

// Monta o texto do menu a partir das FAQs ativas (numeradas) + opcao de humano.
function montarMenu(faqsAtivas) {
  const linhas = ['Ola! Como posso ajudar? Responda com o numero:'];
  faqsAtivas.forEach((f, i) => linhas.push(`${i + 1}. ${f.pergunta}`));
  linhas.push(`${faqsAtivas.length + 1}. Falar com um atendente`);
  return linhas.join('\n');
}

// Decide a resposta para uma mensagem recebida.
// Retorna { texto } e, opcionalmente, { encaminhar: true } quando o cliente
// pediu atendimento humano (o webhook trata o seam de encaminhamento).
function montarResposta({ texto, faqs }) {
  const ativos = (faqs || [])
    .filter((f) => f.ativo)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Sem FAQ configurada: resposta neutra (atendimento ainda em montagem).
  if (ativos.length === 0) {
    return { texto: 'Ola! Nosso atendimento automatico ainda esta sendo configurado. Em breve retornamos por aqui.' };
  }

  // Saudacao / pedido de menu -> mostra o menu.
  if (ehSaudacao(texto)) {
    return { texto: montarMenu(ativos) };
  }

  // Opcao numerica.
  const n = parseInt(norm(texto), 10);
  if (Number.isInteger(n) && n >= 1) {
    if (n <= ativos.length) return { texto: ativos[n - 1].resposta };
    if (n === ativos.length + 1) {
      return { texto: 'Tudo bem! Um atendente vai falar com voce em breve.', encaminhar: true };
    }
  }

  const t = norm(texto);
  const palavrasDoTexto = t.split(/\s+/).filter(Boolean);

  // Casamento por palavra-chave: sinal deliberado de quem cadastrou a FAQ, por
  // isso vem antes do casamento frouxo por texto da pergunta. Palavra-chave de
  // uma palavra so bate por palavra inteira (evita "oi" casar dentro de "hoje");
  // frase com mais de uma palavra bate por substring, como as perguntas.
  const porPalavraChave = ativos.find((f) => (f.palavrasChave || []).some((chave) => {
    const c = norm(chave);
    if (!c) return false;
    return c.includes(' ') ? t.includes(c) : palavrasDoTexto.includes(c);
  }));
  if (porPalavraChave) return { texto: porPalavraChave.resposta };

  // Casamento por texto na pergunta (contains, nos dois sentidos).
  const achou = ativos.find((f) => {
    const p = norm(f.pergunta);
    return p.includes(t) || t.includes(p);
  });
  if (achou) return { texto: achou.resposta };

  // Fallback: nunca fica mudo — reoferece o menu junto, em vez de so dizer que
  // nao entendeu e deixar o cliente sem saber o que fazer.
  return { texto: `Nao entendi. Aqui estao as opcoes:\n\n${montarMenu(ativos)}` };
}

module.exports = { montarResposta, montarMenu, ehSaudacao, norm };
