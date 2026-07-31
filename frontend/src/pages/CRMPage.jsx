import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, Phone, Mail, Tag, ArrowRight, ArrowLeft,
  Clock, History, LayoutGrid, List, MoreHorizontal, Settings, Lock,
  IdCard, Cake
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Textarea, Select, Badge, Avatar,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider,
  useToast, Tabs, TabsList, TabsTrigger, Switch, Combobox
} from '../components/ui';
import Modal from '../components/Modal';
import { formatarTelefoneBR } from '../utils/formatTelefone';
import { formatarCpf, limparCpf } from '../utils/formatCpf';
import { useAuthStore } from '../store/auth.store';

// Quem pode mexer na estrutura do funil. VENDEDOR nao entra — decisao
// estrutural do CRM e do dono/administrador da conta.
function podeConfigurarEtapas(perfil) {
  return perfil === 'CLIENT' || perfil === 'ADMINISTRADOR' || perfil === 'ADMIN';
}

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PRIORIDADES = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
];

// Preco efetivo da variacao (regra: usar preco-catalogo se ativado).
// Espelha resolverPrecoVenda no backend pra UI calcular total localmente.
function precoEfetivoVariacao(v) {
  if (!v) return 0;
  return Number(v.preco) || 0;
}

export default function CRMPage() {
  const toast = useToast();
  const { user } = useAuthStore();
  const podeConfigurar = podeConfigurarEtapas(user?.perfil);
  const [searchParams, setSearchParams] = useSearchParams();

  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [view, setView] = useState('kanban');

  const [modalLead, setModalLead] = useState({ open: false, data: null });
  const [modalCatalogoEtapas, setModalCatalogoEtapas] = useState(false);
  const [drawerLead, setDrawerLead] = useState({ open: false, lead: null });

  useEffect(() => {
    carregar();
  }, []);

  // Suporte a deep-link `?lead=<id>` (vindo de Vendas, Financeiro etc).
  // Abre o drawer assim que os leads chegam; limpa o query param pra nao
  // reabrir em refresh.
  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (!leadId || leads.length === 0) return;
    const alvo = leads.find((l) => l.id === leadId);
    if (alvo) {
      setDrawerLead({ open: true, lead: alvo });
      const next = new URLSearchParams(searchParams);
      next.delete('lead');
      setSearchParams(next, { replace: true });
    }
  }, [leads, searchParams, setSearchParams]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [s, l] = await Promise.all([
        api.get('/crm/stages').catch(() => ({ data: [] })),
        api.get('/crm/leads').catch(() => ({ data: [] })),
      ]);
      setStages(s.data || []);
      setLeads(l.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const leadsFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) => l.nome?.toLowerCase().includes(q) ||
             l.telefone?.includes(q) ||
             l.email?.toLowerCase().includes(q) ||
             l.tags?.toLowerCase().includes(q)
    );
  }, [leads, busca]);

  const leadsPorEtapa = useMemo(() => {
    const map = {};
    stages.forEach((s) => { map[s.id] = []; });
    map['_sem_etapa'] = [];
    leadsFiltered.forEach((l) => {
      if (l.etapaId && map[l.etapaId]) map[l.etapaId].push(l);
      else map['_sem_etapa'].push(l);
    });
    return map;
  }, [stages, leadsFiltered]);

  const handleSalvarLead = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/crm/leads/${dados.id}`, dados);
        toast.success('Lead atualizado');
      } else {
        await api.post('/crm/leads', dados);
        toast.success('Lead criado');
      }
      setModalLead({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleExcluirLead = async (lead) => {
    if (!confirm(`Excluir lead "${lead.nome}"?`)) return;
    try {
      await api.delete(`/crm/leads/${lead.id}`);
      toast.success('Lead excluido');
      setDrawerLead({ open: false, lead: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  const handleMoverLead = async (lead, etapaId) => {
    try {
      await api.put(`/crm/leads/${lead.id}`, { ...lead, etapaId });
      toast.success('Lead movido');
      carregar();
    } catch {
      toast.error('Erro ao mover');
    }
  };

  // Habilita etapa do catalogo. Idempotente no backend (upsert).
  const handleHabilitarEtapa = async (slug) => {
    try {
      await api.post(`/crm/stages/catalogo/${slug}`);
      toast.success('Etapa habilitada');
      await carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao habilitar etapa');
    }
  };

  // Desabilita. Bloqueia (409) se houver leads na etapa — toast explicativo.
  const handleDesabilitarEtapa = async (slug) => {
    try {
      await api.delete(`/crm/stages/catalogo/${slug}`);
      toast.success('Etapa desabilitada');
      await carregar();
    } catch (e) {
      const msg = e.response?.data?.error || 'Erro ao desabilitar etapa';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
          <SearchBar
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone, email ou tag..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList variant="pills">
              <TabsTrigger value="kanban" variant="pills" icon={LayoutGrid}>Kanban</TabsTrigger>
              <TabsTrigger value="lista" variant="pills" icon={List}>Lista</TabsTrigger>
            </TabsList>
          </Tabs>
          {/* So dono/administrador pode configurar etapas do funil */}
          {podeConfigurar && (
            <Button variant="secondary" icon={Settings} onClick={() => setModalCatalogoEtapas(true)}>
              Configurar etapas
            </Button>
          )}
          <Button variant="primary" icon={Plus} onClick={() => setModalLead({ open: true, data: null })}>
            Novo lead
          </Button>
        </div>
      </div>

      {carregando ? (
        <Card padding="lg">
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div>
        </Card>
      ) : leads.length === 0 && stages.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={LayoutGrid}
            title="CRM ainda vazio"
            description={
              podeConfigurar
                ? 'Habilite as etapas do funil que voce vai usar (ex: Novo, Qualificado, Em negociacao, Fechado) e depois cadastre os primeiros leads.'
                : 'Peca ao dono da conta pra habilitar as etapas do funil. Depois disso voce ja pode cadastrar leads.'
            }
            action={
              <div className="flex gap-2 justify-center">
                {podeConfigurar && (
                  <Button variant="secondary" icon={Settings} onClick={() => setModalCatalogoEtapas(true)}>
                    Habilitar etapas
                  </Button>
                )}
                <Button variant="primary" icon={Plus} onClick={() => setModalLead({ open: true, data: null })}>
                  Criar primeiro lead
                </Button>
              </div>
            }
          />
        </Card>
      ) : view === 'kanban' ? (
        <KanbanView
          stages={stages}
          leadsPorEtapa={leadsPorEtapa}
          onSelecionarLead={(l) => setDrawerLead({ open: true, lead: l })}
          onConfigurarEtapas={podeConfigurar ? () => setModalCatalogoEtapas(true) : null}
          onMoverLead={handleMoverLead}
        />
      ) : (
        <ListaView
          leads={leadsFiltered}
          stages={stages}
          onSelecionarLead={(l) => setDrawerLead({ open: true, lead: l })}
        />
      )}

      <ModalLead
        isOpen={modalLead.open}
        onClose={() => setModalLead({ open: false, data: null })}
        lead={modalLead.data}
        stages={stages}
        onSalvar={handleSalvarLead}
      />

      <ModalCatalogoEtapas
        isOpen={modalCatalogoEtapas}
        onClose={() => setModalCatalogoEtapas(false)}
        onHabilitar={handleHabilitarEtapa}
        onDesabilitar={handleDesabilitarEtapa}
      />

      <DrawerLead
        isOpen={drawerLead.open}
        onClose={() => setDrawerLead({ open: false, lead: null })}
        lead={drawerLead.lead}
        stages={stages}
        onEditar={() => {
          setModalLead({ open: true, data: drawerLead.lead });
          setDrawerLead({ open: false, lead: null });
        }}
        onExcluir={() => handleExcluirLead(drawerLead.lead)}
        onMover={(etapaId) => {
          handleMoverLead(drawerLead.lead, etapaId);
          setDrawerLead({ open: false, lead: null });
        }}
      />
    </div>
  );
}

function KanbanView({ stages, leadsPorEtapa, onSelecionarLead, onConfigurarEtapas, onMoverLead }) {
  const stagesOrdenadas = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const semEtapa = leadsPorEtapa['_sem_etapa'] || [];

  return (
    <div className="overflow-x-auto custom-scrollbar -mx-4 px-4 pb-4">
      <div className="flex gap-3 min-w-max">
        {semEtapa.length > 0 && (
          <KanbanColumn
            stage={{ id: '_sem_etapa', nome: 'Sem etapa', cor: null }}
            leads={semEtapa}
            stages={stages}
            onSelecionarLead={onSelecionarLead}
            onMoverLead={onMoverLead}
            isSemEtapa
          />
        )}
        {stagesOrdenadas.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={leadsPorEtapa[stage.id] || []}
            stages={stages}
            onSelecionarLead={onSelecionarLead}
            onMoverLead={onMoverLead}
          />
        ))}
        {/* Coluna 'fantasma' pra habilitar mais etapas. So aparece pra quem pode configurar. */}
        {onConfigurarEtapas && (
          <button
            onClick={onConfigurarEtapas}
            className="w-72 flex-shrink-0 border border-dashed border-[var(--border-main)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-main)] py-12"
            type="button"
          >
            <Settings size={20} strokeWidth={1.75} />
            <span className="text-sm font-medium">Configurar etapas</span>
          </button>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ stage, leads, stages, onSelecionarLead, onMoverLead, isSemEtapa }) {
  const totalValor = leads.reduce((acc, l) => acc + Number(l.valor || 0), 0);

  return (
    <div className="w-72 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 px-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {stage.cor && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.cor }} />}
          <span className="text-sm font-semibold tracking-tight text-[var(--text-main)] truncate">{stage.nome}</span>
          <Badge variant="neutral" size="sm">{leads.length}</Badge>
        </div>
        {/* Acoes de etapa removidas — configurar etapas e feito pelo Modal
            de Catalogo (Configurar etapas), nao mais inline por coluna. */}
      </div>
      {totalValor > 0 && (
        <div className="text-xs text-[var(--text-muted)] px-2 mb-2 tabular-nums">{fmtBRL(totalValor)}</div>
      )}

      <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2 flex-1 min-h-[200px] space-y-2">
        {leads.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)]">Vazio</div>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              stages={stages}
              currentStageId={isSemEtapa ? null : stage.id}
              onClick={() => onSelecionarLead(lead)}
              onMover={onMoverLead}
            />
          ))
        )}
      </div>
    </div>
  );
}

const SLUGS_ETAPA_FECHADA = new Set(['fechado-ganho', 'fechado-perdido']);

function KanbanCard({ lead, stages, currentStageId, onClick, onMover }) {
  const tags = lead.tags?.split(',').map((t) => t.trim()).filter(Boolean) || [];
  const stagesOrdenadas = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const idx = stagesOrdenadas.findIndex((s) => s.id === currentStageId);
  // Lead fechado (ganho ou perdido) nao tem mais acao de mover — a etapa e
  // final; reabertura so acontece automaticamente (novo contato/devolucao
  // proxima), nunca manual.
  const etapaFechada = idx >= 0 && SLUGS_ETAPA_FECHADA.has(stagesOrdenadas[idx].slug);
  const proxima = !etapaFechada && idx >= 0 && idx < stagesOrdenadas.length - 1 ? stagesOrdenadas[idx + 1] : null;
  const anterior = !etapaFechada && idx > 0 ? stagesOrdenadas[idx - 1] : null;

  const prioridadeColor = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' }[lead.prioridade] || 'neutral';

  return (
    <div
      onClick={onClick}
      className="bg-[var(--bg-card)] border border-[var(--border-main)] p-3 cursor-pointer hover:border-[var(--text-muted)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar name={lead.nome} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">{lead.nome}</div>
            {lead.telefone && <div className="text-[11px] text-[var(--text-muted)] truncate">{lead.telefone}</div>}
          </div>
        </div>
        {lead.prioridade && (
          <Badge variant={prioridadeColor} size="sm">
            {lead.prioridade === 'HIGH' ? 'Alta' : lead.prioridade === 'MEDIUM' ? 'Media' : 'Baixa'}
          </Badge>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        {lead.valor > 0 ? (
          <span className="text-xs font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(lead.valor)}</span>
        ) : <span />}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {etapaFechada ? (
            <span title="Lead fechado — não pode ser movido manualmente." className="p-1 text-[var(--text-muted)]">
              <Lock size={12} />
            </span>
          ) : (
            <>
              {anterior && (
                <button
                  title={`Mover para ${anterior.nome}`}
                  onClick={() => onMover(lead, anterior.id)}
                  className="p-1 border border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  <ArrowLeft size={12} />
                </button>
              )}
              {proxima && (
                <button
                  title={`Mover para ${proxima.nome}`}
                  onClick={() => onMover(lead, proxima.id)}
                  className="p-1 border border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  <ArrowRight size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ListaView({ leads, stages, onSelecionarLead }) {
  if (leads.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState icon={List} title="Nenhum lead encontrado" description="Tente ajustar a busca ou criar um novo lead." />
      </Card>
    );
  }
  const getStageNome = (etapaId) => stages.find((s) => s.id === etapaId)?.nome || '—';

  return (
    <Card padding="none">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-main)]">
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Lead</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Etapa</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Contato</th>
            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              onClick={() => onSelecionarLead(l)}
              className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors"
            >
              <td className="py-3 px-5">
                <div className="flex items-center gap-3">
                  <Avatar name={l.nome} size="sm" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{l.nome}</div>
                    {l.tags && <div className="text-[11px] text-[var(--text-muted)]">{l.tags}</div>}
                  </div>
                </div>
              </td>
              <td className="py-3 px-5"><Badge variant="neutral" size="sm">{getStageNome(l.etapaId)}</Badge></td>
              <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">{l.telefone || l.email || '—'}</td>
              <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(l.valor)}</td>
              <td className="py-3 px-5 text-xs text-[var(--text-muted)]">{new Date(l.atualizadoEm).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// =====================================================================
// MODAL DE LEAD
// =====================================================================
// Cadastra/edita lead. NAO tem mais campo 'Valor estimado' — o valor do
// lead e calculado pelo backend somando os produtos/servicos vinculados.
// Aqui o usuario seleciona 1 ou mais variacoes do catalogo, e o total
// aparece automaticamente.
//
// Tons: linguagem coloquial, perguntas. Campos agrupados em 3 secoes:
//   1. Quem e o cliente
//   2. O que ele quer comprar (com tabela de itens)
//   3. Contexto (etapa, urgencia, origem, etiquetas)
function ModalLead({ isOpen, onClose, lead, stages, onSalvar }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', cpf: '', dataNascimento: '',
    etapaId: '', tags: '', prioridade: 'MEDIUM', origem: 'MANUAL', observacoes: '',
  });
  // Itens selecionados: [{ variacaoId, quantidade, observacao, _v: { ...variacao+produto } }].
  // O _v fica em memoria so pra UI calcular total/exibir; backend recebe sem ele.
  const [itens, setItens] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);

  // Carrega catalogo (uma unica vez por abertura) — flatten produto > variacoes.
  useEffect(() => {
    if (!isOpen) return;
    setCarregandoCatalogo(true);
    api.get('/catalogo')
      .then((r) => {
        const flat = [];
        (r.data || []).forEach((p) => {
          (p.variacoes || []).forEach((v) => flat.push({ ...v, produto: p }));
        });
        setCatalogo(flat);
      })
      .catch(() => setCatalogo([]))
      .finally(() => setCarregandoCatalogo(false));
  }, [isOpen]);

  // Hidrata o form ao abrir.
  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome || '',
        telefone: lead.telefone || '',
        email: lead.email || '',
        // CPF vem do backend so com digitos — aplicar mascara aqui.
        cpf: lead.cpf ? formatarCpf(lead.cpf) : '',
        // Data nasc vem em ISO — pegar so YYYY-MM-DD pro input type=date.
        dataNascimento: lead.dataNascimento ? new Date(lead.dataNascimento).toISOString().slice(0, 10) : '',
        etapaId: lead.etapaId || '',
        tags: lead.tags || '',
        prioridade: lead.prioridade || 'MEDIUM',
        origem: lead.origem || 'MANUAL',
        observacoes: lead.observacoes || '',
      });
      // Mapeia LeadVariacao -> formato local de itens.
      setItens((lead.variacoes || []).map((lv) => ({
        variacaoId: lv.variacao?.id || lv.variacaoId,
        quantidade: lv.quantidade || 1,
        observacao: lv.observacao || '',
        _v: lv.variacao || null,
      })));
    } else {
      setForm({
        nome: '', telefone: '', email: '', cpf: '', dataNascimento: '',
        etapaId: '', tags: '', prioridade: 'MEDIUM', origem: 'MANUAL', observacoes: '',
      });
      setItens([]);
    }
  }, [lead, isOpen]);

  const adicionarItem = (variacaoId) => {
    if (!variacaoId) return;
    const v = catalogo.find((x) => x.id === variacaoId);
    if (!v) return;
    // Se ja tem, incrementa qtd em vez de duplicar (mesma regra do backend).
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.variacaoId === variacaoId);
      if (idx >= 0) {
        const novo = [...prev];
        novo[idx] = { ...novo[idx], quantidade: novo[idx].quantidade + 1 };
        return novo;
      }
      return [...prev, { variacaoId, quantidade: 1, observacao: '', _v: v }];
    });
  };

  const mudarQuantidade = (variacaoId, qtd) => {
    const q = Math.max(1, parseInt(qtd, 10) || 1);
    setItens((prev) => prev.map((i) => (i.variacaoId === variacaoId ? { ...i, quantidade: q } : i)));
  };

  const removerItem = (variacaoId) => {
    setItens((prev) => prev.filter((i) => i.variacaoId !== variacaoId));
  };

  const total = useMemo(
    () => itens.reduce((acc, i) => acc + precoEfetivoVariacao(i._v) * i.quantidade, 0),
    [itens]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Coloca o nome do cliente'); return; }
    onSalvar({
      ...form,
      // CPF: manda so digitos pro backend. Vazio = null (limpa o campo).
      cpf: limparCpf(form.cpf) || null,
      // Data nascimento: '' do input type=date vira null pro backend.
      dataNascimento: form.dataNascimento || null,
      // Backend recalcula 'valor' pela soma dos itens — nao mandamos mais.
      variacoes: itens.map((i) => ({
        variacaoId: i.variacaoId,
        quantidade: i.quantidade,
        observacao: i.observacao || null,
      })),
      ...(lead?.id ? { id: lead.id } : {}),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lead ? 'Editar lead' : 'Novo lead'} description="Cadastre quem é o cliente e o que ele quer comprar." size="2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Secao 1: Quem e */}
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">Quem é o cliente</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              size="lg"
              label="Nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Maria Silva"
              required
              autoFocus
            />
            <Input
              size="lg"
              label="Telefone"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: formatarTelefoneBR(e.target.value) })}
              placeholder="(11) 99999-9999"
              maxLength={15}
              inputMode="tel"
            />
            <Input
              size="lg"
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="cliente@email.com"
            />
            <Input
              size="lg"
              label="CPF"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatarCpf(e.target.value) })}
              placeholder="000.000.000-00"
              maxLength={14}
              inputMode="numeric"
            />
            <Input
              size="lg"
              label="Data de nascimento"
              type="date"
              value={form.dataNascimento}
              onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
              hint="Pra parabéns automático e segmentação por idade."
            />
          </div>
        </div>

        {/* Secao 2: O que ele quer comprar (substitui Valor estimado) */}
        <div className="border-t border-[var(--border-main)] pt-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">O que ele quer comprar</div>

          <Combobox
            size="lg"
            label="Adicionar produto/serviço do catálogo"
            value=""
            onChange={(id) => { if (id) adicionarItem(id); }}
            options={catalogo
              .filter((v) => !itens.some((i) => i.variacaoId === v.id))
              .map((v) => ({
                value: v.id,
                label: `${v.produto?.nome} - ${v.nome}`,
                sublabel: [
                  precoEfetivoVariacao(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                  v.produto?.tipo === 'FISICO' ? `${v.estoqueAtual} em estoque` : null,
                  v.produto?.tipo === 'SERVICO' && v.duracaoMin ? `${v.duracaoMin}min` : null,
                ].filter(Boolean).join(' · '),
              }))}
            placeholder={carregandoCatalogo ? 'Carregando...' : 'Buscar produto ou serviço'}
            clearable
            hint="Pode adicionar vários. O total é calculado automaticamente."
          />

          {/* Lista de itens selecionados */}
          {itens.length > 0 && (
            <div className="mt-3 space-y-2">
              {itens.map((item) => {
                const v = item._v;
                const ehServico = v?.produto?.tipo === 'SERVICO';
                const precoUnit = precoEfetivoVariacao(v);
                return (
                  <div key={item.variacaoId} className="flex items-center gap-3 p-3 border border-[var(--border-main)] bg-[var(--bg-card)]">
                    {/* Info do item (cresce e trunca) */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-main)] truncate">
                        {v?.produto?.nome} <span className="text-[var(--text-muted)] font-normal">{v?.nome}</span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                        <span>{fmtBRL(precoUnit)} cada</span>
                        {ehServico && v?.duracaoMin && (
                          <><span>·</span><span>{v.duracaoMin}min</span></>
                        )}
                      </div>
                    </div>

                    {/* Stepper de quantidade — input nativo compacto, sem o
                        wrapper w-full do componente <Input> */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => mudarQuantidade(item.variacaoId, item.quantidade - 1)}
                        className="w-7 h-9 border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] text-sm font-semibold transition-colors"
                        aria-label="Diminuir quantidade"
                        disabled={item.quantidade <= 1}
                      >−</button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => mudarQuantidade(item.variacaoId, e.target.value)}
                        className="w-12 h-9 text-center text-sm font-semibold tabular-nums border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--text-muted)]"
                        aria-label="Quantidade"
                      />
                      <button
                        type="button"
                        onClick={() => mudarQuantidade(item.variacaoId, item.quantidade + 1)}
                        className="w-7 h-9 border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] text-sm font-semibold transition-colors"
                        aria-label="Aumentar quantidade"
                      >+</button>
                    </div>

                    {/* Subtotal alinhado a direita */}
                    <div className="text-sm font-semibold text-[var(--text-main)] tabular-nums w-24 text-right flex-shrink-0">
                      {fmtBRL(precoUnit * item.quantidade)}
                    </div>

                    <IconButton
                      icon={Trash2}
                      variant="ghost"
                      size="sm"
                      onClick={() => removerItem(item.variacaoId)}
                      ariaLabel="Remover item"
                    />
                  </div>
                );
              })}

              {/* Total agregado */}
              <div className="flex items-center justify-between px-3 py-2.5 border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-main)] font-semibold">
                <span className="text-sm">Total estimado</span>
                <span className="text-base tabular-nums">{fmtBRL(total)}</span>
              </div>
            </div>
          )}
          {itens.length === 0 && (
            <div className="text-sm text-[var(--text-muted)] italic mt-3">
              Nenhum item adicionado ainda. O lead pode ser salvo sem produto, mas é mais fácil acompanhar quando você sabe o que ele quer.
            </div>
          )}
        </div>

        {/* Secao 3: Contexto */}
        <div className="border-t border-[var(--border-main)] pt-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">Contexto da venda</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              size="lg"
              label="Em qual etapa está?"
              value={form.etapaId || ''}
              onChange={(e) => setForm({ ...form, etapaId: e.target.value })}
              placeholder="Sem etapa"
              options={stages.map((s) => ({ value: s.id, label: s.nome }))}
              hint={stages.length === 0 ? 'Habilite etapas em "Configurar etapas" primeiro' : null}
            />
            <Select
              size="lg"
              label="Urgência"
              value={form.prioridade}
              onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
              options={PRIORIDADES}
              placeholder=""
            />
            <Input
              size="lg"
              label="Etiquetas (separadas por vírgula)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="cliente vip, lead quente, indicação"
              hint="Palavras-chave pra filtrar depois."
            />
          </div>
          <Textarea
            size="lg"
            label="Anotações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            rows={3}
            placeholder="O que você sabe sobre esse cliente: necessidades, prazo, restrições..."
            className="mt-4"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{lead ? 'Salvar' : 'Criar lead'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// MODAL DE CATALOGO DE ETAPAS
// =====================================================================
// Lista as 8 etapas pre-definidas com um toggle pra habilitar/desabilitar.
// Substitui o antigo modal de nome livre — o tenant nao inventa etapa,
// escolhe de um catalogo curado.
//
// Permissao: o botao que abre esse modal so aparece pra CLIENT/ADMINISTRADOR
// (controlado em CRMPage via podeConfigurar). Backend tambem trava em
// requerPapelPrivilegiado, entao mesmo manipulando a chamada o vendedor
// recebe 403.
function ModalCatalogoEtapas({ isOpen, onClose, onHabilitar, onDesabilitar }) {
  const [catalogo, setCatalogo] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvandoSlug, setSalvandoSlug] = useState(null);

  const carregarCatalogo = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/crm/stages/catalogo');
      setCatalogo(r.data || []);
    } catch {
      setCatalogo([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isOpen) carregarCatalogo();
  }, [isOpen]);

  const handleToggle = async (item, novoEstado) => {
    setSalvandoSlug(item.slug);
    try {
      if (novoEstado) {
        await onHabilitar(item.slug);
      } else {
        await onDesabilitar(item.slug);
      }
      await carregarCatalogo();
    } finally {
      setSalvandoSlug(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar etapas do funil" description="Ligue so as etapas que voce usa. O resto fica de fora pra nao poluir o kanban." size="md">
      <div className="space-y-2">
        {carregando ? (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">Carregando...</div>
        ) : (
          catalogo.map((item) => (
            <div key={item.slug} className="flex items-center gap-3 p-3 border border-[var(--border-main)] bg-[var(--bg-card)]">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.cor }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold tracking-tight text-[var(--text-main)]">{item.nome}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{item.descricao}</div>
              </div>
              <Switch
                checked={item.habilitada}
                disabled={salvandoSlug === item.slug}
                onChange={(v) => handleToggle(item, v)}
                ariaLabel={`${item.habilitada ? 'Desabilitar' : 'Habilitar'} etapa ${item.nome}`}
              />
            </div>
          ))
        )}

        <div className="flex items-start gap-2 p-3 border border-[var(--border-subtle)] bg-[var(--info-soft)] text-[var(--info-text)] mt-3">
          <Lock size={14} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Etapa com leads nao pode ser desabilitada.</strong> Mova ou exclua os leads dela primeiro pra liberar o desligamento.
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <Button variant="primary" onClick={onClose}>Pronto</Button>
        </div>
      </div>
    </Modal>
  );
}

function DrawerLead({ isOpen, onClose, lead, stages, onEditar, onExcluir, onMover }) {
  const toast = useToast();
  const [historico, setHistorico] = useState([]);
  const [novaObs, setNovaObs] = useState('');
  const [carregandoObs, setCarregandoObs] = useState(false);

  useEffect(() => {
    if (lead?.id) {
      api.get(`/crm/leads/${lead.id}/history`)
        .then((r) => setHistorico(r.data || []))
        .catch(() => setHistorico([]));
    }
  }, [lead?.id]);

  const adicionarObs = async () => {
    if (!novaObs.trim()) return;
    setCarregandoObs(true);
    try {
      await api.post(`/crm/leads/${lead.id}/history`, { observacoes: novaObs });
      const r = await api.get(`/crm/leads/${lead.id}/history`);
      setHistorico(r.data || []);
      setNovaObs('');
      toast.success('Observacao adicionada');
    } catch {
      toast.error('Erro ao adicionar');
    } finally {
      setCarregandoObs(false);
    }
  };

  if (!lead) return null;
  const stageAtual = stages.find((s) => s.id === lead.etapaId);
  const etapaFechada = SLUGS_ETAPA_FECHADA.has(stageAtual?.slug);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={lead.nome}
      description={lead.email || lead.telefone}
      size="md"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="danger-soft" icon={Trash2} onClick={onExcluir}>Excluir</Button>
          <Button variant="primary" icon={Edit2} onClick={onEditar}>Editar lead</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar name={lead.nome} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {stageAtual && <Badge variant="neutral" size="sm">{stageAtual.nome}</Badge>}
              {lead.prioridade && (
                <Badge variant={lead.prioridade === 'HIGH' ? 'danger' : lead.prioridade === 'MEDIUM' ? 'warning' : 'neutral'} size="sm">
                  {lead.prioridade === 'HIGH' ? 'Alta' : lead.prioridade === 'MEDIUM' ? 'Media' : 'Baixa'} prioridade
                </Badge>
              )}
            </div>
            {lead.valor > 0 && <div className="text-lg font-semibold text-[var(--text-main)] mt-1 tabular-nums">{fmtBRL(lead.valor)}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {lead.telefone && (
            <a href={`tel:${lead.telefone}`} className="flex items-center gap-2 px-3 py-2.5 border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
              <Phone size={14} /> {lead.telefone}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 px-3 py-2.5 border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
              <Mail size={14} /> {lead.email}
            </a>
          )}
          {lead.cpf && (
            <div className="flex items-center gap-2 px-3 py-2.5 border border-[var(--border-main)] text-sm font-medium text-[var(--text-secondary)]">
              <IdCard size={14} /> {formatarCpf(lead.cpf)}
            </div>
          )}
          {lead.dataNascimento && (
            <div className="flex items-center gap-2 px-3 py-2.5 border border-[var(--border-main)] text-sm font-medium text-[var(--text-secondary)]">
              <Cake size={14} /> {new Date(lead.dataNascimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          )}
        </div>

        {stages.length > 0 && (
          etapaFechada ? (
            <div className="flex items-center gap-2 px-3 py-2.5 border border-[var(--border-main)] bg-[var(--bg-subtle)]/40 text-xs text-[var(--text-muted)]">
              <Lock size={14} /> Lead fechado — não pode ser movido manualmente. Reabre sozinho se o cliente entrar em contato de novo.
            </div>
          ) : (
            <div>
              <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Mover para etapa</div>
              <div className="flex flex-wrap gap-1.5">
                {[...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onMover(s.id)}
                    disabled={s.id === lead.etapaId}
                    className={`px-3 py-1.5 text-xs font-semibold border transition-colors ${
                      s.id === lead.etapaId
                        ? 'bg-[var(--primary)] text-[var(--text-on-primary)] border-[var(--primary)] cursor-default'
                        : 'border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {lead.tags && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.split(',').map((t, i) => (<Badge key={i} variant="neutral" size="sm" icon={Tag}>{t.trim()}</Badge>))}
            </div>
          </div>
        )}

        {lead.observacoes && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Observacoes</div>
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3">{lead.observacoes}</div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-2">
            <History size={14} className="text-[var(--text-muted)]" />
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">Historico ({historico.length})</div>
          </div>
          <div className="space-y-2 mb-3">
            <Textarea value={novaObs} onChange={(e) => setNovaObs(e.target.value)} placeholder="Adicionar observacao..." rows={2} />
            <Button variant="secondary" size="sm" onClick={adicionarObs} loading={carregandoObs} disabled={!novaObs.trim()}>Adicionar</Button>
          </div>
          {historico.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-4">Sem registros ainda</div>
          ) : (
            <div className="space-y-2">
              {historico.map((h) => (
                <div key={h.id} className="flex gap-2 text-xs border-l-2 border-[var(--border-main)] pl-3 py-1">
                  <Clock size={11} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[var(--text-secondary)]">{h.observacoes}</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{h.acao} · {new Date(h.criadoEm).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
