import api from './api';

const financeiroService = {
  // Lançamentos
  listarLancamentos: async (params) => {
    const response = await api.get('/financeiro/lancamentos', { params });
    return response.data;
  },

  criarLancamento: async (dados) => {
    const response = await api.post('/financeiro/lancamentos', dados);
    return response.data;
  },

  atualizarStatus: async (id, status, dataPagamento) => {
    const response = await api.patch(`/financeiro/lancamentos/${id}/status`, { 
      status, 
      dataPagamento 
    });
    return response.data;
  },

  // Categorias
  listarCategorias: async () => {
    const response = await api.get('/financeiro/categorias');
    return response.data;
  },

  criarCategoria: async (dados) => {
    const response = await api.post('/financeiro/categorias', dados);
    return response.data;
  }
};

export default financeiroService;
