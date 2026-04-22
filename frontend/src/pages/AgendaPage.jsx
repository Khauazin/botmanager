import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight,
  User, Phone, Edit2, Trash2, CalendarDays, X, Sparkles,
  CheckCircle, XCircle, MoreVertical, CheckCheck, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

// ─── Configs ──────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDING: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', dot: '#f59e0b' },
  CONFIRMED: { label: 'Confirmado', color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: '#10b981' },
  CANCELED: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', dot: '#ef4444' },
  COMPLETED: { label: 'Concluído', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', dot: '#3b82f6' },
};

const STATUS_ACTIONS = [
  { status: 'CONFIRMED', label: 'Confirmar', icon: CheckCircle, color: '#10b981' },
  { status: 'COMPLETED', label: 'Concluir', icon: CheckCheck, color: '#3b82f6' },
  { status: 'CANCELED', label: 'Cancelar', icon: XCircle, color: '#ef4444' },
  { status: 'PENDING', label: 'Reabrir', icon: AlertCircle, color: '#f59e0b' },
];

const ORIGIN_CONFIG = {
  AI: { label: 'IA', icon: Sparkles, color: '#a855f7' },
  MANUAL: { label: 'Manual', icon: User, color: '#6366f1' },
};

// ─── Toast ────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: t.type === 'success' ? 'rgba(16,185,129,0.15)' : t.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
          border: `1px solid ${t.type === 'success' ? 'rgba(16,185,129,0.3)' : t.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
          borderRadius: 14, padding: '12px 18px', backdropFilter: 'blur(12px)',
          color: '#fff', fontSize: 14, fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.3s ease',
          minWidth: 260
        }}>
          <span style={{ fontSize: 18 }}>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  return { toasts, show };
}

// ─── Dropdown de Ações ────────────────────────────────────
function ActionDropdown({ app, onStatusChange, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const actions = STATUS_ACTIONS.filter(a => a.status !== app.status);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 100,
          background: '#111120', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: 6, minWidth: 180,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          {actions.map(a => (
            <button
              key={a.status}
              onClick={() => { onStatusChange(app.id, a.status); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 12px', borderRadius: 10, border: 'none',
                background: 'transparent', color: a.color, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${a.color}15`}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <a.icon size={14} /> {a.label}
            </button>
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

          <button
            onClick={() => { onEdit(app); setOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Edit2 size={14} /> Editar
          </button>

          <button
            onClick={() => { onDelete(app.id); setOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────
export default function AgendaPage() {
  const { user } = useAuthStore();
  const clientId = user?.clientId;
  const { toasts, show } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isMonthFilter, setIsMonthFilter] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [formData, setFormData] = useState({
    customerName: '', customerPhone: '', service: '', date: '',
    time: '09:00', duration: 30, price: '', notes: '', leadId: '', origin: 'MANUAL'
  });

  useEffect(() => { carregarAgendamentos(); }, [viewDate]);
  useEffect(() => { if (clientId) carregarLeads(); }, [clientId]);

  const carregarAgendamentos = async () => {
    try {
      setIsLoading(true);
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth() + 1;
      const res = await api.get(`/agenda?month=${month}&year=${year}`);
      setAppointments(res.data);
    } catch { show('Erro ao carregar agenda', 'error'); }
    finally { setIsLoading(false); }
  };

  const carregarLeads = async () => {
    try {
      const res = await api.get(`/crm/leads/${clientId}`);
      setLeads(res.data);
    } catch { console.error('Erro ao carregar leads'); }
  };

  // ── Estatísticas ──
  const stats = useMemo(() => {
    const mes = appointments;
    return {
      total: mes.length,
      pending: mes.filter(a => a.status === 'PENDING').length,
      confirmed: mes.filter(a => a.status === 'CONFIRMED').length,
      completed: mes.filter(a => a.status === 'COMPLETED').length,
      canceled: mes.filter(a => a.status === 'CANCELED').length,
    };
  }, [appointments]);

  // ── Calendário ──
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push({ day: null });

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayApps = appointments.filter(app => {
        const d = new Date(app.date);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === i;
      });
      days.push({ day: i, date, apps: dayApps });
    }
    return days;
  }, [viewDate, appointments]);

  const monthName = viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const filteredAppointments = useMemo(() => {
    if (isMonthFilter) return appointments;
    return appointments.filter(app => {
      const d = new Date(app.date);
      return d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate();
    });
  }, [appointments, selectedDate, isMonthFilter]);

  // ── Ações ──
  const handleOpenModal = (app = null) => {
    if (app) {
      const d = new Date(app.date);
      setEditingAppointment(app);
      setFormData({
        customerName: app.customerName, customerPhone: app.customerPhone || '',
        service: app.service || '', date: d.toISOString().split('T')[0],
        time: d.toTimeString().substring(0, 5), duration: app.duration,
        price: app.price || '', notes: app.notes || '',
        leadId: app.leadId || '', origin: app.origin
      });
    } else {
      setEditingAppointment(null);
      setFormData({
        customerName: '', customerPhone: '', service: '',
        date: selectedDate.toISOString().split('T')[0],
        time: '09:00', duration: 30, price: '', notes: '', leadId: '', origin: 'MANUAL'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const fullDate = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      const payload = { ...formData, date: fullDate };
      if (editingAppointment) {
        await api.put(`/agenda/${editingAppointment.id}`, payload);
        show('Agendamento atualizado!');
      } else {
        await api.post('/agenda', payload);
        show('Agendamento criado!');
      }
      setIsModalOpen(false);
      carregarAgendamentos();
    } catch { show('Erro ao salvar agendamento', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir este agendamento?')) return;
    try {
      await api.delete(`/agenda/${id}`);
      setAppointments(prev => prev.filter(a => a.id !== id));
      show('Agendamento excluído');
    } catch { show('Erro ao excluir', 'error'); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await api.patch(`/agenda/${id}/status`, { status });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: res.data.status } : a));
      show(`Status: ${STATUS_CONFIG[status].label}`);
    } catch { show('Erro ao mudar status', 'error'); }
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
        {[
          { label: 'Total no Mês', value: stats.total, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
          { label: 'Confirmados', value: stats.confirmed, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Pendentes', value: stats.pending, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Concluídos', value: stats.completed, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        ].map((s, i) => (
          <div key={i} style={{
            background: s.bg, border: `1px solid ${s.color}25`,
            borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: s.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: '#fff' }}>{s.value}</p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Corpo */}
      <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>

        {/* Sidebar Calendário */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 18 }}>

            {/* Nav Mês */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'capitalize', margin: 0 }}>{monthName}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {[ChevronLeft, ChevronRight].map((Icon, i) => (
                  <button key={i} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + (i ? 1 : -1), 1))}
                    style={{ padding: 5, borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'none', cursor: 'pointer' }}>
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>

            {/* Cabeçalho dias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#4b5563' }}>{d}</div>
              ))}
            </div>

            {/* Grade de dias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {calendarDays.map((item, idx) => {
                if (!item.day) return <div key={idx} />;
                const isSelected = !isMonthFilter && selectedDate.toDateString() === item.date.toDateString();
                const isToday = new Date().toDateString() === item.date.toDateString();

                // Pega as cores únicas dos status dos agendamentos do dia
                const dotColors = [...new Set(item.apps.map(a => STATUS_CONFIG[a.status]?.dot))].slice(0, 3);

                return (
                  <button key={idx} onClick={() => { setSelectedDate(item.date); setIsMonthFilter(false); }}
                    style={{
                      aspectRatio: '1/1', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, position: 'relative',
                      background: isSelected ? '#6366f1' : isToday ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: isSelected ? '#fff' : isToday ? '#818cf8' : '#9ca3af',
                    }}
                  >
                    {item.day}
                    {dotColors.length > 0 && !isSelected && (
                      <div style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 3 }}>
                        {dotColors.map((c, i) => (
                          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: c }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botões */}
          <button onClick={() => setIsMonthFilter(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px',
            borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
            background: isMonthFilter ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
            color: isMonthFilter ? '#818cf8' : '#9ca3af', fontSize: 13, fontWeight: 600
          }}>
            <CalendarDays size={16} />
            {isMonthFilter ? 'Ver o mês todo' : 'Ver apenas o dia'}
          </button>

          <button onClick={() => handleOpenModal()} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(99,102,241,0.35)'
          }}>
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
              {isMonthFilter ? `Agenda de ${monthName}` : selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              {filteredAppointments.length} agendamento{filteredAppointments.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 18, padding: 20, height: 80, animation: 'pulse 1.5s infinite' }} />
              ))
            ) : filteredAppointments.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px dashed rgba(255,255,255,0.08)', padding: 60 }}>
                <CalendarIcon size={40} color="rgba(255,255,255,0.06)" />
                <p style={{ marginTop: 12, color: '#4b5563', fontSize: 14 }}>Nenhum agendamento neste período</p>
                <button onClick={() => handleOpenModal()} style={{ marginTop: 16, padding: '10px 20px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Criar agendamento
                </button>
              </div>
            ) : (
              filteredAppointments.map(app => {
                const status = STATUS_CONFIG[app.status];
                const origin = ORIGIN_CONFIG[app.origin] || ORIGIN_CONFIG.MANUAL;
                const hora = new Date(app.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={app.id} style={{
                    background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.06)`,
                    borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'border-color 0.2s', position: 'relative',
                    borderLeft: `3px solid ${status.color}`
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${status.color}60`}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderLeftColor = status.color; }}
                  >
                    {/* Hora */}
                    <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{hora}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{app.duration}m</div>
                    </div>

                    <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.06)' }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.customerName}</h4>

                        {/* Status Badge Clicável */}
                        <button
                          onClick={() => {
                            const next = { PENDING: 'CONFIRMED', CONFIRMED: 'COMPLETED', COMPLETED: 'PENDING', CANCELED: 'PENDING' };
                            handleStatusChange(app.id, next[app.status]);
                          }}
                          style={{
                            padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                            background: status.bg, color: status.color, border: `1px solid ${status.color}30`,
                            cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                          }}
                          title="Clique para mudar status"
                        >
                          {status.label}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: origin.color, flexShrink: 0 }}>
                          <origin.icon size={11} />
                          <span style={{ fontSize: 10, fontWeight: 600 }}>{origin.label}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#9ca3af' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CalendarIcon size={12} /> {app.service}
                        </span>
                        {app.customerPhone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={12} /> {app.customerPhone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <ActionDropdown
                      app={app}
                      onStatusChange={handleStatusChange}
                      onEdit={handleOpenModal}
                      onDelete={handleDelete}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 460, background: '#0f0f1e', borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSave} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Data', type: 'date', key: 'date', required: true },
                  { label: 'Hora', type: 'time', key: 'time', required: true },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>{f.label}</label>
                    <input type={f.type} required={f.required} value={formData[f.key]}
                      onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              {[
                { label: 'Cliente *', key: 'customerName', placeholder: 'Nome completo', required: true },
                { label: 'Telefone', key: 'customerPhone', placeholder: '(00) 00000-0000' },
                { label: 'Serviço / Procedimento *', key: 'service', placeholder: 'Ex: Consulta, Botox', required: true },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input placeholder={f.placeholder} required={f.required} value={formData[f.key]}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Duração (min)', key: 'duration', type: 'number' },
                  { label: 'Valor (R$)', key: 'price', type: 'number', placeholder: '0.00' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={formData[f.key]}
                      onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Vincular ao Lead</label>
                <select value={formData.leadId} onChange={e => setFormData({ ...formData, leadId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Nenhum lead</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name} {l.phone ? `(${l.phone})` : ''}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit"
                  style={{ flex: 2, padding: 12, background: '#6366f1', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                  {editingAppointment ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 10px; }
      `}</style>
    </div>
  );
}
