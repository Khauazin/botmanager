import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const inputStyle = {
  width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box'
};

const labelStyle = { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, display: 'block' };

export default function LeadFormModal({ lead, stages, clientId, onClose, onSave }) {
  const isEditing = !!lead?.id;
  const [form, setForm] = useState({
    name: '', phone: '', email: '', value: '', tags: '', priority: 'MEDIUM',
    origin: '', notes: '', stageId: stages[0]?.id || ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      value: lead.value || '',
      tags: lead.tags || '',
      priority: lead.priority || 'MEDIUM',
      origin: lead.origin || '',
      notes: lead.notes || '',
      stageId: lead.stageId || stages[0]?.id || ''
    });
  }, [lead]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        clientId,
        value: form.value ? parseFloat(form.value) : 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }}>
      <div style={{ background: 'linear-gradient(135deg,#13131f,#0e0e1a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
            {isEditing ? 'Editar Lead' : 'Novo Lead'}
          </h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nome *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome do lead" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Telefone</label>
              <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label style={labelStyle}>Valor (R$)</label>
              <input style={inputStyle} type="number" value={form.value} onChange={e => set('value', e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>E-mail</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label style={labelStyle}>Etapa do Funil</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.stageId} onChange={e => set('stageId', e.target.value)}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Prioridade</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Origem</label>
              <input style={inputStyle} value={form.origin} onChange={e => set('origin', e.target.value)} placeholder="Ex: WhatsApp" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tags / Serviços</label>
            <input style={inputStyle} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="Botox, Preenchimento..." />
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea style={{ ...inputStyle, resize: 'none' }} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anotações sobre o lead..." />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#9ca3af', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
