import { useState } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, MessageSquare, DollarSign, ArrowUpRight } from 'lucide-react';

export default function ClientDashboardPage() {
  const [period, setPeriod] = useState('7d');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Visão Geral</h2>
          <p className="text-gray-400 text-sm mt-1">Acompanhe os resultados da sua IA de atendimento</p>
        </div>
        <select 
          value={period} onChange={(e) => setPeriod(e.target.value)}
          className="bg-white/5 border border-white/10 text-white rounded-xl py-2 px-4 focus:outline-none focus:border-blue-500 text-sm"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="all">Este ano</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-900/40 to-black border border-blue-500/20 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Calendar className="w-16 h-16 text-blue-500" />
          </div>
          <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/30">
            <Calendar className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-gray-400 text-sm font-medium mb-1">Agendamentos via IA</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-bold text-white">128</h3>
            <span className="flex items-center text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-1 rounded-lg mb-1">
              <ArrowUpRight className="w-4 h-4 mr-1" /> +12%
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/40 to-black border border-emerald-500/20 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-16 h-16 text-emerald-500" />
          </div>
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-gray-400 text-sm font-medium mb-1">Faturamento Gerado</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-bold text-white">R$ 14.5k</h3>
            <span className="flex items-center text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-1 rounded-lg mb-1">
              <ArrowUpRight className="w-4 h-4 mr-1" /> +8%
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/20 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-purple-500" />
          </div>
          <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4 border border-purple-500/30">
            <Users className="w-6 h-6 text-purple-400" />
          </div>
          <p className="text-gray-400 text-sm font-medium mb-1">Novos Leads</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-bold text-white">342</h3>
            <span className="flex items-center text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-1 rounded-lg mb-1">
              <ArrowUpRight className="w-4 h-4 mr-1" /> +24%
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-900/40 to-black border border-amber-500/20 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <MessageSquare className="w-16 h-16 text-amber-500" />
          </div>
          <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/30">
            <MessageSquare className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-gray-400 text-sm font-medium mb-1">Conversas Ativas</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-bold text-white">18</h3>
            <span className="text-gray-500 text-sm mb-1">Neste momento</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Placeholder para gráfico */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Evolução de Agendamentos</h3>
            <button className="text-blue-400 text-sm hover:underline">Ver relatório completo</button>
          </div>
          <div className="h-64 flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-black/20">
            <p className="text-gray-500 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Gráfico de Barras em desenvolvimento</p>
          </div>
        </div>

        {/* Próximos agendamentos */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Próximos Horários</h3>
            <button className="text-blue-400 text-sm hover:underline">Ver agenda</button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-3 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex flex-col items-center justify-center border border-blue-500/30">
                  <span className="text-xs font-bold text-blue-400">HOJE</span>
                  <span className="text-sm font-black text-white">14:30</span>
                </div>
                <div>
                  <h4 className="text-white font-medium text-sm">João Silva</h4>
                  <p className="text-gray-400 text-xs mt-0.5">Corte + Barba</p>
                  <p className="text-emerald-400 text-xs font-medium mt-1">R$ 80,00</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
