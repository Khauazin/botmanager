import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, CheckCircle2, User, Phone, Edit2, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const today = new Date();

  // Mock de agendamentos
  const appointments = [
    { id: 1, time: '09:00', client: 'Carlos Santos', service: 'Avaliação', status: 'CONFIRMED', duration: '30 min', phone: '11999887766' },
    { id: 2, time: '10:30', client: 'Ana Beatriz', service: 'Limpeza Dental', status: 'PENDING', duration: '60 min', phone: '11988776655' },
    { id: 3, time: '14:00', client: 'Marcos Paulo', service: 'Retorno', status: 'CONFIRMED', duration: '15 min', phone: '11977665544' },
    { id: 4, time: '15:30', client: 'Juliana Costa', service: 'Clareamento', status: 'CANCELED', duration: '45 min', phone: '11966554433' },
  ];

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-500" /> Agenda Inteligente
          </h2>
          <p className="text-gray-400 text-sm mt-1">Gerencie seus horários e os agendamentos feitos pela IA</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-blue-500/20 hover:scale-105">
          <Plus className="w-4 h-4" /> Novo Agendamento
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        
        {/* Sidebar Esquerda (Calendário Mini) */}
        <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-bold text-lg">
              {selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </h3>
            <div className="flex gap-2">
              <button className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-gray-500">
            {days.map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* Mock dias do mês */}
            {Array.from({ length: 30 }).map((_, i) => {
              const date = i + 1;
              const isToday = date === today.getDate();
              const isSelected = date === selectedDate.getDate();
              return (
                <button
                  key={i}
                  className={clsx(
                    "aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all",
                    isSelected ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : 
                    isToday ? "border border-blue-500/50 text-blue-400" :
                    "text-gray-300 hover:bg-white/10"
                  )}
                >
                  {date}
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Estatísticas do Dia</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Total Agendados</span>
                <span className="text-white font-bold">8</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Feitos pela IA</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">6 <CheckCircle2 className="w-3 h-3" /></span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Horários */}
        <div className="lg:col-span-3 bg-black/20 border border-white/5 rounded-3xl p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              Horários de Hoje <span className="text-sm font-normal text-gray-500 bg-white/10 px-2 py-0.5 rounded-full">4 eventos</span>
            </h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-2 text-xs font-medium text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Confirmado
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div> Pendente
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {appointments.map((apt) => (
              <div key={apt.id} className="group relative flex flex-col sm:flex-row gap-4 sm:gap-6 bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-white/20 transition-all">
                
                {/* Linha Lateral de Status */}
                <div className={clsx(
                  "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
                  apt.status === 'CONFIRMED' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
                  apt.status === 'PENDING' ? "bg-amber-500" : "bg-red-500"
                )} />

                {/* Hora */}
                <div className="flex flex-col justify-center sm:w-24 shrink-0">
                  <span className="text-2xl font-bold text-white tracking-tighter">{apt.time}</span>
                  <span className="text-xs text-gray-500 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> {apt.duration}</span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-white mb-1">{apt.client}</h4>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-blue-400 font-medium bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                      {apt.service}
                    </span>
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> {apt.phone}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
