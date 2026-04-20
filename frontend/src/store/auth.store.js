import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('@botmanager:token') || null,
  isAuthenticated: !!localStorage.getItem('@botmanager:token'),
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/autenticacao/login', { email, password });
      const { usuario, token } = response.data;
      
      localStorage.setItem('@botmanager:token', token);
      set({ user: usuario, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({ 
        error: error.response?.data?.erro || 'Erro ao fazer login. Verifique suas credenciais.', 
        isLoading: false 
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('@botmanager:token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('@botmanager:token');
    if (!token) {
      set({ isAuthenticated: false, isCheckingAuth: false });
      return;
    }
    
    try {
      const response = await api.get('/autenticacao/perfil');
      set({ user: response.data, isAuthenticated: true, isCheckingAuth: false });
    } catch (error) {
      localStorage.removeItem('@botmanager:token');
      set({ user: null, token: null, isAuthenticated: false, isCheckingAuth: false });
    }
  }
}));
