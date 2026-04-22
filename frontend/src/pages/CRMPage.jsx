import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuthStore } from '../store/auth.store';
import { 
  Plus, Search, DollarSign, Filter, ArrowUpDown, 
  MoreVertical, Clock, CheckCircle2, AlertCircle, 
  User as UserIcon, Phone, Tag, Calendar, Building2
} from 'lucide-react';
import api from '../services/api';
import LeadDetailPanel from '../components/LeadDetailPanel';
import LeadFormModal from '../components/LeadFormModal';

const PRIORITY_CONFIG = {
  LOW: { label: 'Baixa', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  MEDIUM: { label: 'Média', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  HIGH: { label: 'Alta', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
};

function getInitialColor(name) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  const i = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[i];
}

// Componente para evitar que o DND quebre com overflow: auto
const DraggablePortal = ({ children, draggableProps, dragHandleProps, innerRef, isDragging }) => {
  const content = (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
    >
      {children}
    </div>
  );

  if (isDragging) {
    return createPortal(content, document.body);
  }

  return content;
};

const LeadSkeleton = () => (
  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
    <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: '70%', height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '40%', height: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
      </div>
    </div>
    <div style={{ width: '100%', height: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
  </div>
);

export default function CRMPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]); // Para seletor de admin
  const [selectedClientId, setSelectedClientId] = useState(user?.clientId || '');
  
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [sortBy, setSortBy] = useState('updatedAt');
  
  const [selectedLead, setSelectedLead] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [defaultStageId, setDefaultStageId] = useState(null);

  // Carregar lista de clientes se for Admin
  useEffect(() => {
    if (isAdmin) {
      api.get('/clientes').then(res => {
        setClients(res.data);
        if (res.data.length > 0 && !selectedClientId) {
          setSelectedClientId(res.data[0].id);
        }
      });
    }
  }, [isAdmin]);

  // Carregar dados quando o clientId mudar
  useEffect(() => {
    if (selectedClientId) {
      loadData();
    } else if (!isAdmin) {
      loadData(); // Se for cliente normal, carrega direto (clientId vem do token no back)
    }
  }, [selectedClientId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const params = isAdmin ? { clientId: selectedClientId } : {};
      
      const [sRes, lRes] = await Promise.all([
        api.get('/crm/stages', { params }),
        api.get('/crm/leads', { params })
      ]);
      setStages(sRes.data);
      setLeads(lRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const processedLeads = useMemo(() => {
    let filtered = leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.name?.toLowerCase().includes(q) || l.phone?.includes(q)
      );
    }
    if (filterPriority !== 'ALL') {
      filtered = filtered.filter(l => l.priority === filterPriority);
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === 'value') return (b.value || 0) - (a.value || 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [leads, search, filterPriority, sortBy]);

  const onDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const lead = leads.find(l => l.id === draggableId);
    const prevLeads = [...leads];
    const newStageId = destination.droppableId;

    setLeads(leads.map(l => l.id === draggableId ? { ...l, stageId: newStageId, updatedAt: new Date().toISOString() } : l));

    try {
      await api.put(`/crm/leads/${draggableId}`, { ...lead, stageId: newStageId, clientId: selectedClientId });
    } catch (error) {
      setLeads(prevLeads);
    }
  };

  const openEditLead = (lead) => {
    setEditingLead(lead);
    setModalOpen(true);
    setSelectedLead(null);
  };

  const handleSave = async (data) => {
    try {
      const payload = { ...data, clientId: selectedClientId };
      if (editingLead?.id) {
        const res = await api.put(`/crm/leads/${editingLead.id}`, payload);
        setLeads(prev => prev.map(l => l.id === editingLead.id ? res.data : l));
      } else {
        const res = await api.post('/crm/leads', payload);
        setLeads(prev => [res.data, ...prev]);
      }
      setModalOpen(false);
    } catch (e) {
      alert('Erro ao salvar lead');
    }
  };

  const handleDelete = async (lead) => {
    if (!window.confirm(`Excluir o lead "${lead.name}"?`)) return;
    try {
      await api.delete(`/crm/leads/${lead.id}`);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      setSelectedLead(null);
    } catch (e) {
      alert('Erro ao excluir lead');
    }
  };

  const criarStagesPadrao = async () => {
    const padrao = [
      { name: 'Novo Lead', order: 1, color: '#3b82f6' },
      { name: 'Em Contato', order: 2, color: '#a855f7' },
      { name: 'Agendado', order: 3, color: '#f59e0b' },
      { name: 'Fechado', order: 4, color: '#10b981' },
      { name: 'Perdido', order: 5, color: '#ef4444' },
    ];
    try {
      await Promise.all(padrao.map(s => api.post('/crm/stages', { ...s, clientId: selectedClientId })));
      loadData();
    } catch (e) { alert('Erro ao criar funil.'); }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>CRM Pipeline</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)' }}>
                <Building2 size={14} color="#818cf8" />
                <select 
                  value={selectedClientId} 
                  onChange={e => setSelectedClientId(e.target.value)}
                  style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                >
                  {clients.map((c, idx) => <option key={c.id || idx} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 13 }}>
              <UserIcon size={14} /> <strong>{leads.length}</strong> leads
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 13 }}>
              <DollarSign size={14} /> <strong>R$ {leads.reduce((a,b) => a+(b.value||0),0).toLocaleString('pt-BR')}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar lead..."
              style={{ paddingLeft: 42, paddingRight: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#fff', fontSize: 14, outline: 'none', width: 220, height: 40 }}
            />
          </div>

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
             <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 12, padding: '0 8px', outline: 'none', cursor: 'pointer' }}>
               <option value="ALL">Prioridade</option>
               <option value="HIGH">Alta</option>
               <option value="MEDIUM">Média</option>
               <option value="LOW">Baixa</option>
             </select>
             <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 12, padding: '0 8px', outline: 'none', cursor: 'pointer' }}>
               <option value="updatedAt">Recentes</option>
               <option value="value">Valor</option>
               <option value="name">Nome</option>
             </select>
          </div>

          <button onClick={() => { setEditingLead(null); setDefaultStageId(stages[0]?.id); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#6366f1', border: 'none', borderRadius: 12, padding: '0 16px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', height: 40 }}>
            <Plus size={18} /> Novo
          </button>
        </div>
      </div>

      {stages.length === 0 && !isLoading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 32, textAlign: 'center', padding: 60 }}>
          <h3 style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>Funil Vazio</h3>
          <button onClick={criarStagesPadrao} style={{ marginTop: 24, background: '#6366f1', border: 'none', borderRadius: 16, padding: '16px 32px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Criar Funil Padrão</button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 20, minWidth: 0, width: '100%' }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <div style={{ display: 'flex', gap: 20, height: '100%', alignItems: 'flex-start', minWidth: 'max-content' }}>
              {stages.map(stage => {
                const stageLeads = processedLeads.filter(l => l.stageId === stage.id);
                const totalValue = stageLeads.reduce((acc, l) => acc + (l.value || 0), 0);

                return (
                  <Droppable key={stage.id} droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        style={{
                          width: 300, display: 'flex', flexDirection: 'column',
                          background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.05)`,
                          borderRadius: 20, maxHeight: '100%'
                        }}
                      >
                        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color || '#6366f1' }} />
                              <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{stage.name}</span>
                            </div>
                            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{stageLeads.length}</span>
                          </div>
                          {totalValue > 0 && <div style={{ marginTop: 8, color: '#10b981', fontSize: 12, fontWeight: 700 }}>R$ {totalValue.toLocaleString('pt-BR')}</div>}
                        </div>

                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12,
                            minHeight: 200, background: snapshot.isDraggingOver ? 'rgba(99,102,241,0.02)' : 'transparent'
                          }}
                        >
                          {isLoading ? [1, 2, 3].map(i => <LeadSkeleton key={i} />) : stageLeads.map((lead, index) => {
                              const priority = PRIORITY_CONFIG[lead.priority];
                              return (
                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                  {(provided, snapshot) => (
                                    <DraggablePortal 
                                      innerRef={provided.innerRef} 
                                      draggableProps={provided.draggableProps} 
                                      dragHandleProps={provided.dragHandleProps} 
                                      isDragging={snapshot.isDragging}
                                    >
                                      <div
                                        onClick={() => setSelectedLead(lead)}
                                        style={{
                                          background: snapshot.isDragging ? '#1e1e30' : 'rgba(255,255,255,0.03)',
                                          border: `1px solid ${snapshot.isDragging ? '#6366f1' : 'rgba(255,255,255,0.05)'}`,
                                          borderRadius: 16, padding: 14, cursor: 'grab', width: snapshot.isDragging ? 276 : 'auto',
                                          boxShadow: snapshot.isDragging ? '0 20px 40px rgba(0,0,0,0.4)' : 'none'
                                        }}
                                      >
                                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                          <div style={{
                                            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                                            background: `linear-gradient(135deg, ${getInitialColor(lead.name)}, ${getInitialColor(lead.name)}99)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff'
                                          }}>{lead.name?.charAt(0).toUpperCase()}</div>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</h4>
                                            <div style={{ marginTop: 2, color: '#6b7280', fontSize: 11 }}>{lead.phone || 'S/ Tel'}</div>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <div style={{ padding: '4px 8px', borderRadius: 8, background: priority.bg, color: priority.color, fontSize: 10, fontWeight: 700 }}>{priority.label}</div>
                                          {lead.value > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>R$ {Number(lead.value).toLocaleString('pt-BR')}</div>}
                                        </div>
                                      </div>
                                    </DraggablePortal>
                                  )}
                                </Draggable>
                              );
                            })
                          }
                          {provided.placeholder}
                        </div>

                        <button onClick={() => { setEditingLead(null); setDefaultStageId(stage.id); setModalOpen(true); }} style={{ margin: 12, padding: 12, background: 'transparent', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 14, color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Adicionar Lead</button>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Side Panel */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 998, opacity: selectedLead ? 1 : 0, pointerEvents: selectedLead ? 'all' : 'none', transition: 'opacity 0.3s ease' }} onClick={() => setSelectedLead(null)} />
      <div style={{ position: 'fixed', top: 0, right: selectedLead ? 0 : -500, bottom: 0, width: 480, background: '#0b0b14', zIndex: 999, boxShadow: '-10px 0 40px rgba(0,0,0,0.5)', transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex' }}>
        {selectedLead && <LeadDetailPanel lead={selectedLead} stages={stages} onClose={() => setSelectedLead(null)} onUpdate={openEditLead} onDelete={handleDelete} />}
      </div>

      {modalOpen && (
        <LeadFormModal
          lead={editingLead ? { ...editingLead } : { stageId: defaultStageId }}
          stages={stages}
          clientId={selectedClientId}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      <style>{`
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
}
