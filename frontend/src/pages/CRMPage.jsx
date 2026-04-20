import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuthStore } from '../store/auth.store';
import { Plus, Search, MessageCircle, Calendar, Trash2, DollarSign } from 'lucide-react';
import api from '../services/api';

export default function CRMPage() {
  const { user } = useAuthStore();
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingLead, setIsAddingLead] = useState(false);

  useEffect(() => {
    // Para simplificar, estamos pegando o ID do cliente logado. 
    // Em um sistema real, o usuário 'VIEWER' deve ter seu clientId no JWT ou store.
    // Aqui assumimos que user.clientId existe para os VIEWERS.
    if (user?.clientId) {
      loadData(user.clientId);
    } else {
      // Mock para admins que abrem a tela para testar
      setIsLoading(false);
    }
  }, [user]);

  const loadData = async (clientId) => {
    try {
      const [stagesRes, leadsRes] = await Promise.all([
        api.get(`/crm/stages/${clientId}`),
        api.get(`/crm/leads/${clientId}`)
      ]);
      setStages(stagesRes.data);
      setLeads(leadsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados do CRM:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Otimista: atualizar a UI imediatamente
    const lead = leads.find(l => l.id === draggableId);
    if (!lead) return;

    const prevStageId = lead.stageId;
    const newStageId = destination.droppableId;

    setLeads(prev => prev.map(l => 
      l.id === draggableId ? { ...l, stageId: newStageId } : l
    ));

    try {
      await api.put(`/crm/leads/${draggableId}`, {
        ...lead,
        stageId: newStageId
      });
    } catch (error) {
      console.error('Erro ao mover lead:', error);
      // Rollback se der erro
      setLeads(prev => prev.map(l => 
        l.id === draggableId ? { ...l, stageId: prevStageId } : l
      ));
    }
  };

  if (isLoading) {
    return <div className="p-8 text-gray-400">Carregando CRM...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CRM & Pipeline</h1>
          <p className="text-gray-400 mt-1">Gerencie seus leads e oportunidades</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar lead..." 
              className="pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 w-64 text-sm transition-all"
            />
          </div>
          <button 
            onClick={() => setIsAddingLead(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Lead
          </button>
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white/5 border border-white/10 border-dashed rounded-3xl p-12 text-center">
          <h3 className="text-xl font-bold text-white mb-2">Seu funil está vazio</h3>
          <p className="text-gray-400 max-w-md">Para começar a usar o CRM, você precisa configurar as fases do seu funil de vendas.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 h-full items-start min-w-max">
              {stages.map((stage) => {
                const stageLeads = leads.filter(l => l.stageId === stage.id);
                
                return (
                  <Droppable key={stage.id} droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`w-80 flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-colors ${snapshot.isDraggingOver ? 'bg-white/10 border-blue-500/50' : ''}`}
                      >
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                          <h3 className="font-semibold text-white flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color || '#3b82f6' }} />
                            {stage.name}
                          </h3>
                          <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs font-bold text-gray-300">
                            {stageLeads.length}
                          </span>
                        </div>
                        
                        <div className="p-3 flex-1 overflow-y-auto min-h-[150px] space-y-3">
                          {stageLeads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-gradient-to-br from-[#1a1a24] to-[#12121a] border rounded-xl p-4 shadow-lg cursor-grab active:cursor-grabbing transition-all ${
                                    snapshot.isDragging ? 'border-blue-500 shadow-blue-500/20 scale-105 rotate-2' : 'border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  <h4 className="font-semibold text-white mb-1">{lead.name}</h4>
                                  {lead.phone && <p className="text-xs text-gray-400 mb-3">{lead.phone}</p>}
                                  
                                  <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-3">
                                    <div className="flex items-center gap-2">
                                      <button className="text-gray-500 hover:text-blue-400 transition-colors p-1" title="Ver chat">
                                        <MessageCircle className="w-4 h-4" />
                                      </button>
                                      <button className="text-gray-500 hover:text-purple-400 transition-colors p-1" title="Agendar">
                                        <Calendar className="w-4 h-4" />
                                      </button>
                                    </div>
                                    {lead.value > 0 && (
                                      <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20">
                                        <DollarSign className="w-3 h-3" />
                                        {lead.value.toLocaleString('pt-BR')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}
