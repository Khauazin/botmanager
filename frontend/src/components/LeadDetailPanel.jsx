import { useState, useEffect } from 'react';
import { X, ArrowRight, Plus, User, Mail, Phone, DollarSign, Tag, Globe, Flag, Edit2, Trash2 } from 'lucide-react';
import api from '../services/api';

const PRIORITY_LABEL = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
const PRIORITY_COLOR = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

const ACTION_ICON = {
  CRIADO: { bg: '#3b82f620', color: '#3b82f6', symbol: '✦' },
  MOVIDO: { bg: '#a855f720', color: '#a855f6', symbol: '→' },
  EDITADO: { bg: '#f59e0b20', color: '#f59e0b', symbol: '✎' },
  OBSERVACAO: { bg: '#10b98120', color: '#10b981', symbol: '💬' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

export default function LeadDetailPanel({ lead, stages, onClose, onUpdate, onDelete }) {
  const [history, setHistory] = useState([]);
  const [obs, setObs] = useState('');
  const [addingObs, setAddingObs] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    api.get(`/crm/leads/${lead.id}/history`).then(r => setHistory(r.data)).catch(() => {});
  }, [lead]);

  const handleAddObs = async () => {
    if (!obs.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/crm/leads/${lead.id}/history`, { notes: obs });
      setHistory(prev => [res.data, ...prev]);
      setObs('');
      setAddingObs(false);
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return null;

  const stageName = stages.find(s => s.id === lead.stageId)?.name || '—';
  const priorityColor = PRIORITY_COLOR[lead.priority] || '#f59e0b';

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, height: '100vh', width: '450px',
      background: 'rgba(13, 13, 23, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', flexDirection: 'column', zIndex: 9999,
      boxShadow: '-10px 0 50px rgba(0,0,0,0.6)',
      animation: 'slideIn 0.3s ease-out'
    }}>
      {/* Header */}
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: `linear-gradient(135deg, #6366f1, #8b5cf6)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0
            }}>
              {lead.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{lead.name}</h2>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640', fontWeight: 600 }}>
                  {stageName}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${priorityColor}20`, color: priorityColor, border: `1px solid ${priorityColor}40`, fontWeight: 600 }}>
                  {PRIORITY_LABEL[lead.priority]}
                </span>
              </div>
            </div>
          </div>
          {lead.tags && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {lead.tags.split(',').map(t => (
                <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                  {t.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onDelete(lead)} title="Excluir" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={14} />
          </button>
          <button onClick={() => onUpdate(lead)} title="Editar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
            <Edit2 size={14} />
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Histórico */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Histórico</h3>
            <button onClick={() => setAddingObs(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={12} /> Observação
            </button>
          </div>

          {addingObs && (
            <div style={{ marginBottom: 14 }}>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Escreva uma observação..."
                rows={3}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, padding: '10px 12px', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handleAddObs} disabled={saving} style={{ flex: 1, padding: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => setAddingObs(false)} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.length === 0 && (
              <p style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', margin: '20px 0' }}>Nenhuma atividade ainda.</p>
            )}
            {history.map(h => {
              const style = ACTION_ICON[h.action] || ACTION_ICON.EDITADO;
              return (
                <div key={h.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: style.bg, color: style.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginTop: 2 }}>
                    {style.symbol}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#d1d5db', lineHeight: 1.4 }}>{h.notes}</p>
                    <span style={{ fontSize: 11, color: '#4b5563' }}>{timeAgo(h.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info do Negócio */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Informações do Negócio</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: <DollarSign size={14}/>, label: 'Valor', value: lead.value ? `R$ ${Number(lead.value).toLocaleString('pt-BR')}` : 'R$ 0,00' },
              { icon: <Tag size={14}/>, label: 'Etapa do Funil', value: stageName },
              { icon: <Globe size={14}/>, label: 'Origem', value: lead.origin || '—' },
              { icon: <Flag size={14}/>, label: 'Prioridade', value: PRIORITY_LABEL[lead.priority] },
              { label: '📅', label2: 'Data de Criação', value: new Date(lead.createdAt).toLocaleDateString('pt-BR') },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 12 }}>
                  {item.icon}
                  <span>{item.label || item.label2}</span>
                </div>
                <span style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info do Contato */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Informações do Contato</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: <User size={14}/>, value: lead.name },
              { icon: <Mail size={14}/>, value: lead.email || '—' },
              { icon: <Phone size={14}/>, value: lead.phone || '—' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#6b7280' }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: '#d1d5db' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
