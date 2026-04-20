import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, XCircle, Search } from 'lucide-react';
import api from '../services/api';

export default function AlertsPage() {
  const [alertas, setAlertas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    carregarAlertas();

    // Conecta no Socket.io para real-time
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3333');

    socket.on('novo_alerta', (novoAlerta) => {
      setAlertas((prev) => [novoAlerta, ...prev]);
    });

    socket.on('alerta_atualizado', (alertaAtualizado) => {
      setAlertas((prev) => prev.map(a => a.id === alertaAtualizado.id ? { ...a, ...alertaAtualizado } : a));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const carregarAlertas = async () => {
    try {
      const response = await api.get('/alertas');
      setAlertas(response.data);
    } catch (error) {
      console.error('Erro ao carregar alertas', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resolverAlerta = async (id) => {
    try {
      await api.patch(`/alertas/${id}/resolver`);
      // O socket vai atualizar a UI automaticamente
    } catch (error) {
      console.error('Erro ao resolver alerta', error);
    }
  };

  const ignorarAlerta = async (id) => {
    try {
      await api.patch(`/alertas/${id}/ignorar`);
    } catch (error) {
      console.error('Erro ao ignorar alerta', error);
    }
  };

  const filteredAlertas = alertas.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.bot?.name && a.bot.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.client?.name && a.client.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSeverityStyles = (severity) => {
    switch(severity) {
      case 'CRITICAL': return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'ERROR': return { icon: XCircle, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
      case 'WARNING': return { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'INFO': return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      default: return { icon: Info, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Central de Alertas 
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Monitoramento em tempo real dos erros dos bots</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-2 rounded-2xl backdrop-blur-sm">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar por erro, bot ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/5 text-white rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600 text-sm"
          />
        </div>
      </div>

      {/* Alertas List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
            Buscando alertas...
          </div>
        ) : filteredAlertas.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-gray-500 backdrop-blur-sm flex flex-col items-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mb-3" />
            <p className="text-white font-medium">Tudo tranquilo por aqui!</p>
            <p className="text-sm mt-1">Nenhum alerta encontrado no momento.</p>
          </div>
        ) : (
          filteredAlertas.map((alerta) => {
            const style = getSeverityStyles(alerta.severity);
            const Icon = style.icon;
            
            return (
              <div 
                key={alerta.id} 
                className={`p-5 rounded-2xl border backdrop-blur-sm transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  alerta.status === 'OPEN' 
                    ? `bg-white/5 border-white/10 hover:border-white/20` 
                    : `bg-black/20 border-white/5 opacity-60 grayscale-[50%]`
                }`}
              >
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${style.bg} ${style.border}`}>
                    <Icon className={`w-6 h-6 ${style.color}`} />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold ${alerta.status === 'OPEN' ? 'text-white' : 'text-gray-400 line-through'}`}>
                        {alerta.title}
                      </h3>
                      {alerta.status !== 'OPEN' && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 border border-gray-600/50 px-2 py-0.5 rounded-full">
                          {alerta.status === 'RESOLVED' ? 'Resolvido' : 'Ignorado'}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{alerta.message}</p>
                    
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="bg-white/5 text-gray-300 px-2.5 py-1 rounded-md border border-white/10">
                        Bot: {alerta.bot?.name || 'Desconhecido'}
                      </span>
                      <span className="bg-white/5 text-gray-300 px-2.5 py-1 rounded-md border border-white/10">
                        Cliente: {alerta.client?.name || 'Desconhecido'}
                      </span>
                      <span className="text-gray-500 px-1 py-1">
                        {new Date(alerta.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>

                {alerta.status === 'OPEN' && (
                  <div className="flex items-center gap-2 md:pl-4 md:border-l border-white/10 md:self-stretch pt-4 md:pt-0 border-t md:border-t-0 mt-4 md:mt-0">
                    <button 
                      onClick={() => resolverAlerta(alerta.id)}
                      className="flex-1 md:flex-none px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium transition-colors"
                    >
                      Resolver
                    </button>
                    <button 
                      onClick={() => ignorarAlerta(alerta.id)}
                      className="flex-1 md:flex-none px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border border-gray-500/20 rounded-xl text-sm font-medium transition-colors"
                    >
                      Ignorar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
