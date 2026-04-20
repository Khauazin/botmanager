import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Bot, Activity, Wifi, WifiOff, AlertCircle, Loader2, Edit2, Trash2, Zap, Copy } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/auth.store';

export default function BotsPage() {
  const navigate = useNavigate();
  const [bots, setBots] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentUser = useAuthStore(state => state.user);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '', name: '', channel: 'WHATSAPP', phoneNumber: '',
    aiProvider: '', aiModel: '', aiSystemPrompt: '', aiTemperature: 0.7
  });
  const [editingId, setEditingId] = useState(null);

  const [openDropdownId, setOpenDropdownId] = useState(null);

  const handleDeleteBot = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este bot?')) {
      try {
        await api.delete(`/bots/${id}`);
        setBots(bots.filter(b => b.id !== id));
      } catch (error) {
        alert(error.response?.data?.error || 'Erro ao excluir bot');
      }
    }
  };

  const handleDuplicateBot = async (id) => {
    if (window.confirm('Deseja clonar este bot (copiará todos os fluxos, nós e IA)?')) {
      try {
        const response = await api.post(`/bots/${id}/duplicate`);
        setBots([response.data, ...bots]);
      } catch (error) {
        alert(error.response?.data?.error || 'Erro ao duplicar bot');
      }
    }
  };

  useEffect(() => {
    carregarBots();
    carregarClientesParaSelect();
  }, []);

  const carregarBots = async () => {
    try {
      const response = await api.get('/bots');
      setBots(response.data);
    } catch (error) {
      console.error('Erro ao carregar bots', error);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarClientesParaSelect = async () => {
    try {
      const response = await api.get('/clientes');
      setClientes(response.data);
    } catch (error) {
      console.error('Erro ao carregar clientes para o select', error);
    }
  };

  const handleSaveBot = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        const response = await api.put(`/bots/${editingId}`, formData);
        const updatedBot = {
          ...response.data,
          client: clientes.find(c => c.id === formData.clientId)
        };
        setBots(bots.map(b => b.id === editingId ? updatedBot : b));
      } else {
        const response = await api.post('/bots', formData);
        const novoBot = {
          ...response.data,
          client: clientes.find(c => c.id === formData.clientId)
        };
        setBots([novoBot, ...bots]);
      }
      setIsModalOpen(false);
      setFormData({ 
        clientId: '', name: '', channel: 'WHATSAPP', phoneNumber: '',
        aiProvider: '', aiModel: '', aiSystemPrompt: '', aiTemperature: 0.7 
      });
      setEditingId(null);
    } catch (error) {
      console.error('Erro ao salvar bot', error);
      alert('Erro ao salvar bot. Verifique se escolheu um cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBots = bots.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (b.client?.name && b.client.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusIcon = (status) => {
    switch(status) {
      case 'ONLINE': return <Wifi className="w-3 h-3 text-emerald-400" />;
      case 'OFFLINE': return <WifiOff className="w-3 h-3 text-gray-400" />;
      case 'ERROR': return <AlertCircle className="w-3 h-3 text-red-400" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'ONLINE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'OFFLINE': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'ERROR': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Gestão de Bots</h2>
          <p className="text-gray-400 text-sm mt-1">Gerencie os chatbots configurados para cada cliente</p>
        </div>
        {currentUser?.role === 'ADMIN' && (
          <button 
            onClick={() => {
              setFormData({ 
                clientId: '', name: '', channel: 'WHATSAPP', phoneNumber: '',
                aiProvider: '', aiModel: '', aiSystemPrompt: '', aiTemperature: 0.7 
              });
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Bot
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-2 rounded-2xl backdrop-blur-sm">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar bot ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/5 text-white rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600 text-sm"
          />
        </div>
      </div>

      {/* Grid de Bots */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          Buscando bots...
        </div>
      ) : filteredBots.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-gray-500 backdrop-blur-sm">
          Nenhum bot encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBots.map(bot => (
            <div key={bot.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-white/20 transition-all duration-300 group relative">
              <div className={`absolute top-0 left-0 w-full h-1 rounded-t-2xl ${
                bot.status === 'ONLINE' ? 'bg-emerald-500' : 
                bot.status === 'ERROR' ? 'bg-red-500' : 'bg-gray-500'
              }`} />
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{bot.name}</h3>
                    <p className="text-gray-400 text-xs">{bot.client?.name || 'Cliente desconhecido'}</p>
                  </div>
                </div>
                {currentUser?.role === 'ADMIN' && (
                  <div className="relative">
                    <button 
                      onClick={() => setOpenDropdownId(openDropdownId === bot.id ? null : bot.id)}
                      className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {openDropdownId === bot.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)}></div>
                        <div className="absolute right-0 top-8 w-44 bg-[#111111] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-100">
                          <button 
                            onClick={() => {
                              setFormData({
                                clientId: bot.clientId || '',
                                name: bot.name || '',
                                channel: bot.channel || 'WHATSAPP',
                                phoneNumber: bot.phoneNumber || '',
                                aiProvider: bot.aiProvider || '',
                                aiModel: bot.aiModel || '',
                                aiSystemPrompt: bot.aiSystemPrompt || '',
                                aiTemperature: bot.aiTemperature || 0.7
                              });
                              setEditingId(bot.id);
                              setIsModalOpen(true);
                              setOpenDropdownId(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                          >
                            <Edit2 className="w-4 h-4" /> Editar Bot
                          </button>
                          <button 
                            onClick={() => { navigate(`/admin/builder/${bot.id}`); setOpenDropdownId(null); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                          >
                            <Zap className="w-4 h-4 text-amber-400" /> Editar Fluxo e IA
                          </button>
                          <button 
                            onClick={() => { handleDuplicateBot(bot.id); setOpenDropdownId(null); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors text-left"
                          >
                            <Copy className="w-4 h-4" /> Duplicar Bot
                          </button>
                          <div className="h-px bg-white/5 my-1"></div>
                          <button 
                            onClick={() => { setOpenDropdownId(null); handleDeleteBot(bot.id); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                          >
                            <Trash2 className="w-4 h-4" /> Excluir Bot
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs font-medium">Status</span>
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(bot.status)}`}>
                    {getStatusIcon(bot.status)}
                    {bot.status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs font-medium">Canal</span>
                  <span className="text-gray-300 text-xs bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                    {bot.channel}
                  </span>
                </div>

                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Msgs Hoje</p>
                    <p className="text-white font-semibold">{bot.messagesToday}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Msgs Total</p>
                    <p className="text-white font-semibold">{bot.messagesTotal}</p>
                  </div>
                </div>

                {/* Botão de acesso rápido ao Builder */}
                {currentUser?.role === 'ADMIN' && (
                  <button 
                    onClick={() => navigate(`/admin/builder/${bot.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/20 rounded-xl text-blue-400 hover:text-white hover:border-blue-500/40 hover:from-blue-600/30 hover:to-indigo-600/30 transition-all text-sm font-medium group/btn"
                  >
                    <Zap className="w-4 h-4 group-hover/btn:animate-pulse" />
                    Abrir Construtor de Fluxo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Novo Bot */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Bot" : "Cadastrar Novo Bot"}>
        <form onSubmit={handleSaveBot} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Cliente Dono do Bot *</label>
            <select 
              required
              value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 appearance-none"
            >
              <option value="" disabled>Selecione um cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Nome de Exibição *</label>
              <input 
                required
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
                placeholder="Ex: Bot WhatsApp Vendas"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Canal *</label>
              <select 
                value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="WEBSITE">Website</option>
                <option value="TELEGRAM">Telegram</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Número do WhatsApp (Opcional)</label>
            <input 
              value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              placeholder="Ex: 5511999998888"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-2 px-4 rounded-xl text-gray-300 hover:bg-white/5 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors font-medium flex justify-center items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Salvando...' : 'Salvar Bot'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
