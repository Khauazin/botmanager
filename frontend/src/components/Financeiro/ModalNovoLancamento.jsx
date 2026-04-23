import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import financeiroService from '../../services/financeiroService';

export default function ModalNovoLancamento({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'RECEITA',
    status: 'PENDENTE',
    dataVencimento: new Date().toISOString().split('T')[0],
    categoriaId: ''
  });

  useEffect(() => {
    let ignore = false;

    const carregar = async () => {
      try {
        const data = await financeiroService.listarCategorias();
        if (!ignore) {
          setCategorias(data);
        }
      } catch (e) {
        if (!ignore) console.error(e);
      }
    };

    if (isOpen) {
      carregar();
    }

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await financeiroService.criarLancamento({
        ...formData,
        valor: parseFloat(formData.valor)
      });
      onSuccess();
      onClose();
    } catch {
      alert('Erro ao salvar lançamento. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#121212] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h3 className="text-xl font-bold text-white">Novo Lançamento</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipo: 'RECEITA' })}
              className={`py-3 rounded-2xl text-xs font-bold transition-all border ${formData.tipo === 'RECEITA'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                }`}
            >
              RECEITA (+)
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipo: 'DESPESA' })}
              className={`py-3 rounded-2xl text-xs font-bold transition-all border ${formData.tipo === 'DESPESA'
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                }`}
            >
              DESPESA (-)
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Descrição</label>
            <input
              required
              type="text"
              placeholder="Ex: Pagamento Fornecedor, Venda de Produto..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                placeholder="0,00"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                value={formData.valor}
                onChange={e => setFormData({ ...formData, valor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Vencimento</label>
              <input
                required
                type="date"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                value={formData.dataVencimento}
                onChange={e => setFormData({ ...formData, dataVencimento: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Categoria</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              value={formData.categoriaId}
              onChange={e => setFormData({ ...formData, categoriaId: e.target.value })}
            >
              <option value="">Selecione uma categoria...</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" /> Salvar Lançamento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
