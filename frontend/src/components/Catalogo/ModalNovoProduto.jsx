import { useState } from 'react';
import { X, Save, Plus, Trash2, Package } from 'lucide-react';
import catalogoService from '../../services/catalogoService';

export default function ModalNovoProduto({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'FISICO',
    visibilidade: 'ATIVO',
    estoqueMinimo: 0,
    variacoes: [
      { nome: 'Padrão', preco: '', estoqueAtual: 0, sku: '' }
    ]
  });

  const addVariacao = () => {
    setFormData({
      ...formData,
      variacoes: [...formData.variacoes, { nome: '', preco: '', estoqueAtual: 0, sku: '' }]
    });
  };

  const removeVariacao = (index) => {
    if (formData.variacoes.length === 1) return;
    const newVars = [...formData.variacoes];
    newVars.splice(index, 1);
    setFormData({ ...formData, variacoes: newVars });
  };

  const handleVariacaoChange = (index, field, value) => {
    const newVars = [...formData.variacoes];
    newVars[index][field] = value;
    setFormData({ ...formData, variacoes: newVars });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const dataToSave = {
        ...formData,
        estoqueMinimo: parseInt(formData.estoqueMinimo),
        variacoes: formData.variacoes.map(v => ({
          ...v,
          preco: parseFloat(v.preco),
          estoqueAtual: parseInt(v.estoqueAtual)
        }))
      };
      await catalogoService.criar(dataToSave);
      onSuccess();
      onClose();
    } catch {
      alert('Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[#121212] border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Novo Produto/Serviço</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Nome do Item</label>
              <input
                required
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Tipo</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  value={formData.tipo}
                  onChange={e => setFormData({...formData, tipo: e.target.value})}
                >
                  <option value="FISICO">Produto Físico</option>
                  <option value="SERVICO">Serviço</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Estoque Mínimo</label>
                <input
                  type="number"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  value={formData.estoqueMinimo}
                  onChange={e => setFormData({...formData, estoqueMinimo: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Variações */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Variações & Preços</label>
              <button 
                type="button" 
                onClick={addVariacao}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar Variação
              </button>
            </div>

            {formData.variacoes.map((v, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 relative group/v">
                {formData.variacoes.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => removeVariacao(idx)}
                    className="absolute top-2 right-2 p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover/v:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Nome (Ex: Tamanho P)"
                    className="bg-black/20 border border-white/5 rounded-xl py-2 px-3 text-sm text-white focus:border-blue-500 outline-none"
                    value={v.nome}
                    onChange={e => handleVariacaoChange(idx, 'nome', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Preço (R$)"
                    className="bg-black/20 border border-white/5 rounded-xl py-2 px-3 text-sm text-white focus:border-blue-500 outline-none"
                    value={v.preco}
                    onChange={e => handleVariacaoChange(idx, 'preco', e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="SKU (Opcional)"
                    className="bg-black/20 border border-white/5 rounded-xl py-2 px-3 text-xs text-gray-400 focus:border-blue-500 outline-none"
                    value={v.sku}
                    onChange={e => handleVariacaoChange(idx, 'sku', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Estoque Inicial"
                    className="bg-black/20 border border-white/5 rounded-xl py-2 px-3 text-sm text-white focus:border-blue-500 outline-none"
                    value={v.estoqueAtual}
                    onChange={e => handleVariacaoChange(idx, 'estoqueAtual', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" /> Salvar Produto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
