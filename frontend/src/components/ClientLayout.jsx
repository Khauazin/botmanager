import { useState, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Kanban, Calendar, Package, Box,
  DollarSign, MessageCircle, Send, Bot, Settings, BarChart3, UserCog,
  CreditCard, Receipt, RotateCcw
} from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuthStore } from '../store/auth.store';
import { moduloLiberado } from '../constants/permissoes';

// Mapeamento dos itens da sidebar para os modulos do tenant.
// Itens cujo modulo nao foi liberado pelo admin sao escondidos.
const NAV_OPERACAO = [
  { to: '/app/dashboard', label: 'Início', icon: LayoutDashboard, modulo: null },
  { to: '/app/crm', label: 'Clientes', icon: Kanban, modulo: 'CRM' },
  { to: '/app/agenda', label: 'Agenda', icon: Calendar, modulo: 'AGENDA' },
  { to: '/app/vendas', label: 'Vendas', icon: ShoppingBag, modulo: 'VENDAS' },
  { to: '/app/devolucoes', label: 'Devoluções', icon: RotateCcw, modulo: 'VENDAS' },
  { to: '/app/catalogo', label: 'Serviços', icon: Package, modulo: 'CATALOGO' },
  {
    to: '/app/estoque',
    label: 'Estoque',
    icon: Box,
    modulo: 'ESTOQUE',
    subItems: [
      { to: '/app/estoque/visao-geral', label: 'Visão geral' },
      { to: '/app/estoque/produtos', label: 'Produtos' },
      { to: '/app/estoque/movimentacoes', label: 'Movimentações' },
      { to: '/app/estoque/reposicao', label: 'Reposição' },
      { to: '/app/estoque/categorias', label: 'Categorias' },
      { to: '/app/estoque/fornecedores', label: 'Fornecedores' },
      { to: '/app/estoque/notas', label: 'Entrada de nota' },
    ],
  },
];

const NAV_GESTAO = [
  {
    to: '/app/financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    modulo: 'FINANCEIRO',
    subItems: [
      { to: '/app/financeiro/lancamentos', label: 'Lançamentos' },
      { to: '/app/financeiro/caixa', label: 'Caixa' },
      { to: '/app/financeiro/contas-pagar', label: 'Contas a pagar' },
      { to: '/app/financeiro/categorias', label: 'Categorias' },
    ],
  },
  { to: '/app/pagamentos', label: 'Pagamentos', icon: CreditCard, modulo: 'PAGAMENTOS' },
  { to: '/app/fiscal', label: 'Fiscal', icon: Receipt, modulo: 'FISCAL' },
  {
    to: '/app/relatorios',
    label: 'Relatorios',
    icon: BarChart3,
    modulo: 'RELATORIOS',
    subItems: [
      { to: '/app/relatorios/visao-executiva', label: 'Visão executiva' },
      { to: '/app/relatorios/mensais', label: 'Fechamento mensal' },
      { to: '/app/relatorios/crm', label: 'CRM' },
      { to: '/app/relatorios/financeiro', label: 'Financeiro' },
      { to: '/app/relatorios/caixa', label: 'Caixa' },
      { to: '/app/relatorios/vendas', label: 'Vendas' },
      { to: '/app/relatorios/estoque', label: 'Estoque & CMV' },
      { to: '/app/relatorios/bots', label: 'Bots / IA' },
    ],
  },
];

const NAV_AUTOMACAO = [
  { to: '/app/bots', label: 'Bots', icon: Bot, modulo: 'BOTS' },
  { to: '/app/campanhas', label: 'Campanhas', icon: Send, modulo: 'CRM' },
];

const TITULOS = {
  '/app/dashboard': { titulo: 'Início', breadcrumb: 'Painel' },
  '/app/crm': { titulo: 'Clientes', breadcrumb: 'Atendimento' },
  '/app/agenda': { titulo: 'Agenda', breadcrumb: 'Operacao' },
  '/app/vendas': { titulo: 'Vendas', breadcrumb: 'Operacao' },
  '/app/devolucoes': { titulo: 'Devoluções', breadcrumb: 'Operacao' },
  '/app/catalogo': { titulo: 'Serviços', breadcrumb: 'Operacao' },
  '/app/estoque': { titulo: 'Estoque', breadcrumb: 'Produtos' },
  '/app/estoque/visao-geral': { titulo: 'Estoque · Visão geral', breadcrumb: 'Estoque · Produtos' },
  '/app/estoque/produtos': { titulo: 'Estoque · Produtos', breadcrumb: 'Estoque · Produtos' },
  '/app/estoque/movimentacoes': { titulo: 'Estoque · Movimentações', breadcrumb: 'Estoque · Produtos' },
  '/app/estoque/reposicao': { titulo: 'Estoque · Reposição', breadcrumb: 'Estoque · Produtos' },
  '/app/estoque/categorias': { titulo: 'Estoque · Categorias', breadcrumb: 'Estoque · Produtos' },
  '/app/estoque/fornecedores': { titulo: 'Estoque · Fornecedores', breadcrumb: 'Estoque · Compras' },
  '/app/estoque/notas': { titulo: 'Estoque · Entrada de nota', breadcrumb: 'Estoque · Compras' },
  '/app/financeiro': { titulo: 'Financeiro', breadcrumb: 'Gestao' },
  '/app/financeiro/lancamentos': { titulo: 'Financeiro · Lançamentos', breadcrumb: 'Gestão' },
  '/app/financeiro/caixa': { titulo: 'Financeiro · Caixa', breadcrumb: 'Gestão' },
  '/app/financeiro/contas-pagar': { titulo: 'Financeiro · Contas a pagar', breadcrumb: 'Gestão' },
  '/app/financeiro/categorias': { titulo: 'Financeiro · Categorias', breadcrumb: 'Gestão' },
  '/app/pagamentos': { titulo: 'Pagamentos', breadcrumb: 'Gestão' },
  '/app/fiscal': { titulo: 'Fiscal', breadcrumb: 'Gestão' },
  '/app/relatorios': { titulo: 'Relatorios', breadcrumb: 'Gestao' },
  '/app/relatorios/visao-executiva': { titulo: 'Relatório · Visão executiva', breadcrumb: 'Relatórios · Gestão' },
  '/app/relatorios/mensais': { titulo: 'Fechamento mensal', breadcrumb: 'Relatórios · Gestão' },
  '/app/relatorios/crm': { titulo: 'Relatório · CRM', breadcrumb: 'Relatórios · Gestão' },
  '/app/relatorios/financeiro': { titulo: 'Relatório · Financeiro', breadcrumb: 'Relatórios · Gestão' },
  '/app/relatorios/caixa': { titulo: 'Relatório · Caixa', breadcrumb: 'Relatórios · Gestão' },
  '/app/relatorios/vendas': { titulo: 'Relatório · Vendas', breadcrumb: 'Relatórios · Gestão' },
  '/app/relatorios/estoque': { titulo: 'Relatório · Estoque & CMV', breadcrumb: 'Relatórios · Gestão' },
  '/app/relatorios/bots': { titulo: 'Relatório · Bots / IA', breadcrumb: 'Relatórios · Gestão' },
  '/app/bots': { titulo: 'Bots', breadcrumb: 'Automacao' },
  '/app/campanhas': { titulo: 'Campanhas', breadcrumb: 'Automacao' },
  '/app/usuarios': { titulo: 'Equipe', breadcrumb: 'Conta' },
  '/app/configuracoes': { titulo: 'Configuracoes', breadcrumb: 'Conta' },
};

export default function ClientLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const modulosLiberados = user?.modulosLiberados || {};

  // Filtra os itens conforme os modulos liberados pelo admin para este tenant.
  const sections = useMemo(() => {
    const filtra = (arr) => arr.filter((item) => !item.modulo || moduloLiberado(modulosLiberados, item.modulo));
    const operacao = filtra(NAV_OPERACAO);
    const gestao = filtra(NAV_GESTAO);
    const automacao = NAV_AUTOMACAO.filter((item) => moduloLiberado(modulosLiberados, item.modulo));

    const result = [];
    if (operacao.length) result.push({ titulo: 'Operação', items: operacao });
    if (gestao.length) result.push({ titulo: 'Gestão', items: gestao });
    if (automacao.length) result.push({ titulo: 'Automação', items: automacao });
    return result;
  }, [modulosLiberados]);

  const meta = TITULOS[location.pathname] || { titulo: 'Sellergy Cloud', breadcrumb: '' };

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <Sidebar
        sections={sections}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        branding={user?.branding}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--bg-overlay)] backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-20 min-h-screen flex flex-col">
        <Topbar
          titulo={meta.titulo}
          breadcrumb={meta.breadcrumb}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Full-width: o conteudo ocupa toda a largura disponivel. Paginas
              com formulario (Configuracoes, PerfilPage, CrmUsersPage) tem
              max-w proprio e continuam centradas — listas/tabelas/dashboards
              esticam pra aproveitar a tela inteira. */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
