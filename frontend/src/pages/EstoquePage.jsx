import { useState, useEffect } from 'react';
import { Box, RefreshCcw, ArrowDownRight, ArrowUpRight, History, Search, Plus } from 'lucide-react';
import clsx from 'clsx';
import estoqueService from '../services/estoqueService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalMovimentarEstoque from '../components/Estoque/ModalMovimentarEstoque';

export default function EstoquePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let ignore = false;

    const carregar = async () => {
      try {
        setLoading(true);
        const data = await estoqueService.listarMovimentacoes();
        if (!ignore) {
          setMovimentacoes(data);
        }
      } catch {
        if (!ignore) console.error('Erro ao carregar estoque');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    carregar();

    return () => {
      ignore = true;
    };
  }, [refresh]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Box className="w-6 h-6 text-amber-500" /> Movimentação de Estoque
          </h2>
          <p className="text-gray-400 text-sm mt-1">Histórico completo de entradas, saídas e reservas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefresh(r => r + 1)}
            className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/10 transition-all"
          >
            <RefreshCcw className={clsx("w-5 h-5", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-amber-500/20 hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Nova Movimentação
          </button>
        </div>
      </div>

      {/* Histórico de Movimentações */}
      <div className="bg-white/5 border border-white/10 rounded-3xl flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/20">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-gray-500" /> Livro-Razão de Inventário
          </h3>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por item ou motivo..."
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-24">
              <RefreshCcw className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : movimentacoes.length === 0 ? (
            <div className="p-12 text-center text-gray-500 italic">
              Nenhuma movimentação registrada no período.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Data/Hora</th>
                  <th className="p-4 font-semibold">Item / Variação</th>
                  <th className="p-4 font-semibold">Tipo</th>
                  <th className="p-4 font-semibold">Motivo</th>
                  <th className="p-4 font-semibold text-right">Qtd</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {movimentacoes.map(m => (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-gray-400 whitespace-nowrap">
                      {format(new Date(m.data), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{m.variacao?.produto?.nome}</span>
                        <span className="text-xs text-gray-500">{m.variacao?.nome}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={clsx(
                        "text-[10px] font-bold px-2 py-1 rounded-md border",
                        m.tipo === 'VENDA' || m.tipo === 'RESERVA' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          m.tipo === 'COMPRA_FORNECEDOR' || m.tipo === 'DEVOLUCAO' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 max-w-xs truncate">
                      {m.motivo || '-'}
                    </td>
                    <td className={clsx(
                      "p-4 text-right font-bold whitespace-nowrap",
                      m.quantidade > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      <div className="flex items-center justify-end gap-1">
                        {m.quantidade > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(m.quantidade)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ModalMovimentarEstoque
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setRefresh(r => r + 1)}
      />
    </div>
  );
}
