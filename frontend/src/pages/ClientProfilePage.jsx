import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, Calendar, DollarSign, Bot, Activity, Wifi, WifiOff, AlertCircle, Trash2, PauseCircle, PlayCircle, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    carregarPerfilCliente();
  }, [id]);

  const carregarPerfilCliente = async () => {
    try {
      const response = await api.get(`/clientes/${id}`);
      setClient(response.data);
    } catch (error) {
      console.error('Erro ao buscar cliente', error);
      alert('Cliente não encontrado');
      navigate('/clientes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true);
    const newStatus = client.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await api.patch(`/clientes/${id}/status`, { status: newStatus });
      setClient({ ...client, status: res.data.status });
    } catch (error) {
      alert('Erro ao alterar status');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!client) return null;

  const isAtivo = client.status === 'ACTIVE';

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-7xl mx-auto">
      
      {/* Botão Voltar */}
      <button 
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Clientes
      </button>

      {/* Cabeçalho do Perfil */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden">
        {/* Glow de Status */}
        <div className={`absolute top-[-50%] right-[-5%] w-[40%] h-[200%] rounded-full blur-[100px] pointer-events-none opacity-20 ${
          isAtivo ? 'bg-emerald-500' : 'bg-red-500'
        }`} />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-gray-700 flex items-center justify-center shadow-2xl">
              <Building2 className="w-10 h-10 text-gray-300" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white tracking-tight">{client.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isAtivo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {isAtivo ? 'Ativo' : 'Suspenso'}
                </span>
              </div>
              <p className="text-gray-400">{client.segment || 'Sem segmento definido'}</p>
            </div>
          </div>

          {currentUser?.role === 'ADMIN' && (
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all shadow-lg ${
                  isAtivo 
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 shadow-red-500/10' 
                    : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20'
                }`}
              >
                {isTogglingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                 isAtivo ? <><PauseCircle className="w-4 h-4" /> Suspender Cliente</> : <><PlayCircle className="w-4 h-4" /> Reativar Cliente</>}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10 relative z-10 border-t border-white/5 pt-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Mail className="w-5 h-5 text-blue-400" /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">E-mail</p>
              <p className="text-sm text-gray-200 truncate">{client.email || 'Não informado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg"><Phone className="w-5 h-5 text-indigo-400" /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Telefone</p>
              <p className="text-sm text-gray-200">{client.phone || 'Não informado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-400" /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Mensalidade</p>
              <p className="text-sm font-bold text-white">R$ {client.monthlyFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg"><Calendar className="w-5 h-5 text-purple-400" /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Criado em</p>
              <p className="text-sm text-gray-200">{new Date(client.createdAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel Central: Automações/Bots */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" /> 
              Robôs Ativos ({client.bots?.length || 0})
            </h2>
            {currentUser?.role === 'ADMIN' && (
              <span className="text-sm text-gray-500 font-medium">
                Admin view
              </span>
            )}
          </div>

          {client.bots?.length === 0 ? (
            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-10 text-center">
              <Bot className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Nenhum bot associado a este cliente.</p>
              <p className="text-gray-500 text-sm mt-1">Crie um bot na aba Bots (IA) e vincule a ele.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {client.bots.map(bot => (
                <div key={bot.id} className="bg-black/40 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      {bot.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      bot.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      bot.status === 'ERROR' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                      'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>
                      {bot.status === 'ONLINE' ? 'ONLINE' : bot.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs text-gray-500">Canal: {bot.channel}</p>
                    {currentUser?.role === 'ADMIN' && (
                      <button 
                        onClick={() => navigate(`/admin/builder/${bot.id}`)}
                        className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                        title="Abrir Construtor de Fluxo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Msgs Hoje</p>
                      <p className="text-white text-sm font-medium">{bot.messagesToday}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Total Tráfego</p>
                      <p className="text-white text-sm font-medium">{bot.messagesTotal}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel Lateral: Insights (Mockados para Fase Atual) */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" /> 
            Plano & Faturamento
          </h2>
          
          <div className="bg-gradient-to-br from-[#1a1a24] to-[#12121a] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-400 text-sm">Plano Contratado</span>
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold border border-indigo-500/30">
                {client.plan}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Limite de Disparos</span>
                  <span className="text-white font-medium">
                    {client.bots?.reduce((acc, b) => acc + b.messagesToday, 0) || 0} / {client.plan === 'PREMIUM' ? 'Ilimitado' : '10.000'}
                  </span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-sm text-gray-400 mb-2">Última Fatura</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Paga via Pix</p>
                    <p className="text-xs text-gray-500">Há 12 dias</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
