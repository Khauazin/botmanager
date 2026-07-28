// Carrega .env de duas localizacoes (sem sobrescrever):
//   1) CWD — caminho que cobre `cd backend; npm run dev` se houver um .env aqui
//   2) raiz do projeto — onde o .env real vive em dev local
// Em producao (Docker) as vars ja vem do `env_file` do compose; ambas sao no-op.
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const rotasAutenticacao = require('./routes/auth.routes');
const rotasClientes = require('./routes/clientes.routes');
const rotasBots = require('./routes/bots.routes');
const rotasAlertas = require('./routes/alertas.routes');
const rotasCRM = require('./routes/crm.routes');
const rotasCredenciais = require('./routes/credenciais.routes');
const rotasBotVariables = require('./routes/bot-variables.routes');
const rotasUsuarios = require('./routes/usuarios.routes');
const rotasAgenda = require('./routes/agenda.routes');
const rotasEspecialistas = require('./routes/especialistas.routes');
const rotasCatalogo = require('./routes/catalogo.routes');
const rotasEstoque = require('./routes/estoque.routes');
const rotasFornecedores = require('./routes/fornecedores.routes');
const rotasNotasCompra = require('./routes/notas-compra.routes');
const rotasAdminCredenciais = require('./routes/admin-credenciais.routes');
const rotasAdminCredencialIA = require('./routes/admin-credencial-ia.routes');
const rotasFinanceiro = require('./routes/financeiro.routes');
const rotasContasPagar = require('./routes/contas-pagar.routes');
const rotasNotificacoes = require('./routes/notificacoes.routes');
const rotasRelatoriosMensais = require('./routes/relatorios-mensais.routes');
const rotasVendas = require('./routes/vendas.routes');
const rotasCmv = require('./routes/cmv.routes');
const rotasRelatorios = require('./routes/relatorios.routes');
const rotasCampanhas = require('./routes/campanhas.routes');
const rotasPagamentos = require('./routes/pagamentos.routes');
const rotasFiscal = require('./routes/fiscal.routes');
const rotasWebhooks = require('./routes/webhooks.routes');
const rotasFaq = require('./routes/faq.routes');
const rotasWebhooksWhatsapp = require('./routes/webhooksWhatsapp.routes');
const CrmUsuariosController = require('./controllers/CrmUsuariosController');
const middlewareAutenticacao = require('./middlewares/auth.middleware');
const { SEGREDO_JWT } = require('./middlewares/auth.middleware');
const { limitadorApi } = require('./middlewares/rateLimit.middleware');
const middlewareCsrf = require('./middlewares/csrf.middleware');
const { NOME_SESSAO, lerCookie } = require('./utils/sessaoCookie');

// Origens permitidas por CORS. Em desenvolvimento, libera localhost.
// Em producao, exige a variavel CORS_ORIGINS (lista separada por virgula).
const origensPermitidas = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

const opcoesCors = {
  origin: (origem, callback) => {
    // Requisicoes sem origem (ex.: curl, mobile, server-to-server) sao permitidas.
    if (!origem) return callback(null, true);
    if (origensPermitidas.includes(origem)) return callback(null, true);
    return callback(new Error(`Origem nao permitida pelo CORS: ${origem}`));
  },
  credentials: true,
};

const app = express();
// Atras de proxy/tunel (ngrok, nginx, load balancer): confia no
// primeiro hop pra que req.ip e X-Forwarded-For funcionem corretamente.
// Necessario pro express-rate-limit nao reclamar e identificar o cliente real.
app.set('trust proxy', 1);
const servidor = http.createServer(app);
const io = new Server(servidor, {
  cors: opcoesCors,
});

// Autenticacao do Socket.IO via JWT no handshake.
io.use((socket, next) => {
  // Mesma ordem do middleware HTTP: cookie httpOnly primeiro (navegador),
  // depois as formas explicitas usadas por clientes fora do navegador.
  const token = lerCookie(socket.handshake, NOME_SESSAO)
    || socket.handshake?.auth?.token
    || socket.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return next(new Error('Token nao fornecido'));
  }

  try {
    const dados = jwt.verify(token, SEGREDO_JWT);
    socket.usuario = dados;
    return next();
  } catch (erro) {
    return next(new Error('Token invalido ou expirado'));
  }
});

app.use(helmet());
app.use(cors(opcoesCors));

// Captura o corpo cru (rawBody) junto do parse JSON — necessario pros webhooks
// de PSP que validam assinatura HMAC sobre o payload original (Frente 2).
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// Defesa contra CSRF — obrigatoria porque a sessao vive em cookie e o navegador
// o envia sozinho. Registrado no nivel do app para que nenhuma rota nova nasca
// desprotegida por esquecimento. Detalhes e isencoes no proprio middleware.
app.use(middlewareCsrf);

// Imagens — intercepta `res.json` e troca `imagemUrl` por URL assinada
// (bucket privado + pre-signed URL). Plugado APOS o parser e ANTES das
// rotas autenticadas pra cobrir todas elas.
const imagensAssinadasMiddleware = require('./middlewares/imagensAssinadas.middleware');
app.use(imagensAssinadasMiddleware);

// Injecao do Socket.io nas requisicoes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rate limiting geral da API — defesa contra flood/DoS nos endpoints (agregacoes
// caras rodavam sem teto). Webhooks e /saude ficam de fora (ver o middleware).
app.use(limitadorApi);

// Rotas Base
app.use('/autenticacao', rotasAutenticacao);
app.use('/usuarios', rotasUsuarios);

// Gerenciamento de Usuarios do Cliente (CRM)
const routerCrmUsuarios = express.Router();
routerCrmUsuarios.use(middlewareAutenticacao);
routerCrmUsuarios.get('/', (req, res) => CrmUsuariosController.listar(req, res));
routerCrmUsuarios.post('/', (req, res) => CrmUsuariosController.criar(req, res));
routerCrmUsuarios.put('/:id', (req, res) => CrmUsuariosController.atualizar(req, res));
routerCrmUsuarios.delete('/:id', (req, res) => CrmUsuariosController.excluir(req, res));
app.use('/crm/usuarios', routerCrmUsuarios);

app.use('/clientes', rotasClientes);
app.use('/bots', rotasBots);
app.use('/alertas', rotasAlertas);
app.use('/crm', rotasCRM);
app.use('/credenciais', rotasCredenciais);
app.use('/bot-variables', rotasBotVariables);
app.use('/agenda', rotasAgenda);
app.use('/especialistas', rotasEspecialistas);
app.use('/catalogo', rotasCatalogo);
app.use('/estoque', rotasEstoque);
app.use('/fornecedores', rotasFornecedores);
app.use('/notas-compra', rotasNotasCompra);
// Admin gerencia as integracoes (credenciais) de cada cliente — rota segura, admin-only.
app.use('/admin/clientes', rotasAdminCredenciais);
// Credencial de IA da PLATAFORMA (uma so, da Sellergy) — rota separada da
// acima porque nao pertence a nenhum cliente.
app.use('/admin/plataforma', rotasAdminCredencialIA);
app.use('/financeiro', rotasFinanceiro);
app.use('/contas-pagar', rotasContasPagar);
app.use('/notificacoes', rotasNotificacoes);
app.use('/relatorios-mensais', rotasRelatoriosMensais);
app.use('/vendas', rotasVendas);
app.use('/relatorios', rotasRelatorios);
app.use('/campanhas', rotasCampanhas);
app.use('/faq', rotasFaq);
app.use('/pagamentos', rotasPagamentos);
app.use('/fiscal', rotasFiscal);

// Webhooks externos — SEM autenticacao de usuario (o chamador e o provedor/Meta;
// a autenticidade vem da assinatura/verify token validada no handler).
app.use('/webhooks', rotasWebhooks);          // pagamento (Frente 2)
app.use('/webhooks', rotasWebhooksWhatsapp);  // whatsapp (Frente 4)

// Rota de Teste de Saude (Health Check)
app.get('/saude', (req, res) => {
  res.json({ status: 'ok', data: new Date() });
});

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id, 'usuario:', socket.usuario?.id);

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORTA = process.env.BACKEND_PORT || 3333;

servidor.listen(PORTA, async () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
  // Garante que o bucket de midias existe (privado — acesso via URL assinada).
  try {
    const { garantirBucket } = require('./storage/minio');
    const r = await garantirBucket();
    if (r.criado) console.log('[boot] Bucket de midias criado.');
  } catch (e) {
    console.error('[boot] Falha ao garantir bucket:', e?.message);
  }

  // Cron diario do caixa (00:01) — fecha sessoes AUTO_BOT e abre novas com
  // fundo = saldo final. Manual fica intocado.
  try {
    const { iniciar: iniciarCronCaixa } = require('./jobs/cronCaixaDiario');
    iniciarCronCaixa();
  } catch (e) {
    console.error('[boot] Falha ao inicializar cron diario do caixa:', e?.message);
  }

  // Cron mensal — dia 1 (aviso), dia 5 (aviso) e dia 7 (gera snapshot do
  // mês anterior + notifica que está pronto). Roda 03:00 BRT todo dia.
  try {
    const { iniciar: iniciarCronMensal } = require('./jobs/cronRelatorioMensal');
    iniciarCronMensal();
  } catch (e) {
    console.error('[boot] Falha ao inicializar cron mensal:', e?.message);
  }
});

const { fecharFilas } = require('./filas');

async function encerrar(sinal) {
  console.log(`Sinal ${sinal} recebido, encerrando servidor...`);
  servidor.close(() => console.log('HTTP fechado.'));
  try {
    await fecharFilas();
  } catch (erro) {
    console.error('Erro ao fechar filas:', erro);
  }
  process.exit(0);
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
