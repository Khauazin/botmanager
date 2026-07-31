// Catalogo de modulos do sistema Sellergy Cloud.
// Mantem em sync com backend/src/controllers/CrmUsuariosController.js (MODULOS_CRM)
// e backend/src/middlewares/permissoes.middleware.js.

import {
  Bot,
  Kanban,
  Calendar,
  Package,
  Box,
  DollarSign,
  ShoppingBag,
  Users,
  AlertTriangle,
  BarChart3,
  CreditCard,
  Receipt,
  ShieldAlert,
} from 'lucide-react';

/**
 * Modulos liberados pelo ADMIN no nivel do CLIENTE (tenant).
 * Esses sao os modulos que o cliente "comprou" / tem acesso na assinatura.
 */
export const MODULOS_TENANT = [
  {
    id: 'BOTS',
    nome: 'Bots & Automacao',
    icone: Bot,
    descricao: 'Gerenciar bots de WhatsApp. Inclui o construtor visual de fluxos e variaveis.',
    rotaApp: '/admin/bots', // rota onde o cliente acessa
  },
  {
    id: 'WHATSAPP_BAILEYS',
    nome: 'WhatsApp nao oficial (QR Code)',
    icone: ShieldAlert,
    descricao: 'Conexao alternativa via WhatsApp Web (sem aprovacao da Meta). Risco real de banimento do numero em uso de disparo em massa — liberar so pra cliente ciente do risco.',
    rotaApp: '/app/bots',
  },
  {
    id: 'CRM',
    nome: 'CRM & Leads',
    icone: Kanban,
    descricao: 'Funil de vendas em Kanban, gestao de leads, fases personalizaveis e historico de interacoes.',
    rotaApp: '/app/crm',
  },
  {
    id: 'AGENDA',
    nome: 'Agenda',
    icone: Calendar,
    descricao: 'Agendamentos de servicos, calendario por dia/mes e integracao com leads.',
    rotaApp: '/app/agenda',
  },
  {
    id: 'CATALOGO',
    nome: 'Catalogo de Servicos',
    icone: Package,
    descricao: 'Cadastro de servicos prestados (corte, consulta, atendimento) com preco e duracao.',
    rotaApp: '/app/catalogo',
  },
  {
    id: 'ESTOQUE',
    nome: 'Estoque',
    icone: Box,
    descricao: 'Cadastro e gestao de produtos fisicos: quantidade, movimentacoes, alertas e reposicao.',
    rotaApp: '/app/estoque',
  },
  {
    id: 'FINANCEIRO',
    nome: 'Financeiro',
    icone: DollarSign,
    descricao: 'Lancamentos, contas a pagar (recorrentes/pontuais), caixa (abertura/fechamento, retiradas, entradas), categorias e fluxo de caixa.',
    rotaApp: '/app/financeiro/lancamentos',
  },
  {
    id: 'VENDAS',
    nome: 'Vendas',
    icone: ShoppingBag,
    descricao: 'Registro de vendas com baixa automatica de estoque e lancamento financeiro.',
    rotaApp: '/app/vendas',
  },
  {
    id: 'PAGAMENTOS',
    nome: 'Pagamentos',
    icone: CreditCard,
    descricao: 'Recebimento integrado: Pix, link de pagamento e recorrencia, com confirmacao automatica. Cobrancas vinculadas a vendas e agendamentos.',
    rotaApp: '/app/pagamentos',
  },
  {
    id: 'FISCAL',
    nome: 'Fiscal',
    icone: Receipt,
    descricao: 'Emissao de nota via provedor (NFC-e para loja, NFS-e para servico) e acompanhamento dos documentos emitidos.',
    rotaApp: '/app/fiscal',
  },
  {
    id: 'ALERTAS',
    nome: 'Alertas',
    icone: AlertTriangle,
    descricao: 'Notificacoes de eventos importantes do sistema (bots offline, estoque critico, falhas).',
    rotaApp: '/admin/alertas',
  },
  {
    id: 'RELATORIOS',
    nome: 'Relatorios',
    icone: BarChart3,
    descricao: 'Dashboards consolidados (Visao executiva, Financeiro, Vendas, Caixa, Estoque, Bots) + fechamento mensal + exportacao em CSV, Excel e PDF.',
    rotaApp: '/app/relatorios/visao-executiva',
  },
  {
    id: 'USUARIOS',
    nome: 'Equipe & Usuarios',
    icone: Users,
    descricao: 'Cadastro de colaboradores e gestao de permissoes dentro do CRM.',
    rotaApp: '/app/usuarios',
  },
];

/**
 * Modulos disponiveis para concessao a colaboradores (subset dos modulos do tenant).
 * Nao inclui USUARIOS (so o dono CLIENT e ADMINISTRADOR podem mexer em equipe).
 */
// Exclui USUARIOS (so o dono mexe em equipe), PAGAMENTOS/FISCAL (dinheiro e
// nota — sensiveis; ficam fora da matriz de colaborador ate as telas reais +
// um gating granular existirem; por ora so o dono/admin acessa) e
// WHATSAPP_BAILEYS (risco de banimento do numero — decisao do dono/admin do
// tenant, nao um CRUD delegavel a colaborador).
export const MODULOS_COLABORADOR = MODULOS_TENANT.filter(
  (m) => !['USUARIOS', 'PAGAMENTOS', 'FISCAL', 'WHATSAPP_BAILEYS'].includes(m.id)
);

/**
 * Modulos auto-ativados por segmento ao CRIAR um cliente (onboarding sem atrito).
 * Espelha backend/src/utils/modulosSegmento.js — manter os dois em sync.
 *   - BASE: todo tenant precisa pra operar (servico tambem gera venda).
 *   - SERVICO -> + AGENDA · PRODUTO -> + ESTOQUE · HIBRIDO -> + AGENDA + ESTOQUE
 */
export const MODULOS_BASE_TENANT = [
  'BOTS', 'CRM', 'CATALOGO', 'FINANCEIRO', 'VENDAS', 'RELATORIOS', 'ALERTAS', 'USUARIOS', 'PAGAMENTOS', 'FISCAL',
];
export const MODULOS_EXTRA_POR_SEGMENTO = {
  SERVICO: ['AGENDA'],
  PRODUTO: ['ESTOQUE'],
  HIBRIDO: ['AGENDA', 'ESTOQUE'],
};

/** Lista de IDs de modulos que serao ativados pro segmento (BASE + extras). */
export function modulosDoSegmento(segmento) {
  const extras = MODULOS_EXTRA_POR_SEGMENTO[String(segmento || '').toUpperCase()] || [];
  return [...MODULOS_BASE_TENANT, ...extras];
}

/**
 * Gating da tela de Usuarios & Equipe por segmento. Espelha (mesmos nomes e
 * semantica) backend/src/utils/modulosSegmento.js — manter os dois em sync.
 *
 * Tipos de usuario (UI/negocio) -> Perfil + (Especialista):
 *   ADMINISTRADOR / VENDEDOR / RECEPCAO (preset, persiste como VENDEDOR) /
 *   ESPECIALISTA (VENDEDOR + registro Especialista). Loja so tem Admin/Vendedor;
 *   clinica tem Admin/Especialista/Recepcao; hibrido tem todos (doc erp-pivo §6.1).
 */
const normSeg = (segmento) => String(segmento || '').toUpperCase();

export const TIPOS_POR_SEGMENTO = {
  PRODUTO: ['ADMINISTRADOR', 'VENDEDOR'],
  SERVICO: ['ADMINISTRADOR', 'ESPECIALISTA', 'RECEPCAO'],
  HIBRIDO: ['ADMINISTRADOR', 'VENDEDOR', 'ESPECIALISTA', 'RECEPCAO'],
};
const TODOS_OS_TIPOS = ['ADMINISTRADOR', 'VENDEDOR', 'ESPECIALISTA', 'RECEPCAO'];
export function tiposPorSegmento(segmento) {
  return TIPOS_POR_SEGMENTO[normSeg(segmento)] || TODOS_OS_TIPOS;
}
export function segmentoPermiteEspecialista(segmento) {
  return tiposPorSegmento(segmento).includes('ESPECIALISTA');
}

// Modulos concediveis por segmento (loja esconde AGENDA; clinica esconde
// ESTOQUE; VENDAS compartilhado). MENSAGENS saiu no pivo.
const MODULOS_COMPARTILHADOS = ['CRM', 'CATALOGO', 'FINANCEIRO', 'VENDAS', 'RELATORIOS', 'ALERTAS'];
export const MODULOS_POR_SEGMENTO = {
  PRODUTO: [...MODULOS_COMPARTILHADOS, 'ESTOQUE'],
  SERVICO: [...MODULOS_COMPARTILHADOS, 'AGENDA'],
  HIBRIDO: [...MODULOS_COMPARTILHADOS, 'AGENDA', 'ESTOQUE'],
};
const TODOS_OS_MODULOS = [...MODULOS_COMPARTILHADOS, 'AGENDA', 'ESTOQUE'];
export function modulosPorSegmento(segmento) {
  return MODULOS_POR_SEGMENTO[normSeg(segmento)] || TODOS_OS_MODULOS;
}

/**
 * Acoes que podem ser concedidas dentro de cada modulo.
 */
export const ACOES = [
  {
    id: 'visualizar',
    nome: 'Visualizar',
    descricao: 'Pode acessar a tela e ver os dados em modo de leitura.',
  },
  {
    id: 'criar',
    nome: 'Criar',
    descricao: 'Pode adicionar novos registros (cadastrar produtos, lancamentos, leads, etc.).',
  },
  {
    id: 'editar',
    nome: 'Editar',
    descricao: 'Pode alterar registros existentes, mudar status e atualizar informacoes.',
  },
  {
    id: 'excluir',
    nome: 'Excluir',
    descricao: 'Pode remover registros permanentemente. Conceda com cautela.',
  },
];

/**
 * Acoes especificas de modulos que fogem do CRUD padrao. Vazio por enquanto
 * (a Inbox/MENSAGENS, unico caso, saiu no pivo ERP-first).
 */
export const ACOES_POR_MODULO = {};

/** Retorna a lista de acoes de um modulo (CRUD padrao se nao houver override). */
export function acoesDoModulo(moduloId) {
  return ACOES_POR_MODULO[moduloId] || ACOES;
}

/**
 * Modulos com dimensao de ESCOPO: o usuario ve "proprias" (atribuidas a ele) ou
 * "todas". AGENDA usa quando o especialista passa a ver so a propria agenda.
 */
export const MODULOS_COM_ESCOPO = new Set(['AGENDA']);

export const ESCOPOS = [
  { id: 'PROPRIAS', nome: 'Apenas as proprias', descricao: 'So as conversas atribuidas a este usuario.' },
  { id: 'TODAS', nome: 'Todas', descricao: 'Todas as conversas do negocio.' },
];

/** Indica se um modulo usa a dimensao de escopo. */
export function temEscopo(moduloId) {
  return MODULOS_COM_ESCOPO.has(moduloId);
}

/** Le o escopo concedido a um modulo (default PROPRIAS = mais restritivo). */
export function escopoDe(permissoes, modulo) {
  return permissoes?.[modulo]?.escopo === 'TODAS' ? 'TODAS' : 'PROPRIAS';
}

/**
 * Estrutura inicial vazia (todas as permissoes false) para um novo VENDEDOR.
 */
export function permissoesVazias() {
  const permissoes = {};
  for (const modulo of MODULOS_COLABORADOR) {
    const p = {};
    for (const acao of acoesDoModulo(modulo.id)) p[acao.id] = false;
    if (temEscopo(modulo.id)) p.escopo = 'PROPRIAS';
    permissoes[modulo.id] = p;
  }
  return permissoes;
}

/**
 * Estrutura completa (todas true) - usada visualmente para o preset ADMINISTRADOR.
 */
export function permissoesCompletas() {
  const permissoes = {};
  for (const modulo of MODULOS_COLABORADOR) {
    const p = {};
    for (const acao of acoesDoModulo(modulo.id)) p[acao.id] = true;
    if (temEscopo(modulo.id)) p.escopo = 'TODAS';
    permissoes[modulo.id] = p;
  }
  return permissoes;
}

/**
 * Helper para verificar se uma permissao esta concedida no objeto permissoes.
 */
export function temPermissao(permissoes, modulo, acao) {
  return permissoes?.[modulo]?.[acao] === true;
}

/**
 * Helper para verificar se um modulo esta liberado pelo admin.
 */
export function moduloLiberado(modulosLiberados, modulo) {
  return modulosLiberados?.[modulo] === true;
}
