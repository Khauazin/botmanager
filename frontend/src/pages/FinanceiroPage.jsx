import { useState } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Download, Plus, Search, Filter } from 'lucide-react';
import clsx from 'clsx';

export default function FinanceiroPage() {
  const [period, setPeriod] = useState('30d');

  const transactions = [
    { id: 1, date: '20/04/2026', description: 'João Silva - Corte + Barba', type: 'IN', amount: 80.00, status: 'PAID', method: 'PIX' },
    { id: 2, date: '19/04/2026', description: 'Ana Beatriz - Limpeza Dental', type: 'IN', amount: 250.00, status: 'PAID', method: 'CREDIT_CARD' },
    { id: 3, date: '19/04/2026', description: 'Assinatura BotManager', type: 'OUT', amount: 197.00, status: 'PAID', method: 'CREDIT_CARD' },
    { id: 4, date: '18/04/2026', description: 'Marcos Paulo - Consulta', type: 'IN', amount: 150.00, status: 'PENDING', method: 'BOLETO' },
    { id: 5, date: '18/04/2026', description: 'Juliana Costa - Clareamento', type: 'IN', amount: 800.00, status: 'PAID', method: 'PIX' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-500" /> Gestão Financeira
          </h2>
          <p className="text-gray-400 text-sm mt-1">Controle de receitas geradas através dos atendimentos</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium border border-white/10 transition-colors">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-emerald-500/20 hover:scale-105">
            <Plus className="w-4 h-4" /> Nova Receita
          </button>
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <p className="text-gray-400 text-sm font-medium mb-2">Saldo Disponível</p>
          <h3 className="text-3xl font-bold text-white">R$ 12.450,00</h3>
        </div>
        
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <p className="text-gray-400 text-sm font-medium mb-2">Entradas (Mês)</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-white">R$ 15.800,00</h3>
            <span className="flex items-center text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-1 rounded-lg mb-1">
              <ArrowUpRight className="w-4 h-4 mr-1" /> +15%
            </span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <p className="text-gray-400 text-sm font-medium mb-2">Saídas (Mês)</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-white">R$ 3.350,00</h3>
            <span className="flex items-center text-red-400 text-sm font-bold bg-red-400/10 px-2 py-1 rounded-lg mb-1">
              <ArrowDownRight className="w-4 h-4 mr-1" /> -2%
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="bg-white/5 border border-white/10 rounded-3xl flex flex-col overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/20">
          <h3 className="text-lg font-bold text-white">Últimas Transações</h3>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar transação..." 
                className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <button className="p-2 text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-gray-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Data</th>
                <th className="p-4 font-semibold">Descrição</th>
                <th className="p-4 font-semibold">Método</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 text-gray-400 whitespace-nowrap">{tx.date}</td>
                  <td className="p-4 text-white font-medium">{tx.description}</td>
                  <td className="p-4">
                    <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                      {tx.method}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={clsx(
                      "text-xs font-bold px-2 py-1 rounded-md border",
                      tx.status === 'PAID' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    )}>
                      {tx.status === 'PAID' ? 'PAGO' : 'PENDENTE'}
                    </span>
                  </td>
                  <td className={clsx(
                    "p-4 text-right font-bold whitespace-nowrap",
                    tx.type === 'IN' ? "text-emerald-400" : "text-red-400"
                  )}>
                    {tx.type === 'IN' ? '+' : '-'} R$ {tx.amount.toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination mock */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between text-sm text-gray-500 bg-black/20">
          <span>Mostrando 5 de 142 transações</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5">Anterior</button>
            <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 text-white">Próxima</button>
          </div>
        </div>

      </div>
    </div>
  );
}
