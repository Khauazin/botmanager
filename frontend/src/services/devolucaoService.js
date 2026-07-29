import api from './api';

const devolucaoService = {
  // status: 'pendente' (default, tudo nao devolvido) | 'atrasada' | 'concluida'
  listar: async (status) => {
    const response = await api.get('/devolucoes', { params: status ? { status } : {} });
    return response.data;
  },

  concluir: async (id) => {
    const response = await api.patch(`/devolucoes/${id}/concluir`);
    return response.data;
  },

  obterConfig: async () => {
    const response = await api.get('/devolucoes/config');
    return response.data;
  },

  salvarConfig: async (dados) => {
    const response = await api.put('/devolucoes/config', dados);
    return response.data;
  },
};

export default devolucaoService;
