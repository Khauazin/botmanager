import api from './api';

const catalogoService = {
  listar: async () => {
    const response = await api.get('/catalogo');
    return response.data;
  },

  buscarPorId: async (id) => {
    const response = await api.get(`/catalogo/${id}`);
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/catalogo', dados);
    return response.data;
  },

  atualizar: async (id, dados) => {
    const response = await api.put(`/catalogo/${id}`, dados);
    return response.data;
  },

  excluir: async (id) => {
    const response = await api.delete(`/catalogo/${id}`);
    return response.data;
  }
};

export default catalogoService;
