import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Zap, Shield, BarChart3, MessageSquare, ArrowRight, CheckCircle2, Menu, X, Play } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Número do WhatsApp para fechamento de vendas (Substitua pelo seu número real depois)
  const whatsappNumber = "5511999999999"; 

  const handleComprar = (plano) => {
    const mensagem = encodeURIComponent(`Olá! Tenho interesse no plano ${plano} do BotManager. Como funciona?`);
    window.open(`https://wa.me/${whatsappNumber}?text=${mensagem}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* Background Orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[150px] pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-black/50 backdrop-blur-xl border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">BotManager</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#diferenciais" className="hover:text-white transition-colors">Diferenciais</a>
            <a href="#precos" className="hover:text-white transition-colors">Planos</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={() => navigate('/app/login')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Área do Cliente
            </button>
            <button 
              onClick={() => handleComprar('Profissional')}
              className="bg-white text-black px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Começar Agora
            </button>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden text-gray-400" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0a0a0a] pt-24 px-6 md:hidden">
          <div className="flex flex-col gap-6 text-lg">
            <a href="#funcionalidades" onClick={() => setIsMenuOpen(false)}>Funcionalidades</a>
            <a href="#precos" onClick={() => setIsMenuOpen(false)}>Planos</a>
            <hr className="border-white/10" />
            <button onClick={() => { navigate('/app/login'); setIsMenuOpen(false); }} className="w-full text-left text-sm font-medium text-gray-300">Área do Cliente</button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-48 lg:pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Nova Plataforma Disponível
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight mb-8 animate-in slide-in-from-bottom-6 duration-700 fade-in delay-150 leading-[1.1]">
            A Recepcionista com IA<br className="hidden md:block"/> da sua Clínica ou Barbearia
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 animate-in slide-in-from-bottom-6 duration-700 fade-in delay-300">
            Chega de perder agendamentos enquanto você está atendendo. Nossa IA responde clientes, marca horários na agenda e organiza suas vendas no piloto automático pelo WhatsApp.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in slide-in-from-bottom-8 duration-700 fade-in delay-500">
            <button 
              onClick={() => handleComprar('Profissional')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105 shadow-[0_0_30px_rgba(59,130,246,0.3)]"
            >
              Falar com um Consultor <ArrowRight className="w-5 h-5" />
            </button>
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-4 rounded-2xl font-bold transition-all">
              <Play className="w-5 h-5" fill="currentColor" /> Ver Demonstração
            </button>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="funcionalidades" className="py-24 px-6 relative z-10 border-t border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Tudo que você precisa em um só lugar</h2>
            <p className="text-gray-400">Esqueça sistemas complexos. Nós cuidamos da tecnologia para você focar em vender.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:border-blue-500/30 transition-colors group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Agendamento com IA</h3>
              <p className="text-gray-400 leading-relaxed">Nossa Inteligência Artificial conversa de forma natural, entende a intenção do cliente, verifica horários livres e faz o agendamento sozinha.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:border-purple-500/30 transition-colors group">
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Agenda Inteligente Integrada</h3>
              <p className="text-gray-400 leading-relaxed">Acesse sua agenda de qualquer dispositivo. Todos os agendamentos do WhatsApp caem diretamente no calendário do seu sistema.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors group">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Financeiro & CRM</h3>
              <p className="text-gray-400 leading-relaxed">Acompanhe seu faturamento diário, gerencie o status de cada cliente (Lead) e tenha controle total sobre suas receitas em um painel simples.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Planos transparentes. Sem surpresas.</h2>
            <p className="text-gray-400">Escolha o plano ideal para escalar o seu negócio hoje mesmo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
            
            {/* Plano Básico */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-2">Básico</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">R$ 97</span>
                  <span className="text-gray-500">/mês</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Perfeito para quem está começando nas automações.</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-gray-300 text-sm"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> 1 Robô de Atendimento</li>
                <li className="flex items-center gap-3 text-gray-300 text-sm"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Até 500 agendamentos/mês</li>
                <li className="flex items-center gap-3 text-gray-300 text-sm"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Agenda Digital Básica</li>
                <li className="flex items-center gap-3 text-gray-500 text-sm opacity-50"><X className="w-5 h-5 shrink-0" /> Sem integração IA Nativa</li>
              </ul>
              <button 
                onClick={() => handleComprar('Básico')}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Escolher Básico
              </button>
            </div>

            {/* Plano Pro (Destaque) */}
            <div className="bg-gradient-to-b from-blue-900/50 to-black border border-blue-500/50 rounded-3xl p-8 transform md:-translate-y-4 shadow-2xl shadow-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
              <div className="absolute top-4 right-4">
                <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">MAIS VENDIDO</span>
              </div>
              <div className="mb-8 mt-2">
                <h3 className="text-xl font-semibold text-white mb-2">Profissional</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">R$ 197</span>
                  <span className="text-gray-400">/mês</span>
                </div>
                <p className="text-sm text-blue-200/70 mt-2">A potência completa para empresas em crescimento.</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-gray-100 text-sm font-medium"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> IA (ChatGPT) Ativa no Bot</li>
                <li className="flex items-center gap-3 text-gray-100 text-sm font-medium"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Agendamentos Ilimitados</li>
                <li className="flex items-center gap-3 text-gray-100 text-sm font-medium"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Dashboard Financeiro e CRM</li>
                <li className="flex items-center gap-3 text-gray-100 text-sm font-medium"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Lembretes automáticos por Whats</li>
              </ul>
              <button 
                onClick={() => handleComprar('Profissional')}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.4)]"
              >
                Assinar Profissional
              </button>
            </div>

            {/* Plano Premium */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-2">Premium</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">R$ 497</span>
                  <span className="text-gray-500">/mês</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Infraestrutura dedicada para alto volume.</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-gray-300 text-sm"><CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" /> Robôs Ilimitados</li>
                <li className="flex items-center gap-3 text-gray-300 text-sm"><CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" /> Mensagens Ilimitadas</li>
                <li className="flex items-center gap-3 text-gray-300 text-sm"><CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" /> Múltiplos Canais (Insta/Web)</li>
                <li className="flex items-center gap-3 text-gray-300 text-sm"><CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" /> Consultoria de Setup Incluída</li>
              </ul>
              <button 
                onClick={() => handleComprar('Premium')}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Escolher Premium
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/40 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Bot className="text-gray-500 w-6 h-6" />
            <span className="text-lg font-bold tracking-tight text-gray-400">BotManager</span>
          </div>
          <p className="text-sm text-gray-600">© 2024 BotManager Inc. Todos os direitos reservados.</p>
          <div className="flex gap-4 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Termos</a>
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
