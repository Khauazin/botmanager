import { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Download,
  Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const receitaData = [
  { mes: 'Jan', valor: 4500 },
  { mes: 'Fev', valor: 5200 },
  { mes: 'Mar', valor: 6100 },
  { mes: 'Abr', valor: 5800 },
  { mes: 'Mai', valor: 7400 },
  { mes: 'Jun', valor: 8900 },
];

const mensagensData = [
  { plataforma: 'WhatsApp', qtde: 45000 },
  { plataforma: 'Instagram', qtde: 32000 },
  { plataforma: 'Website', qtde: 12000 },
];

export default function ReportsPage() {
  const [periodo, setPeriodo] = useState('30d');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Relatórios Avançados</h2>
          <p className="text-gray-400 text-sm mt-1">Visão geral financeira e consumo dos bots</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-black/40 border border-white/10 rounded-xl p-1 flex items-center">
            <button 
              onClick={() => setPeriodo('7d')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodo === '7d' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              7 Dias
            </button>
            <button 
              onClick={() => setPeriodo('30d')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodo === '30d' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              30 Dias
            </button>
            <button 
              onClick={() => setPeriodo('1y')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodo === '1y' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              1 Ano
            </button>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-white p-2.5 rounded-xl transition-colors"
            title="Salvar como PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-gray-400 font-medium">Receita no Período</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">R$ 37.900,00</div>
          <p className="text-emerald-400 text-sm flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +15.3% vs período anterior
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-gray-400 font-medium">Total de Interações</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">89.000</div>
          <p className="text-blue-400 text-sm flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +5.2% vs período anterior
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-gray-400 font-medium">Churn Rate (Cancelamentos)</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">1.2%</div>
          <p className="text-gray-400 text-sm">2 clientes cancelaram</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Crescimento de Receita */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-6">Crescimento de Receita Mensal</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={receitaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="mes" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [`R$ ${value}`, 'Receita']}
                />
                <Area type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumo por Plataforma */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-6">Consumo por Canal</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensagensData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="plataforma" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  formatter={(value) => [`${value} msgs`, 'Consumo']}
                />
                <Bar dataKey="qtde" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
