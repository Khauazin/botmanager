// Service da FAQ simples do bot (pares pergunta/resposta). Espelha
// backend/src/routes/faq.routes.js.

import api from './api';

export async function listar() {
  const r = await api.get('/faq');
  return r.data;
}

export async function criar({ pergunta, resposta, ordem, ativo, palavrasChave }) {
  const r = await api.post('/faq', { pergunta, resposta, ordem, ativo, palavrasChave });
  return r.data;
}

export async function atualizar(id, dados) {
  const r = await api.put(`/faq/${id}`, dados);
  return r.data;
}

export async function excluir(id) {
  await api.delete(`/faq/${id}`);
}

export default { listar, criar, atualizar, excluir };
