import { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Download, Plus, Search, Filter, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';
import financeiroService from '../services/financeiroService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalNovoLancamento from '../components/Financeiro/ModalNovoLancamento';

export default function FinanceiroPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState([]);
  const [stats, setStats] = useState({ saldo: 0, entradas: 0, saidas: 0 });
  const [filtro, setFiltro] = useState({ tipo: '', status: '' });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let ignore = false;

    const carregar = async () => {
      try {
        setLoading(true);
        const data = await financeiroService.listarLancamentos(filtro);

        if (!ignore) {
          setLancamentos(data);

          const entradas = data
            .filter(l => l.tipo === 'RECEITA' && l.status === 'PAGO')
            .reduce((acc, curr) => acc + curr.valor, 0);

          const saidas = data
            .filter(l => l.tipo === 'DESPESA' && l.status === 'PAGO')
            .reduce((acc, curr) => acc + curr.valor, 0);

          setStats({
            saldo: entradas - saidas,
            entradas,
            saidas
          });
        }
      } catch {
        if (!ignore) console.error('Erro ao carregar financeiro');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    carregar();

    return () => {
      ignore = true;
    };
  }, [filtro, refresh]);

  const formatCurrency = (val) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-500" /> Gestão Financeira
          </h2>
          <p className="text-gray-400 text-sm mt-1">Controle real de receitas e despesas do sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefresh(r => r + 1)}
            className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/10 transition-all"
          >
            <RefreshCcw className={clsx("w-5 h-5", loading && "animate-spin")} />
          </button>
          <button className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium border border-white/10 transition-colors">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-emerald-500/20 hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <p className="text-gray-400 text-sm font-medium mb-2">Saldo em Caixa (Efetivado)</p>
          <h3 className="text-3xl font-bold text-white group-hover:scale-105 transition-transform origin-left">
            {formatCurrency(stats.saldo)}
          </h3>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <p className="text-gray-400 text-sm font-medium mb-2">Total Recebido (Mês)</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-emerald-400 group-hover:scale-105 transition-transform origin-left">
              {formatCurrency(stats.entradas)}
            </h3>
            <span className="flex items-center text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-1 rounded-lg mb-1">
              <ArrowUpRight className="w-4 h-4 mr-1" /> Fluxo Positivo
            </span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <p className="text-gray-400 text-sm font-medium mb-2">Total Pago (Mês)</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-red-400 group-hover:scale-105 transition-transform origin-left">
              {formatCurrency(stats.saidas)}
            </h3>
            <span className="flex items-center text-red-400 text-sm font-bold bg-red-400/10 px-2 py-1 rounded-lg mb-1">
              <ArrowDownRight className="w-4 h-4 mr-1" /> Saídas Ativas
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Lançamentos */}
      <div className="bg-white/5 border border-white/10 rounded-3xl flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/20">
          <h3 className="text-lg font-bold text-white">Lançamentos Financeiros</h3>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              className="bg-black/40 border border-white/10 text-white rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-emerald-500"
              value={filtro.tipo}
              onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}
            >
              <option value="">Todos os Tipos</option>
              <option value="RECEITA">Apenas Receitas</option>
              <option value="DESPESA">Apenas Despesas</option>
            </select>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por descrição..."
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : lancamentos.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 italic">Nenhum lançamento encontrado para os filtros selecionados.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Vencimento</th>
                  <th className="p-4 font-semibold">Descrição</th>
                  <th className="p-4 font-semibold">Categoria</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {lancamentos.map(tx => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-gray-400 whitespace-nowrap">
                      {format(new Date(tx.dataVencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{tx.descricao}</span>
                        {tx.lead && <span className="text-xs text-blue-400">Lead: {tx.lead.name}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                        {tx.categoria?.nome || 'Geral'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={clsx(
                        "text-xs font-bold px-2 py-1 rounded-md border",
                        tx.status === 'PAGO' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          tx.status === 'ATRASADO' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {tx.status}
                      </span>
                    </td>
                    <td className={clsx(
                      "p-4 text-right font-bold whitespace-nowrap",
                      tx.tipo === 'RECEITA' ? "text-emerald-400" : "text-red-400"
                    )}>
                      {tx.tipo === 'RECEITA' ? '+' : '-'} {formatCurrency(tx.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ModalNovoLancamento
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setRefresh(r => r + 1)}
      />
    </div>
  );
}
