// Gera o PDF do catalogo a partir do layout que o tenant configurou
// (ConfiguracaoCatalogo). Motor de navegador (Puppeteer, nao pdfkit) de
// proposito: o layout visual pode bater exatamente com a previa que o
// cliente configura em app/configuracoes, escrevendo a logica de exibicao
// uma vez so (HTML/CSS) em vez de duplicar em HTML pra previa + desenho
// manual pro PDF.

const puppeteer = require('puppeteer-core');

// Definido no Dockerfile (apk add chromium) — ver comentario la.
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarPreco(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const TEMPLATES_VALIDOS = new Set(['FOTOS_GRANDES', 'LISTA_COMPACTA', 'MINIMALISTA']);

/**
 * Monta o HTML de 1 item, no formato do template escolhido. Cada template tem
 * sua propria estrutura (nao so CSS) porque a ordem/agrupamento da info muda:
 * card grande (foto em destaque, texto embaixo) vs linha compacta (foto
 * pequena ao lado, nome+preco na mesma linha) vs minimalista (sem foto,
 * so nome e preco — o modelo existe justamente pra isso).
 */
function montarItemHtml(p, { template, mostrarFoto, mostrarDescricao, mostrarPreco }) {
  const foto = mostrarFoto ? `<div class="foto">${p.imagemUrl ? `<img src="${escapeHtml(p.imagemUrl)}" />` : ''}</div>` : '';
  const desc = mostrarDescricao && p.descricao ? `<div class="desc">${escapeHtml(p.descricao)}</div>` : '';
  const preco = mostrarPreco ? `<div class="preco">${formatarPreco(p.preco)}</div>` : '';

  if (template === 'LISTA_COMPACTA') {
    return `
      <div class="item item-linha">
        ${foto}
        <div class="info">
          <div class="linha-topo"><span class="nome">${escapeHtml(p.nome)}</span>${preco}</div>
          ${desc}
        </div>
      </div>`;
  }
  if (template === 'MINIMALISTA') {
    return `
      <div class="item item-minimo">
        <span class="nome">${escapeHtml(p.nome)}</span>
        ${preco}
      </div>`;
  }
  // FOTOS_GRANDES (padrao) — card com foto em destaque.
  return `
    <div class="item item-card">
      ${foto}
      <div class="nome">${escapeHtml(p.nome)}</div>
      ${desc}
      ${preco}
    </div>`;
}

/**
 * Monta o HTML do catalogo. Funcao pura (sem I/O) — testavel passando
 * produtos/config a mao, sem precisar do Puppeteer nem do banco.
 * @param {{nomeNegocio:string, produtos:Array, config:Object|null}} p
 * @returns {string}
 */
function montarHtml({ nomeNegocio, produtos, config }) {
  const cor = /^#[0-9a-fA-F]{6}$/.test(config?.corDestaque || '') ? config.corDestaque : '#2563EB';
  const template = TEMPLATES_VALIDOS.has(config?.template) ? config.template : 'FOTOS_GRANDES';
  const mostrarPreco = config?.mostrarPreco !== false;
  // Minimalista e "so nome e preco" por definicao — foto e descricao nunca
  // aparecem nesse modelo, mesmo que os toggles estejam ligados (o cliente
  // pode ter ligado pra outro template e so trocado de modelo depois).
  const ehMinimalista = template === 'MINIMALISTA';
  const mostrarFoto = config?.mostrarFoto !== false && !ehMinimalista;
  const mostrarDescricao = config?.mostrarDescricao !== false && !ehMinimalista;
  const agrupar = config?.agruparPor !== 'NENHUM';

  const grupos = new Map();
  for (const p of produtos) {
    const chaveGrupo = agrupar ? (p.categoriaNome || 'Outros') : '__todos__';
    if (!grupos.has(chaveGrupo)) grupos.set(chaveGrupo, []);
    grupos.get(chaveGrupo).push(p);
  }

  const classeGrade = template === 'LISTA_COMPACTA' ? 'grade-linhas' : template === 'MINIMALISTA' ? 'grade-minima' : 'grade-cards';
  const opcoesItem = { template, mostrarFoto, mostrarDescricao, mostrarPreco };

  const secoesHtml = Array.from(grupos.entries()).map(([nomeGrupo, itens]) => `
    <section>
      ${agrupar ? `<h2>${escapeHtml(nomeGrupo)}</h2>` : ''}
      <div class="${classeGrade}">
        ${itens.map((p) => montarItemHtml(p, opcoesItem)).join('')}
      </div>
    </section>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 32px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 15px; color: ${cor}; margin: 20px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .nome { font-weight: 700; }
    .desc { font-size: 11px; color: #666; }
    .preco { font-weight: 700; color: ${cor}; }

    /* Fotos grandes: cards com foto em destaque, 2 por linha. */
    .grade-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .item-card { border: 1px solid #eee; border-radius: 8px; padding: 10px; break-inside: avoid; }
    .item-card .foto img { width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 6px; }
    .item-card .nome { font-size: 13px; }
    .item-card .desc { display: block; margin-top: 2px; }
    .item-card .preco { font-size: 13px; display: block; margin-top: 4px; }

    /* Lista compacta: linhas com foto pequena, mais itens por pagina. */
    .grade-linhas { display: flex; flex-direction: column; gap: 2px; }
    .item-linha { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; padding: 6px 2px; break-inside: avoid; }
    .item-linha .foto img { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
    .item-linha .info { flex: 1; min-width: 0; }
    .item-linha .linha-topo { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .item-linha .nome { font-size: 12px; }
    .item-linha .preco { font-size: 12px; white-space: nowrap; }
    .item-linha .desc { margin-top: 1px; }

    /* Minimalista: so nome e preco, denso, sem foto. */
    .grade-minima { display: flex; flex-direction: column; gap: 2px; }
    .item-minimo { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; border-bottom: 1px dotted #ddd; padding: 4px 2px; break-inside: avoid; }
    .item-minimo .nome { font-size: 12px; }
    .item-minimo .preco { font-size: 12px; }
  </style></head><body>
    <h1>${escapeHtml(nomeNegocio || 'Catalogo')}</h1>
    ${secoesHtml || '<p>Nenhum produto cadastrado ainda.</p>'}
  </body></html>`;
}

/**
 * Renderiza o HTML montado em PDF (buffer). Abre/fecha o browser a cada
 * chamada — gerar catalogo nao e operacao de alta frequencia (poucas vezes
 * por dia por tenant); manter um browser aberto o tempo todo custaria mais
 * memoria do que economizaria tempo.
 * `--no-sandbox`: necessario porque o container roda como root (Chromium
 * recusa o proprio sandbox interno rodando como root) — o isolamento aqui e
 * o container em si, nao o sandbox do Chromium.
 */
async function renderizarPdf(html) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
  } finally {
    await browser.close();
  }
}

module.exports = { montarHtml, renderizarPdf, formatarPreco };
