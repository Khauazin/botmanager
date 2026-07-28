import api from './api';

// Credencial de IA da PLATAFORMA (a chave da DeepSeek — uma só, da Sellergy,
// não por cliente). Espelha backend/src/routes/admin-credencial-ia.routes.js.
// O segredo vai só no corpo do PUT; a API nunca devolve a chave em claro.
const adminCredencialIAService = {
  obter: async () => {
    const { data } = await api.get('/admin/plataforma/credencial-ia');
    return data; // null se ainda nao foi configurada
  },
  salvar: async ({ apiKey }) => {
    const { data } = await api.put('/admin/plataforma/credencial-ia', { apiKey });
    return data;
  },
};

export default adminCredencialIAService;
