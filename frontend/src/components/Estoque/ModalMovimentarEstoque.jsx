import { useState, useEffect } from 'react';
import { X, Save, ArrowLeftRight } from 'lucide-react';
import estoqueService from '../../services/estoqueService';
import catalogoService from '../../services/catalogoService';

export default function ModalMovimentarEstoque({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [formData, setFormData] = useState({
    variacaoId: '',
    tipo: 'AJUSTE',
    quantidade: '',
    motivo: ''
  });

  useEffect(() => {
    let ignore = false;

    const carregar = async () => {
      try {
        const data = await catalogoService.listar();
        if (!ignore) {
          setProdutos(data);
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
      await estoqueService.movimentar({
        ...formData,
        quantidade: parseInt(formData.quantidade)
      });
      onSuccess();
      onClose();
    } catch {
      alert('Erro ao realizar movimentação.');
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Movimentar Estoque</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Item / Variação</label>
            <select
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-colors"
              value={formData.variacaoId}
              onChange={e => setFormData({ ...formData, variacaoId: e.target.value })}
            >
              <option value="">Selecione o item...</option>
              {produtos.map(p => (
                <optgroup key={p.id} label={p.nome}>
                  {p.variacoes?.map(v => (
                    <option key={v.id} value={v.id}>{v.nome} (Saldo: {v.estoqueAtual})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Tipo</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-colors"
                value={formData.tipo}
                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
              >
                <option value="AJUSTE">Ajuste</option>
                <option value="COMPRA_FORNECEDOR">Compra</option>
                <option value="DEVOLUCAO">Devolução</option>
                <option value="VENDA">Saída de Venda</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Quantidade</label>
              <input
                required
                type="number"
                placeholder="Ex: 10 ou -5"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-colors"
                value={formData.quantidade}
                onChange={e => setFormData({ ...formData, quantidade: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Motivo / Observação</label>
            <textarea
              placeholder="Descreva o motivo da movimentação..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-colors h-24 resize-none"
              value={formData.motivo}
              onChange={e => setFormData({ ...formData, motivo: e.target.value })}
            />
          </div>

          <div className="pt-4">
            <button
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" /> Confirmar Movimentação
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
