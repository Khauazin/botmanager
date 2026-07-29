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
  },

  // ===== Upload de imagem =====
  // Upload TEMPORARIO: usado quando o produto/variacao ainda nao existe.
  // Retorna { imagemUrl } pra incluir no body de criacao depois.
  uploadImagemTemp: async (file) => {
    const fd = new FormData();
    fd.append('imagem', file);
    const response = await api.post('/catalogo/imagens-temp', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.imagemUrl;
  },

  // Cleanup: chamado quando o usuario cancela o modal sem criar o produto.
  // Best-effort — falhas sao silenciadas pelo backend.
  removerImagemTemp: async (imagemUrl) => {
    if (!imagemUrl) return;
    try {
      await api.delete('/catalogo/imagens-temp', { params: { url: imagemUrl } });
    } catch {
      /* best-effort */
    }
  },

  // Upload DEFINITIVO: usado em modo de edicao (produto ja existe).
  uploadImagemProduto: async (produtoId, file) => {
    const fd = new FormData();
    fd.append('imagem', file);
    const response = await api.post(`/catalogo/${produtoId}/imagem`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.imagemUrl;
  },

  removerImagemProduto: async (produtoId) => {
    await api.delete(`/catalogo/${produtoId}/imagem`);
  },

  uploadImagemVariacao: async (variacaoId, file) => {
    const fd = new FormData();
    fd.append('imagem', file);
    const response = await api.post(`/catalogo/variacoes/${variacaoId}/imagem`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.imagemUrl;
  },

  removerImagemVariacao: async (variacaoId) => {
    await api.delete(`/catalogo/variacoes/${variacaoId}/imagem`);
  },

  // ===== Layout do catalogo em PDF (config por tenant) =====
  obterConfig: async () => {
    const response = await api.get('/catalogo/config');
    return response.data;
  },

  salvarConfig: async (dados) => {
    const response = await api.put('/catalogo/config', dados);
    return response.data;
  },
};

export default catalogoService;
