import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/LoginPage';
import ClientLoginPage from './pages/ClientLoginPage';
import LandingPage from './pages/LandingPage';
import AdminLayout from './components/AdminLayout';
import ClientLayout from './components/ClientLayout';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientProfilePage from './pages/ClientProfilePage';
import BotsPage from './pages/BotsPage';
import AlertsPage from './pages/AlertsPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import CRMPage from './pages/CRMPage';
import BuilderPage from './pages/BuilderPage';
import BotSettingsPage from './pages/BotSettingsPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
import AgendaPage from './pages/AgendaPage';
import FinanceiroPage from './pages/FinanceiroPage';

// Placeholder para as páginas que ainda vamos criar
const EmConstrucao = ({ titulo }) => (
  <div className="h-full flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-12">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">{titulo}</h2>
      <p className="text-gray-400">Página em construção... Estaremos trabalhando nisso já já!</p>
    </div>
  </div>
);

// Wrapper para rotas protegidas
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Wrapper para rotas estritas do Cliente
const ClientRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'ADMIN') return <Navigate to="/app/login" replace />;
  return children;
};

// Wrapper para rotas estritas do Admin
const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'CLIENT') return <Navigate to="/admin/login" replace />;
  return children;
};

export default function App() {
  const { checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-medium">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<LoginPage isAdmin={true} />} />
        <Route path="/app/login" element={<ClientLoginPage />} />
        <Route path="/" element={<LandingPage />} />
        
        {/* Redirecionamentos de conveniência e legados */}
        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/builder/:botId" element={<Navigate to="/admin/builder/:botId" replace />} />

        {/* Ecossistema ADMIN */}
        <Route element={<ProtectedRoute><AdminRoute><AdminLayout /></AdminRoute></ProtectedRoute>}>
          {/* Se entrar só em /admin, joga pro dashboard */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/clientes" element={<ClientsPage />} />
          <Route path="/admin/clientes/:id" element={<ClientProfilePage />} />
          <Route path="/admin/bots" element={<BotsPage />} />
          <Route path="/admin/alertas" element={<AlertsPage />} />
          <Route path="/admin/usuarios" element={<UsersPage />} />
          <Route path="/admin/relatorios" element={<ReportsPage />} />
          <Route path="/admin/builder/:botId" element={<BuilderPage />} />
        </Route>

        {/* Ecossistema CLIENT (CRM) */}
        <Route element={<ProtectedRoute><ClientRoute><ClientLayout /></ClientRoute></ProtectedRoute>}>
          <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
          
          <Route path="/app/dashboard" element={<ClientDashboardPage />} />
          <Route path="/app/crm" element={<CRMPage />} />
          <Route path="/app/agenda" element={<AgendaPage />} />
          <Route path="/app/financeiro" element={<FinanceiroPage />} />
          <Route path="/app/configuracoes" element={<BotSettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
