import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Bot, Lock, Mail, Loader2, ArrowRight, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, isLoading, isAuthenticated, checkAuth, user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        // Força logout se um Admin tentar acessar login de Cliente
        logout();
      } else if (user.role === 'CLIENT') {
        navigate('/app/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate, logout]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex w-full">
      {/* Lado Esquerdo - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
        
        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">BotManager</span>
          </div>

          <div className="mb-10">
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-gray-400 text-base">
              Acesse sua conta para gerenciar seus agendamentos, vendas e inteligência artificial.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-300 ml-1">Seu E-mail Profissional</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-600"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-semibold text-gray-300">Sua Senha</label>
                <a href="#" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Esqueceu a senha?</a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl py-4 px-4 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed mt-6 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Acessar Meu Painel</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            Precisa de ajuda? <a href="#" className="text-white hover:text-blue-400 transition-colors underline decoration-white/20 underline-offset-4">Fale com o suporte</a>
          </p>
        </div>
      </div>

      {/* Lado Direito - Branding / Banner (Oculto em Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-[#050505] relative items-center justify-center p-12 overflow-hidden border-l border-white/5">
        
        {/* Abstract Background Design */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-[#050505] to-[#050505]"></div>
        <div className="absolute top-20 right-20 w-72 h-72 bg-indigo-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-[100px]"></div>

        <div className="relative z-10 max-w-lg">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                <Sparkles className="text-blue-400 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">A Nova Era do CRM</h3>
                <p className="text-blue-400 text-sm font-medium">Gestão + Inteligência Artificial</p>
              </div>
            </div>
            
            <p className="text-gray-300 leading-relaxed mb-8">
              Transformamos a maneira como clínicas e negócios de serviços agendam e vendem. Deixe o trabalho pesado de recepção para os nossos Agentes de Inteligência Artificial e foque no que importa: o seu cliente.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-gray-200">Aumente seus agendamentos em até 40%</span>
              </div>
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-200">Plataforma 100% segura e em nuvem</span>
              </div>
            </div>
          </div>

          {/* Testimonial Mocado */}
          <div className="mt-8 flex items-center gap-4 px-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 border-2 border-[#050505] shadow-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PRO</span>
            </div>
            <div>
              <p className="text-gray-400 text-sm italic">"Nossa recepção nunca foi tão eficiente. O painel é incrível."</p>
              <p className="text-white text-xs font-bold mt-1">Acesso Premium</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
