import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Building2, Phone, Mail, DollarSign, Loader2, Edit2, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/auth.store';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  const currentUser = useAuthStore(state => state.user);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', segment: '', plan: 'BASIC', monthlyFee: ''
  });
  const [editingId, setEditingId] = useState(null);

  const [openDropdownId, setOpenDropdownId] = useState(null);

  const handleDeleteClient = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await api.delete(`/clientes/${id}`);
        setClients(clients.filter(c => c.id !== id));
      } catch (error) {
        alert(error.response?.data?.error || 'Erro ao excluir');
      }
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.patch(`/clientes/${id}/status`, { status: newStatus });
      setClients(clients.map(c => c.id === id ? { ...c, status: res.data.status } : c));
      setOpenDropdownId(null);
    } catch (error) {
      alert('Erro ao alterar status');
    }
  };

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    try {
      const response = await api.get('/clientes');
      setClients(response.data);
    } catch (error) {
      console.error('Erro ao carregar clientes', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        const response = await api.put(`/clientes/${editingId}`, formData);
        setClients(clients.map(c => c.id === editingId ? response.data : c));
      } else {
        const response = await api.post('/clientes', formData);
        setClients([response.data, ...clients]);
      }
      setIsModalOpen(false);
      setFormData({ name: '', email: '', phone: '', segment: '', plan: 'BASIC', monthlyFee: '' });
      setEditingId(null);
    } catch (error) {
      console.error('Erro ao salvar cliente', error);
      alert('Erro ao salvar cliente. Verifique os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Gestão de Clientes</h2>
          <p className="text-gray-400 text-sm mt-1">Gerencie as empresas e contratantes da plataforma</p>
        </div>
        {currentUser?.role === 'ADMIN' && (
          <button 
            onClick={() => {
              setFormData({ name: '', email: '', phone: '', segment: '', plan: 'BASIC', monthlyFee: '' });
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
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
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/5 text-white rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600 text-sm"
          />
        </div>
      </div>

      {/* Table/List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
        <div>
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/10 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Cliente</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Plano</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Mensalidade</th>
                {currentUser?.role === 'ADMIN' && <th className="px-6 py-4"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Carregando clientes...
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr 
                    key={client.id} 
                    onClick={() => navigate(`/clientes/${client.id}`)}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{client.name}</p>
                          <p className="text-gray-500 text-xs">{client.segment || 'Sem segmento'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Mail className="w-3 h-3" /> {client.email || '--'}
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Phone className="w-3 h-3" /> {client.phone || '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {client.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        client.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        client.status === 'INACTIVE' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : 
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {client.status === 'ACTIVE' ? 'Ativo' : client.status === 'INACTIVE' ? 'Inativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300 font-medium">
                      R$ {client.monthlyFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    {currentUser?.role === 'ADMIN' && (
                      <td className="px-6 py-4 text-right relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === client.id ? null : client.id); }}
                          className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {openDropdownId === client.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }}></div>
                            <div className="absolute right-8 top-10 w-48 bg-[#111111] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData({
                                    name: client.name || '',
                                    email: client.email || '',
                                    phone: client.phone || '',
                                    segment: client.segment || '',
                                    plan: client.plan || 'BASIC',
                                    monthlyFee: client.monthlyFee || ''
                                  });
                                  setEditingId(client.id);
                                  setIsModalOpen(true);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                              >
                                <Edit2 className="w-4 h-4" /> Editar Cliente
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(client.id, client.status); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
                              >
                                {client.status === 'ACTIVE' ? <><PauseCircle className="w-4 h-4" /> Suspender</> : <><PlayCircle className="w-4 h-4" /> Ativar</>}
                              </button>
                              <div className="h-px bg-white/5 my-1"></div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); handleDeleteClient(client.id); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                              >
                                <Trash2 className="w-4 h-4" /> Excluir Cliente
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Novo Cliente */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Cliente" : "Cadastrar Novo Cliente"}>
        <form onSubmit={handleSaveClient} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Nome da Empresa/Cliente *</label>
            <input 
              required
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Ex: Imobiliária Silva"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">E-mail</label>
              <input 
                type="email"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Telefone / WhatsApp</label>
              <input 
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Segmento</label>
              <input 
                value={formData.segment} onChange={e => setFormData({...formData, segment: e.target.value})}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
                placeholder="Ex: Imobiliária, Clínica..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Plano</label>
              <select 
                value={formData.plan} onChange={e => setFormData({...formData, plan: e.target.value})}
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="BASIC">Básico</option>
                <option value="PRO">Profissional</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Mensalidade (R$)</label>
            <input 
              type="number" step="0.01" min="0"
              value={formData.monthlyFee} onChange={e => setFormData({...formData, monthlyFee: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              placeholder="Ex: 199.90"
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
              {isSaving ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
