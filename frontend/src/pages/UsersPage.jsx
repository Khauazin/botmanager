import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Shield, User, Mail, Loader2, Edit2 } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/auth.store';

export default function UsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentUser = useAuthStore(state => state.user);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'ADMIN'
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      setUsuarios(response.data);
    } catch (error) {
      console.error('Erro ao carregar usuários', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        
        const response = await api.put(`/usuarios/${editingId}`, payload);
        setUsuarios(usuarios.map(u => u.id === editingId ? response.data : u));
      } else {
        const response = await api.post('/usuarios', formData);
        setUsuarios([response.data, ...usuarios]);
      }
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'ADMIN' });
      setEditingId(null);
    } catch (error) {
      console.error('Erro ao salvar usuário', error);
      alert(error.response?.data?.erro || 'Erro ao salvar usuário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (currentUser && id === currentUser.id) {
      alert('Você não pode excluir o próprio usuário!');
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await api.delete(`/usuarios/${id}`);
        setUsuarios(usuarios.filter(u => u.id !== id));
      } catch (error) {
        console.error('Erro ao excluir usuário', error);
        alert('Erro ao excluir usuário.');
      }
    }
  };

  const filteredUsers = usuarios.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Gestão da Equipe</h2>
          <p className="text-gray-400 text-sm mt-1">Gerencie os administradores com acesso ao painel</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ name: '', email: '', password: '', role: 'ADMIN' });
            setEditingId(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Novo Membro
        </button>
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

      {/* Grid de Usuários */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          Carregando equipe...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-gray-500 backdrop-blur-sm">
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredUsers.map(usuario => (
            <div key={usuario.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-white/20 transition-all duration-300 group relative">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button 
                  onClick={() => {
                    setFormData({
                      name: usuario.name,
                      email: usuario.email,
                      password: '',
                      role: usuario.role
                    });
                    setEditingId(usuario.id);
                    setIsModalOpen(true);
                  }}
                  className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                  title="Editar usuário"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {(!currentUser || usuario.id !== currentUser.id) && (
                  <button 
                    onClick={() => handleDeleteUser(usuario.id)}
                    className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Excluir usuário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center mb-4 shadow-lg shadow-black/50">
                  <span className="text-xl font-bold text-white">{usuario.name.charAt(0).toUpperCase()}</span>
                </div>
                
                <h3 className="text-white font-semibold text-lg">{usuario.name}</h3>
                
                <div className="flex items-center gap-2 text-gray-400 text-sm mt-1 mb-4">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{usuario.email}</span>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Shield className="w-3.5 h-3.5" />
                  {usuario.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                </span>
                
                {currentUser && usuario.id === currentUser.id && (
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-b-2xl" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Usuário */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Membro" : "Convidar Novo Membro"}>
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Nome Completo</label>
            <input 
              required
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              placeholder="Ex: João Silva"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">E-mail de Acesso</label>
            <input 
              required type="email"
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              placeholder="joao@botmanager.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Senha Inicial</label>
            <input 
              required={!editingId} type="password" minLength={6}
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500"
              placeholder={editingId ? "Deixe em branco para não alterar" : "••••••••"}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Nível de Acesso</label>
            <select 
              value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 appearance-none"
            >
              <option value="ADMIN">Administrador Geral</option>
              <option value="VIEWER">Operador (Apenas visualização)</option>
            </select>
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
              {isSaving ? 'Salvando...' : 'Salvar Membro'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
