import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import {
  LayoutDashboard,
  Users,
  Bot,
  BellRing,
  LogOut,
  Menu,
  Workflow,
  Kanban,
  Settings,
  Calendar,
  DollarSign,
  Package,
  Box
} from 'lucide-react';
import clsx from 'clsx';

export default function ClientLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/app/login');
  };

  const navItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/crm', label: 'CRM / Inbox', icon: Kanban },
    { path: '/app/agenda', label: 'Agenda', icon: Calendar },
    { path: '/app/catalogo', label: 'Catálogo', icon: Package },
    { path: '/app/estoque', label: 'Estoque', icon: Box },
    { path: '/app/financeiro', label: 'Financeiro', icon: DollarSign },
    { path: '/app/configuracoes', label: 'Ajustes', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex overflow-hidden">

      {/* Background Glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[150px] pointer-events-none" />

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-black/40 backdrop-blur-xl border-r border-white/10 transition-transform duration-300 ease-in-out transform",
          !isSidebarOpen && "-translate-x-full"
        )}
      >
        <div className="h-20 flex items-center justify-center border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">BotManager</span>
          </div>
        </div>

        <nav className="p-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                isActive
                  ? "text-white bg-white/10 border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  )}
                  <item.icon className={clsx("w-5 h-5 transition-transform duration-200", isActive ? "scale-110 text-blue-400" : "group-hover:scale-110")} />
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-white/5 bg-black/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={clsx(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 overflow-hidden",
          isSidebarOpen ? "ml-64" : "ml-0"
        )}
      >
        {/* Topbar */}
        <header className="h-20 bg-transparent backdrop-blur-sm border-b border-white/0 sticky top-0 z-10 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold text-white capitalize">
              {location.pathname.substring(1) || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-white">{user?.name}</span>
              <span className="text-xs text-blue-400">{user?.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center shadow-inner">
              <span className="text-sm font-bold text-white">{user?.name?.charAt(0)}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 relative overflow-hidden" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Outlet />
        </div>
      </main>

    </div>
  );
}
