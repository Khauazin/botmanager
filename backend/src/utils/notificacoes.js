// =====================================================================
// Helper de criação de notificações com checagem de opt-in
// =====================================================================
// Centraliza a regra: antes de gravar, verifica `PreferenciaNotificacao`
// do usuário (se houver `usuarioId`). Sem preferência cadastrada =
// considera ativo (default opt-in). Se inativa, pula sem erro.
//
// Quando `usuarioId` for null, a notificação vai pro tenant inteiro
// (todos os usuários do `clienteId`) — opt-in não se aplica nesse caso
// porque é avisamento amplo. Usuários podem filtrar no front se quiserem.
//
// Uso:
//   const { criarNotificacao } = require('../utils/notificacoes');
//   await criarNotificacao(prisma, {
//     clienteId: '...',
//     usuarioId: '...',           // opcional
//     tipo: 'LEMBRETE_FECHAMENTO_MES',
//     titulo: 'Hora de lançar suas despesas',
//     mensagem: 'O mês fecha em 2 dias. Garanta que tudo está lançado.',
//     link: '/app/financeiro/lancamentos',
//     dados: { diasRestantes: 2 },
//   });

const TIPOS_VALIDOS = new Set([
  'LEMBRETE_FECHAMENTO_MES',
  'RELATORIO_MENSAL_PRONTO',
  'CAIXA_AUTO_FECHADO',
  'CAIXA_DIVERGENCIA',
  'CONTA_PAGAR_VENCENDO',
  'DEVOLUCAO_PROXIMA',
  'GENERICA',
]);

// Cria uma notificação se o usuário não tiver desativado o tipo.
// `client` pode ser `prisma` global ou uma transação `tx`.
async function criarNotificacao(client, {
  clienteId,
  usuarioId = null,
  tipo,
  titulo,
  mensagem,
  link = null,
  dados = null,
}) {
  if (!clienteId) throw new Error('criarNotificacao: clienteId obrigatório.');
  if (!TIPOS_VALIDOS.has(tipo)) throw new Error(`criarNotificacao: tipo inválido (${tipo}).`);
  if (!titulo || !mensagem) throw new Error('criarNotificacao: título e mensagem obrigatórios.');

  // Quando direcionada a usuário, respeita opt-out.
  if (usuarioId) {
    const pref = await client.preferenciaNotificacao.findUnique({
      where: { usuarioId_tipo: { usuarioId, tipo } },
      select: { ativa: true },
    });
    if (pref && pref.ativa === false) {
      return null; // usuário desativou esse tipo — não cria
    }
  }

  return client.notificacao.create({
    data: { clienteId, usuarioId, tipo, titulo, mensagem, link, dados },
  });
}

// Cria a mesma notificação pra TODOS os usuários ativos de um tenant.
// Respeita opt-out individual de cada um. Útil pra "Relatório mensal pronto".
async function criarNotificacaoTenant(client, { clienteId, ...payload }) {
  const usuarios = await client.usuario.findMany({
    where: { clienteId },
    select: { id: true },
  });
  const criadas = [];
  for (const u of usuarios) {
    const n = await criarNotificacao(client, { ...payload, clienteId, usuarioId: u.id });
    if (n) criadas.push(n);
  }
  return criadas;
}

module.exports = { criarNotificacao, criarNotificacaoTenant, TIPOS_VALIDOS };
