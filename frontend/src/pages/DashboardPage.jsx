import { useState, useEffect } from 'react';
import {
  Users,
  Bot,
  MessageSquare,
  DollarSign,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const dataChart = [
  { name: 'Seg', msgs: 400 },
  { name: 'Ter', msgs: 300 },
  { name: 'Qua', msgs: 550 },
  { name: 'Qui', msgs: 480 },
  { name: 'Sex', msgs: 700 },
  { name: 'Sáb', msgs: 390 },
  { name: 'Dom', msgs: 250 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalClients: 0,
    onlineBots: 0,
    messagesToday: 0,
    mrr: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Busca dados reais do backend para preencher os cards
    const fetchStats = async () => {
      try {
        const [clientsRes, botsRes] = await Promise.all([
          api.get('/clientes'),
          api.get('/bots')
        ]);

        const clients = clientsRes.data;
        const bots = botsRes.data;

        const mrr = clients.reduce((acc, client) => acc + (client.monthlyFee || 0), 0);
        const onlineBots = bots.filter(b => b.status === 'ONLINE').length;
        const msgs = bots.reduce((acc, bot) => acc + (bot.messagesToday || 0), 0);

        setStats({
          totalClients: clients.length,
          onlineBots,
          messagesToday: msgs,
          mrr
        });
      } catch (error) {
        console.error("Erro ao buscar estatísticas", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const cards = [
    { title: 'Total de Clientes', value: stats.totalClients, icon: Users, color: 'from-blue-500 to-blue-600', prefix: '' },
    { title: 'Bots Online', value: stats.onlineBots, icon: Bot, color: 'from-emerald-400 to-emerald-600', prefix: '' },
    { title: 'Mensagens Hoje', value: stats.messagesToday, icon: MessageSquare, color: 'from-purple-500 to-purple-600', prefix: '' },
    { title: 'MRR Previsto', value: stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), icon: DollarSign, color: 'from-amber-400 to-orange-500', prefix: 'R$ ' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${card.color} rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`} />

            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} bg-opacity-10 backdrop-blur-md border border-white/10 shadow-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <span className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
                +12% <ArrowUpRight className="w-3 h-3 ml-1" />
              </span>
            </div>

            <div className="relative z-10">
              <h3 className="text-gray-400 text-sm font-medium mb-1">{card.title}</h3>
              <div className="text-3xl font-bold text-white tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
                ) : (
                  <>{card.prefix}{card.value}</>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Tráfego de Mensagens</h3>
              <p className="text-sm text-gray-400">Volume de mensagens processadas pelos bots</p>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="msgs" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorMsgs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions or Recent Alerts */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-6">Status do Sistema</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <h4 className="text-emerald-400 font-medium text-sm">Motor de Bots Operacional</h4>
                <p className="text-gray-400 text-xs mt-1">Todos os bots ativos estão respondendo normalmente.</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-4">
              <div className="w-2 h-2 mt-2 rounded-full bg-blue-400 animate-pulse" />
              <div>
                <h4 className="text-blue-400 font-medium text-sm">API Conectada</h4>
                <p className="text-gray-400 text-xs mt-1">Latência média: 45ms. Zero perdas de pacotes na última hora.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
