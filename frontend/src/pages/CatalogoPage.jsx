import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Search, RefreshCcw, Tag, MoreVertical, Edit, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import catalogoService from '../services/catalogoService';
import ModalNovoProduto from '../components/Catalogo/ModalNovoProduto';

export default function CatalogoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState([]);

  const carregarProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await catalogoService.listar();
      setProdutos(data);
    } catch {
      console.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;

    const buscar = async () => {
      try {
        const data = await catalogoService.listar();
        if (!cancelado) setProdutos(data);
      } catch {
        console.error("Erro ao carregar produtos");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    buscar();
    return () => { cancelado = true; };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-500" /> Catálogo de Itens
          </h2>
          <p className="text-gray-400 text-sm mt-1">Produtos físicos e Serviços baseados em tempo</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={carregarProdutos}
            className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/10 transition-all"
          >
            <RefreshCcw className={clsx("w-5 h-5", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-blue-500/20 hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <div className="flex items-center justify-center p-24">
          <RefreshCcw className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : produtos.length === 0 ? (
        <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white">Nenhum item no catálogo</h3>
          <p className="text-gray-400 mt-1 max-w-xs mx-auto text-sm">
            Comece cadastrando seus primeiros produtos ou serviços para gerenciar estoque e vendas.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-6 text-blue-400 hover:text-blue-300 text-sm font-bold flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <Plus className="w-4 h-4" /> Cadastrar meu primeiro item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {produtos.map(produto => (
            <div key={produto.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className={clsx(
                  "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                  produto.tipo === 'FISICO' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                )}>
                  {produto.tipo === 'FISICO' ? 'Produto Físico' : 'Serviço'}
                </div>
                <button className="text-gray-500 hover:text-white transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              <h4 className="text-xl font-bold text-white mb-1">{produto.nome}</h4>
              <p className="text-gray-400 text-sm line-clamp-2 mb-6 h-10">{produto.descricao || 'Sem descrição.'}</p>

              <div className="space-y-3">
                {produto.variacoes?.map(v => (
                  <div key={v.id} className="flex items-center justify-between bg-black/20 rounded-xl p-3 border border-white/5 group/v transition-colors hover:border-white/10">
                    <div>
                      <p className="text-sm font-medium text-white">{v.nome}</p>
                      <p className="text-xs text-gray-500">{v.sku || 'Sem SKU'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">R$ {v.preco.toFixed(2)}</p>
                      <p className={clsx(
                        "text-[10px] font-bold",
                        v.estoqueAtual <= (produto.estoqueMinimo || 0) ? "text-red-400" : "text-gray-500"
                      )}>
                        {produto.tipo === 'FISICO' ? `Estoque: ${v.estoqueAtual}` : 'Disponível'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Tag className="w-3 h-3" />
                  {produto.visibilidade}
                </div>
                <div className="flex items-center gap-3">
                  <button className="text-gray-400 hover:text-blue-400 p-1.5 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-red-400 p-1.5 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalNovoProduto
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={carregarProdutos}
      />
    </div>
  );
}
