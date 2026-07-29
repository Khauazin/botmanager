import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag, Plus, Calendar, User, Package, Ban, Trash2, Wallet,
  MoreVertical, UserPlus, ExternalLink, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import vendaService from '../services/vendaService';
import {
  Card, CardHeader, CardTitle, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, Drawer, useToast, Combobox, Dropdown, DropdownItem, DropdownDivider,
  KpiCard,
} from '../components/ui';
import Modal from '../components/Modal';

const STATUS_BADGE = {
  COMPLETED: { variant: 'success', label: 'Concluida' },
  PENDING: { variant: 'warning', label: 'Pendente' },
  CANCELLED: { variant: 'danger', label: 'Cancelada' },
  REFUNDED: { variant: 'neutral', label: 'Reembolsada' },
};

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function VendasPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [vendas, setVendas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState({ open: false });
  const [drawer, setDrawer] = useState({ open: false, venda: null });
  // Modal de cancelamento — motivo obrigatorio (backend exige >= 5 chars).
  const [modalCancelar, setModalCancelar] = useState({ open: false, venda: null });
  // Modal de "caixa fechado" — aparece quando backend rejeita venda manual
  // (codigo CAIXA_FECHADO). Tem botao que leva direto pra tela do caixa.
  const [modalCaixaFechado, setModalCaixaFechado] = useState(false);
  // Vincular cliente a venda existente (retroativo). Util quando a venda foi
  // feita sem identificar o cliente e dps a equipe descobre quem era.
  const [modalVincularLead, setModalVincularLead] = useState({ open: false, venda: null });

  // Filtros + paginacao client-side (50 por pagina cobre uso real).
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  // Periodo: '' (todos), 'mes' (mes corrente), 'mes-passado', '30d' (ultimos 30d).
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 50;

  useEffect(() => {
    carregar();
  }, []);

  // Reseta paginacao quando filtros mudam pra evitar pagina vazia.
  useEffect(() => {
    setPagina(1);
  }, [busca, filtroStatus, filtroMetodo, filtroPeriodo]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [v, p, l, c] = await Promise.all([
        api.get('/vendas').catch(() => ({ data: [] })),
        api.get('/catalogo').catch(() => ({ data: [] })),
        api.get('/crm/leads').catch(() => ({ data: [] })),
        api.get('/financeiro/categorias').catch(() => ({ data: [] })),
      ]);
      setVendas(v.data || []);
      setProdutos(p.data || []);
      setLeads(l.data || []);
      setCategorias(c.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const variacoes = useMemo(() => {
    const out = [];
    produtos.forEach((p) => {
      (p.variacoes || []).forEach((v) => out.push({ ...v, produto: p }));
    });
    return out;
  }, [produtos]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioMesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const fimMesPassado = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);
    const inicio30d = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    return vendas.filter((v) => {
      if (q) {
        const matchTexto =
          v.descricao?.toLowerCase().includes(q) ||
          v.lead?.nome?.toLowerCase().includes(q) ||
          String(v.numero ?? '').includes(q);
        if (!matchTexto) return false;
      }
      if (filtroStatus && v.status !== filtroStatus) return false;
      if (filtroMetodo && v.metodoPagamento !== filtroMetodo) return false;
      if (filtroPeriodo) {
        const d = new Date(v.criadoEm);
        if (filtroPeriodo === 'mes' && d < inicioMes) return false;
        if (filtroPeriodo === 'mes-passado' && (d < inicioMesPassado || d > fimMesPassado)) return false;
        if (filtroPeriodo === '30d' && d < inicio30d) return false;
      }
      return true;
    });
  }, [vendas, busca, filtroStatus, filtroMetodo, filtroPeriodo]);

  // Paginacao client-side. Suficiente pra ate ~5k vendas — alem disso vale
  // mover pra server-side com query params.
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginadas = useMemo(
    () => filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    [filtradas, pagina]
  );

  // Lista de metodos de pagamento que aparecem no filtro (so os que existem
  // nas vendas atuais — evita opcoes "fantasma" no select).
  const metodosDisponiveis = useMemo(() => {
    const set = new Set();
    vendas.forEach((v) => { if (v.metodoPagamento) set.add(v.metodoPagamento); });
    return [...set];
  }, [vendas]);

  const temFiltroAtivo = !!(busca || filtroStatus || filtroMetodo || filtroPeriodo);
  const limparFiltros = () => {
    setBusca('');
    setFiltroStatus('');
    setFiltroMetodo('');
    setFiltroPeriodo('');
  };

  const handleRegistrar = async (dados) => {
    try {
      await api.post('/vendas', dados);
      toast.success('Venda registrada');
      setModal({ open: false });
      carregar();
    } catch (e) {
      // Caixa fechado: abre modal de aviso com link pro caixa em vez do toast
      // generico — pra usuario nao se confundir.
      if (e.response?.data?.codigo === 'CAIXA_FECHADO') {
        setModalCaixaFechado(true);
        return;
      }
      toast.error(e.response?.data?.error || 'Erro ao registrar venda');
    }
  };

  // Abre modal de cancelamento (motivo obrigatorio).
  const handleAbrirCancelar = (venda) => {
    if (!venda) return;
    if (venda.status === 'CANCELLED') {
      toast.info('Venda já está cancelada.');
      return;
    }
    setModalCancelar({ open: true, venda });
  };

  // Vincula um lead (cliente) a venda. leadId=null = desvinculo.
  // Backend propaga pros lancamentos financeiros pra manter consistencia.
  const handleVincularLead = async (leadId) => {
    const venda = modalVincularLead.venda;
    if (!venda) return;
    try {
      await vendaService.vincularLead(venda.id, leadId);
      toast.success(leadId ? 'Cliente vinculado à venda.' : 'Cliente desvinculado.');
      setModalVincularLead({ open: false, venda: null });
      setDrawer({ open: false, venda: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao vincular cliente.');
    }
  };

  // Confirma o cancelamento — motivo ja validado no modal (min 5 chars).
  // Backend tambem valida e retorna 422 se vier curto.
  const handleConfirmarCancelar = async (motivo) => {
    const venda = modalCancelar.venda;
    if (!venda) return;
    try {
      await vendaService.cancelar(venda.id, motivo);
      toast.success('Venda cancelada. Estoque estornado e lançamento financeiro cancelado.');
      setModalCancelar({ open: false, venda: null });
      setDrawer({ open: false, venda: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao cancelar venda.');
    }
  };

  const totalMes = useMemo(() => {
    const agora = new Date();
    return vendas
      .filter((v) => {
        const d = new Date(v.criadoEm);
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
      })
      .reduce((acc, v) => acc + Number(v.valor || 0), 0);
  }, [vendas]);

  return (
    <div className="space-y-5">
      {/* KPIs — padrao KpiCard compartilhado (ui/KpiCard) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ShoppingBag} color="neutral" label="Vendas (total)" valor={vendas.length} />
        <KpiCard icon={ShoppingBag} color="neutral" label="Faturado total" valor={fmtBRL(vendas.reduce((acc, v) => acc + Number(v.valor || 0), 0))} />
        <KpiCard icon={Calendar} color="neutral" label="Vendas no mes" valor={fmtBRL(totalMes)} />
        <KpiCard icon={User} color="neutral" label="Vendas via lead" valor={vendas.filter((v) => v.leadId).length} />
      </div>

      {/* Toolbar com busca + filtros + acao primaria */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descricao, cliente ou numero..." />
        </div>
        <Select
          size="sm"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          fullWidth={false}
          className="min-w-[140px]"
          placeholder=""
          options={[
            { value: '', label: 'Todos status' },
            { value: 'COMPLETED', label: 'Concluidas' },
            { value: 'CANCELLED', label: 'Canceladas' },
            { value: 'PENDING', label: 'Pendentes' },
          ]}
        />
        {metodosDisponiveis.length > 0 && (
          <Select
            size="sm"
            value={filtroMetodo}
            onChange={(e) => setFiltroMetodo(e.target.value)}
            fullWidth={false}
            className="min-w-[140px]"
            placeholder=""
            options={[
              { value: '', label: 'Todos metodos' },
              ...metodosDisponiveis.map((m) => ({ value: m, label: m })),
            ]}
          />
        )}
        <Select
          size="sm"
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value)}
          fullWidth={false}
          className="min-w-[160px]"
          placeholder=""
          options={[
            { value: '', label: 'Qualquer periodo' },
            { value: 'mes', label: 'Mes corrente' },
            { value: 'mes-passado', label: 'Mes passado' },
            { value: '30d', label: 'Ultimos 30 dias' },
          ]}
        />
        {temFiltroAtivo && (
          <Button variant="ghost" size="sm" icon={X} onClick={limparFiltros}>
            Limpar
          </Button>
        )}
        <div className="ml-auto">
          <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true })}>
            Registrar venda
          </Button>
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtradas.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma venda"
            description="Registre sua primeira venda. O sistema vai dar baixa no estoque e gerar o lancamento financeiro automaticamente."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true })}>
                Registrar venda
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Venda</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Cliente</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Pagamento</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Status</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Data</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {paginadas.map((v) => {
                const cancelada = v.status === 'CANCELLED';
                const cfgStatus = STATUS_BADGE[v.status] || { variant: 'neutral', label: v.status || '—' };
                return (
                  <tr
                    key={v.id}
                    onClick={() => setDrawer({ open: true, venda: v })}
                    className={`border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors ${cancelada ? 'opacity-60' : ''}`}
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cancelada ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'}`}>
                          <ShoppingBag size={16} strokeWidth={1.75} />
                        </div>
                        <div>
                          <div className={`text-sm font-semibold tracking-tight ${cancelada ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                            {v.descricao || `Venda #${v.numero ?? v.id.slice(0, 8)}`}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            #{v.numero ?? v.id.slice(0, 6)} · {v.movimentacoesEstoque?.length || 0} itens
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">
                      {v.lead?.nome ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/app/crm?lead=${v.leadId}`); }}
                          className="inline-flex items-center gap-1 text-[var(--text-main)] hover:underline font-medium"
                        >
                          {v.lead.nome}
                          <ExternalLink size={11} className="text-[var(--text-muted)]" />
                        </button>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-5 text-xs">
                      {v.metodoPagamento ? <Badge variant="neutral" size="sm">{v.metodoPagamento}</Badge> : '—'}
                    </td>
                    <td className="py-3 px-5 text-xs">
                      <Badge variant={cfgStatus.variant} size="sm">{cfgStatus.label}</Badge>
                    </td>
                    <td className={`py-3 px-5 text-right text-sm font-semibold tabular-nums ${cancelada ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
                      {fmtBRL(v.valor)}
                    </td>
                    <td className="py-3 px-5 text-xs text-[var(--text-muted)]">
                      {new Date(v.criadoEm).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)] transition-colors"
                            aria-label="Acoes"
                          >
                            <MoreVertical size={16} strokeWidth={1.75} />
                          </button>
                        }
                      >
                        <DropdownItem
                          icon={UserPlus}
                          onClick={() => setModalVincularLead({ open: true, venda: v })}
                        >
                          {v.lead ? 'Trocar cliente' : 'Vincular cliente'}
                        </DropdownItem>
                        {v.lead && (
                          <DropdownItem
                            icon={ExternalLink}
                            onClick={() => navigate(`/app/crm?lead=${v.leadId}`)}
                          >
                            Ver no CRM
                          </DropdownItem>
                        )}
                        {!cancelada && (
                          <>
                            <DropdownDivider />
                            <DropdownItem
                              icon={Ban}
                              variant="danger"
                              onClick={() => handleAbrirCancelar(v)}
                            >
                              Cancelar venda
                            </DropdownItem>
                          </>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Paginacao — so aparece quando ha mais de 1 pagina. */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-main)]">
              <div className="text-xs text-[var(--text-muted)]">
                Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtradas.length)} de {filtradas.length}
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  icon={ChevronLeft}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  ariaLabel="Pagina anterior"
                />
                <div className="text-xs font-semibold tabular-nums px-3">
                  {pagina} / {totalPaginas}
                </div>
                <IconButton
                  icon={ChevronRight}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  ariaLabel="Proxima pagina"
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modal de registrar venda */}
      <ModalVenda
        isOpen={modal.open}
        onClose={() => setModal({ open: false })}
        variacoes={variacoes}
        leads={leads}
        categorias={categorias}
        onSalvar={handleRegistrar}
      />

      {/* Drawer detalhes */}
      <DrawerVenda
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, venda: null })}
        venda={drawer.venda}
        onCancelar={handleAbrirCancelar}
        onVincularLead={(v) => setModalVincularLead({ open: true, venda: v })}
        onIrParaCRM={(leadId) => navigate(`/app/crm?lead=${leadId}`)}
      />

      {/* Modal de cancelamento — motivo obrigatorio (preserva auditoria) */}
      <ModalCancelarVenda
        isOpen={modalCancelar.open}
        onClose={() => setModalCancelar({ open: false, venda: null })}
        venda={modalCancelar.venda}
        onConfirmar={handleConfirmarCancelar}
      />

      {/* Aviso amigavel quando tenta registrar venda sem caixa aberto */}
      <ModalCaixaFechado
        isOpen={modalCaixaFechado}
        onClose={() => setModalCaixaFechado(false)}
        onIrParaCaixa={() => {
          setModalCaixaFechado(false);
          setModal({ open: false });
          navigate('/app/financeiro/caixa');
        }}
      />

      {/* Modal de vinculo retroativo de cliente */}
      <ModalVincularLead
        isOpen={modalVincularLead.open}
        onClose={() => setModalVincularLead({ open: false, venda: null })}
        venda={modalVincularLead.venda}
        leads={leads}
        onConfirmar={handleVincularLead}
      />
    </div>
  );
}

// Helper: retorna o preco de venda da variacao
function precoEfetivoVariacao(v) {
  if (!v) return 0;
  return v.preco || 0;
}

function ModalVenda({ isOpen, onClose, variacoes, leads, categorias, onSalvar }) {
  const [form, setForm] = useState({
    metodoPagamento: 'PIX', observacoes: '', leadId: '',
    // 'parcelas' e metadata: anota na descricao mas nao gera lancamentos
    // separados. Operadora do cartao paga o lojista o valor cheio.
    parcelas: 1,
  });
  // Itens: [{ variacaoId, quantidade, _v: variacao }]. _v fica em memoria
  // pra UI calcular total/estoque/preco sem ir ao backend.
  const [itens, setItens] = useState([]);
  // Data de devolucao por item alugado: { [variacaoId]: 'AAAA-MM-DD' }.
  const [datasDevolucao, setDatasDevolucao] = useState({});
  // Cliente final (nome/telefone/cpf) — so usado quando ha item com devolucao
  // e nenhum cliente do CRM foi selecionado no combobox abaixo.
  const [clienteFinal, setClienteFinal] = useState({ nome: '', telefone: '', cpf: '' });

  // Mapa categoriaId -> nome pra exibir inline em cada item da venda.
  // Categoria vem do produto, nao precisa mais de campo global.
  const mapaCategorias = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nome])),
    [categorias]
  );

  useEffect(() => {
    if (isOpen) {
      setForm({ metodoPagamento: 'PIX', observacoes: '', leadId: '', parcelas: 1 });
      setItens([]);
      setDatasDevolucao({});
      setClienteFinal({ nome: '', telefone: '', cpf: '' });
    }
  }, [isOpen]);

  // Adiciona item e ja sugere categoria do produto (respeitando tipo RECEITA).
  // Se ja tem categoria selecionada, nao sobrescreve.
  const adicionarItem = (variacaoId) => {
    if (!variacaoId) return;
    const v = variacoes.find((x) => x.id === variacaoId);
    if (!v) return;
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.variacaoId === variacaoId);
      if (idx >= 0) {
        // Ja existe: incrementa quantidade (respeitando estoque se fisico).
        const novo = [...prev];
        const novaQtd = novo[idx].quantidade + 1;
        if (v.produto?.tipo === 'FISICO' && novaQtd > v.estoqueAtual) {
          alert(`Estoque insuficiente. Disponivel: ${v.estoqueAtual}`);
          return prev;
        }
        novo[idx] = { ...novo[idx], quantidade: novaQtd };
        return novo;
      }
      return [...prev, { variacaoId, quantidade: 1, _v: v }];
    });
    // Sem auto-preencher categoria global — categoria agora vem do proprio
    // produto (mostrada inline) e o backend gera 1 lancamento por categoria.

    // Item alugavel: sugere a data de devolucao pelo prazo padrao do produto
    // (funcionario ainda pode ajustar). Sem prazo padrao, fica em branco —
    // ele escolhe na hora.
    if (v.produto?.temDevolucao && v.produto?.diasParaDevolucaoPadrao) {
      setDatasDevolucao((prev) => {
        if (prev[variacaoId]) return prev;
        const d = new Date();
        d.setDate(d.getDate() + v.produto.diasParaDevolucaoPadrao);
        return { ...prev, [variacaoId]: d.toISOString().slice(0, 10) };
      });
    }
  };

  const mudarQuantidade = (variacaoId, novaQtd) => {
    const q = Math.max(1, parseInt(novaQtd, 10) || 1);
    setItens((prev) => prev.map((i) => {
      if (i.variacaoId !== variacaoId) return i;
      if (i._v?.produto?.tipo === 'FISICO' && q > i._v.estoqueAtual) {
        alert(`Estoque insuficiente. Disponivel: ${i._v.estoqueAtual}`);
        return i;
      }
      return { ...i, quantidade: q };
    }));
  };

  const removerItem = (variacaoId) => {
    setItens((prev) => prev.filter((i) => i.variacaoId !== variacaoId));
    setDatasDevolucao((prev) => {
      if (!(variacaoId in prev)) return prev;
      const novo = { ...prev };
      delete novo[variacaoId];
      return novo;
    });
  };

  const valorTotal = useMemo(
    () => itens.reduce((acc, i) => acc + precoEfetivoVariacao(i._v) * i.quantidade, 0),
    [itens]
  );

  // Itens que exigem devolucao — precisam de data + cliente identificado.
  const itensComDevolucao = useMemo(
    () => itens.filter((i) => i._v?.produto?.temDevolucao),
    [itens]
  );
  const precisaClienteFinal = itensComDevolucao.length > 0 && !form.leadId;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (itens.length === 0) { alert('Adicione pelo menos 1 produto.'); return; }

    if (itensComDevolucao.length > 0) {
      const semData = itensComDevolucao.find((i) => !datasDevolucao[i.variacaoId]);
      if (semData) {
        alert(`Informe a data de devolução de ${semData._v.produto.nome} (${semData._v.nome}).`);
        return;
      }
      if (precisaClienteFinal && (!clienteFinal.nome.trim() || !clienteFinal.telefone.trim() || !clienteFinal.cpf.trim())) {
        alert('Item com devolução precisa de um cliente identificado: selecione um cliente do CRM ou preencha nome, telefone e CPF.');
        return;
      }
    }

    onSalvar({
      itens: itens.map((i) => ({
        variacaoId: i.variacaoId,
        quantidade: i.quantidade,
        ...(datasDevolucao[i.variacaoId] ? { dataDevolucao: datasDevolucao[i.variacaoId] } : {}),
      })),
      metodoPagamento: form.metodoPagamento,
      observacoes: form.observacoes,
      leadId: form.leadId || undefined,
      ...(precisaClienteFinal ? { clienteFinal } : {}),
      // categoriaId NAO vai mais — backend agrupa por categoria do produto.
      // Parcelas so faz sentido pra credito — backend ignora se outro metodo.
      parcelas: form.metodoPagamento === 'CREDITO' ? (parseInt(form.parcelas, 10) || 1) : 1,
    });
  };

  // Parcelas so aparece quando metodo e cartao de credito.
  const mostraParcelas = form.metodoPagamento === 'CREDITO';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar venda"
      description="Da baixa no estoque e gera lançamento financeiro automaticamente."
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selecao de produtos — combobox alimenta a lista abaixo */}
        <Combobox
          size="lg"
          label="Produtos da venda"
          value=""
          onChange={(id) => { if (id) adicionarItem(id); }}
          placeholder="Buscar produto pra adicionar..."
          options={variacoes
            .filter((v) => !itens.some((i) => i.variacaoId === v.id))
            .map((v) => ({
              value: v.id,
              label: `${v.produto?.nome} - ${v.nome}`,
              sublabel: `${fmtBRL(precoEfetivoVariacao(v))}${v.produto?.tipo === 'FISICO' ? ` · ${v.estoqueAtual} em estoque` : ''}`,
            }))}
          clearable
          hint={itens.length === 0 ? 'Comece adicionando o 1º produto.' : 'Pode adicionar quantos produtos quiser.'}
        />

        {/* Lista de itens adicionados */}
        {itens.length > 0 && (
          <div className="space-y-2">
            {itens.map((item) => {
              const v = item._v;
              const precoUnit = precoEfetivoVariacao(v);
              // Categoria do produto — exibida inline (badge) pra deixar
              // claro pro usuario que cada item leva a categoria propria
              // (1 lancamento financeiro por categoria).
              const catNome = mapaCategorias.get(v?.produto?.categoriaId);
              const alugavel = !!v?.produto?.temDevolucao;
              return (
                <div key={item.variacaoId} className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <Package size={16} strokeWidth={1.75} className="text-[var(--text-muted)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold text-[var(--text-main)] truncate">
                          {v?.produto?.nome} <span className="text-[var(--text-muted)] font-normal">{v?.nome}</span>
                        </div>
                        {catNome
                          ? <Badge variant="neutral" size="sm">{catNome}</Badge>
                          : <Badge variant="warning" size="sm">Sem categoria</Badge>}
                        {alugavel && <Badge variant="accent" size="sm">Aluguel</Badge>}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {fmtBRL(precoUnit)} cada
                        {v?.produto?.tipo === 'FISICO' && ` · ${v.estoqueAtual} em estoque`}
                      </div>
                    </div>

                    {/* Stepper de quantidade */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => mudarQuantidade(item.variacaoId, item.quantidade - 1)}
                        className="w-7 h-9 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] text-sm font-semibold transition-colors"
                        disabled={item.quantidade <= 1}
                        aria-label="Diminuir"
                      >−</button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => mudarQuantidade(item.variacaoId, e.target.value)}
                        className="w-12 h-9 text-center text-sm font-semibold tabular-nums rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--border-main)]"
                        aria-label="Quantidade"
                      />
                      <button
                        type="button"
                        onClick={() => mudarQuantidade(item.variacaoId, item.quantidade + 1)}
                        className="w-7 h-9 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] text-sm font-semibold transition-colors"
                        aria-label="Aumentar"
                      >+</button>
                    </div>

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

                  {/* Item alugavel: exige data de devolucao. Prazo padrao do
                      produto ja vem sugerido (ver adicionarItem); funcionario
                      pode ajustar. */}
                  {alugavel && (
                    <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-[var(--border-subtle)] bg-[var(--warning-soft)]/20">
                      <Input
                        size="sm"
                        type="date"
                        label="Devolução em"
                        value={datasDevolucao[item.variacaoId] || ''}
                        onChange={(e) => setDatasDevolucao((prev) => ({ ...prev, [item.variacaoId]: e.target.value }))}
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total agregado */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-main)] font-semibold">
              <span className="text-sm text-[var(--text-secondary)]">Total da venda</span>
              <span className="text-lg tabular-nums">{fmtBRL(valorTotal)}</span>
            </div>
          </div>
        )}

        {/* Pagamento + parcelas (so credito) — categoria saiu daqui, ela vem
            de cada item (mostrada inline na lista acima). Backend agrupa por
            categoria e cria 1 lancamento financeiro por categoria. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            size="lg"
            label="Como foi pago?"
            value={form.metodoPagamento}
            onChange={(e) => setForm({ ...form, metodoPagamento: e.target.value, parcelas: 1 })}
            options={[
              { value: 'PIX', label: 'PIX' },
              { value: 'DINHEIRO', label: 'Dinheiro' },
              { value: 'DEBITO', label: 'Cartão de débito' },
              { value: 'CREDITO', label: 'Cartão de crédito' },
              { value: 'BOLETO', label: 'Boleto' },
              { value: 'TRANSFERENCIA', label: 'Transferência' },
            ]}
            placeholder=""
          />
          {/* Parcelas — so visivel quando metodo e cartao de credito.
              Metadata: backend nao gera lancamentos separados (operadora paga
              o lojista o valor cheio). Aparece como nota no relatorio. */}
          {mostraParcelas && (
            <Select
              size="lg"
              label="Em quantas vezes?"
              value={String(form.parcelas)}
              onChange={(e) => setForm({ ...form, parcelas: parseInt(e.target.value, 10) || 1 })}
              options={Array.from({ length: 12 }, (_, i) => {
                const n = i + 1;
                const valorParcela = valorTotal / n;
                return {
                  value: String(n),
                  label: n === 1 ? '1x à vista' : `${n}x de ${fmtBRL(valorParcela)}`,
                };
              })}
              placeholder=""
              hint="A operadora paga o valor cheio em ~30 dias."
            />
          )}
        </div>

        {/* Lead vinculado */}
        <Combobox
          size="lg"
          label={itensComDevolucao.length > 0 ? 'Cliente' : 'Cliente (opcional)'}
          value={form.leadId}
          onChange={(id) => setForm({ ...form, leadId: id })}
          placeholder="Sem cliente vinculado"
          options={leads.map((l) => ({ value: l.id, label: l.nome, sublabel: l.telefone || l.email }))}
          clearable
          hint={
            itensComDevolucao.length > 0
              ? 'Item com devolução precisa de um cliente identificado. Selecione um já cadastrado, ou preencha os dados abaixo.'
              : 'Vincule a venda a um lead pra trilha no CRM.'
          }
        />

        {/* Dados do cliente final digitados na hora — so aparece quando ha
            item com devolucao e nenhum cliente do CRM foi selecionado acima.
            O backend cria (ou reaproveita, por cpf/telefone) um Lead de
            verdade a partir desses dados. */}
        {precisaClienteFinal && (
          <div className="p-4 rounded-xl border border-[var(--warning-soft)] bg-[var(--warning-soft)]/20 space-y-3">
            <div className="text-xs font-semibold text-[var(--warning-text)]">
              Quem está alugando? Precisamos pra avisar sobre a devolução.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                size="sm"
                label="Nome"
                value={clienteFinal.nome}
                onChange={(e) => setClienteFinal({ ...clienteFinal, nome: e.target.value })}
                required
              />
              <Input
                size="sm"
                label="Telefone"
                value={clienteFinal.telefone}
                onChange={(e) => setClienteFinal({ ...clienteFinal, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
                required
              />
              <Input
                size="sm"
                label="CPF"
                value={clienteFinal.cpf}
                onChange={(e) => setClienteFinal({ ...clienteFinal, cpf: e.target.value })}
                placeholder="000.000.000-00"
                required
              />
            </div>
          </div>
        )}

        <Textarea
          size="lg"
          label="Observações"
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          rows={2}
          placeholder="Anotações sobre a venda (opcional)"
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit" disabled={itens.length === 0}>
            Registrar venda ({fmtBRL(valorTotal)})
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerVenda({ isOpen, onClose, venda, onCancelar, onVincularLead, onIrParaCRM }) {
  if (!venda) return null;

  const cancelada = venda.status === 'CANCELLED';
  const cfgStatus = STATUS_BADGE[venda.status] || { variant: 'neutral', label: venda.status || '—' };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Venda · ${fmtBRL(venda.valor)}`}
      description={venda.descricao}
      size="md"
      footer={
        <div className="flex justify-between items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={UserPlus}
            onClick={() => onVincularLead?.(venda)}
          >
            {venda.lead ? 'Trocar cliente' : 'Vincular cliente'}
          </Button>
          {!cancelada && onCancelar ? (
            <Button
              variant="danger-soft"
              icon={Ban}
              size="sm"
              onClick={() => onCancelar(venda)}
            >
              Cancelar venda
            </Button>
          ) : <span />}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="text-center py-4">
          <div className={`text-4xl font-semibold tracking-tight tabular-nums ${cancelada ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
            {fmtBRL(venda.valor)}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-2">
            {new Date(venda.criadoEm).toLocaleString('pt-BR')}
          </div>
          <div className="mt-2">
            <Badge variant={cfgStatus.variant} size="sm">{cfgStatus.label}</Badge>
          </div>
        </div>

        {cancelada && (
          <div className="rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--danger-text)] mb-1">
              Cancelada
            </div>
            {venda.dataCancelamento && (
              <div className="text-xs text-[var(--danger-text)]">
                em {new Date(venda.dataCancelamento).toLocaleString('pt-BR')}
              </div>
            )}
            {venda.motivoCancelamento && (
              <div className="text-xs text-[var(--danger-text)] mt-1 italic">
                "{venda.motivoCancelamento}"
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Pagamento" valor={venda.metodoPagamento || '—'} />
          <InfoBox label="Status" valor={cfgStatus.label} />
          <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Cliente</div>
            {venda.lead ? (
              <button
                type="button"
                onClick={() => onIrParaCRM?.(venda.leadId)}
                className="text-sm font-semibold text-[var(--text-main)] hover:underline mt-0.5 inline-flex items-center gap-1 text-left"
              >
                {venda.lead.nome}
                <ExternalLink size={11} className="text-[var(--text-muted)]" />
              </button>
            ) : (
              <div className="text-sm font-semibold text-[var(--text-muted)] mt-0.5">—</div>
            )}
          </div>
          <InfoBox label="Itens" valor={`${venda.movimentacoesEstoque?.length || 0}`} />
        </div>

        {venda.movimentacoesEstoque?.length > 0 && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Itens vendidos</div>
            <div className="space-y-2">
              {venda.movimentacoesEstoque.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-main)]">
                  <Package size={16} className="text-[var(--text-muted)]" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">
                      {m.variacao?.produto?.nome} · {m.variacao?.nome}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[var(--text-main)]">
                    {Math.abs(m.quantidade)} un.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {venda.lancamentosFinanceiros?.length > 0 && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Lancamento financeiro</div>
            {venda.lancamentosFinanceiros.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-main)]">
                <div className="text-sm text-[var(--text-secondary)]">{l.descricao}</div>
                <Badge variant="success" size="sm">{l.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function InfoBox({ label, valor }) {
  return (
    <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--text-main)] mt-0.5">{valor}</div>
    </div>
  );
}

// =====================================================================
// MODAL "CAIXA FECHADO"
// =====================================================================
// Backend rejeita venda manual sem caixa aberto (codigo CAIXA_FECHADO).
// Em vez de toast generico, mostra dialogo amigavel com 1 click pra abrir
// caixa diretamente — UX reduz friccao.
function ModalCaixaFechado({ isOpen, onClose, onIrParaCaixa }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Abra o caixa antes" description="Pra registrar uma venda manual, o caixa precisa estar aberto." size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
          <Wallet size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Por que isso?</strong> O caixa registra o saldo do dia (fundo + vendas + retiradas + entradas). Sem ele, não dá para controlar o que entra e sai do caixa físico.
          </div>
        </div>

        <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Clique abaixo pra ir direto à tela do Caixa. Lá você informa o fundo de caixa (dinheiro inicial pro troco) e já pode voltar e registrar a venda.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          <Button variant="primary" icon={Wallet} onClick={onIrParaCaixa}>Abrir caixa agora</Button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// MODAL DE CANCELAMENTO DE VENDA
// =====================================================================
// Motivo OBRIGATORIO (min 5 chars) — preserva auditoria. Sem rastro, qualquer
// um cancela venda sem responsabilidade. Backend tambem valida (422).
//
// Avisa o usuario do impacto: estorno de estoque + cancelamento de lancamento
// financeiro. Tudo numa transacao no backend, mas a UI deixa claro.
function ModalCancelarVenda({ isOpen, onClose, venda, onConfirmar }) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setSalvando(false);
    }
  }, [isOpen]);

  if (!venda) return null;

  const motivoValido = motivo.trim().length >= 5;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motivoValido) return;
    setSalvando(true);
    try {
      await onConfirmar(motivo.trim());
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cancelar venda · ${fmtBRL(venda.valor)}`}
      description={`Venda #${venda.numero ?? venda.id?.slice(0, 8)}${venda.descricao ? ` — ${venda.descricao}` : ''}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
          <Ban size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Atenção:</strong> ao cancelar, o sistema vai:
            <ul className="list-disc list-inside mt-1 space-y-0.5 opacity-90">
              <li>Estornar a quantidade vendida pro estoque</li>
              <li>Cancelar o lançamento financeiro vinculado</li>
              <li>Marcar a venda como CANCELADA (não apaga — fica no histórico)</li>
            </ul>
          </div>
        </div>

        <Textarea
          size="lg"
          label="Por que está cancelando?"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ex.: Cliente desistiu, produto enviado errado, duplicidade..."
          autoFocus
          required
          hint={
            motivo.length === 0
              ? 'Obrigatório. Mínimo 5 caracteres.'
              : motivo.trim().length < 5
                ? `Faltam ${5 - motivo.trim().length} caractere(s).`
                : '✓ Motivo válido'
          }
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={salvando}>Voltar</Button>
          <Button variant="danger" type="submit" icon={Ban} disabled={!motivoValido || salvando}>
            {salvando ? 'Cancelando...' : 'Confirmar cancelamento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// MODAL DE VINCULO DE CLIENTE (retroativo)
// =====================================================================
// Combobox pra escolher o lead. Suporta desvinculo (botao "Remover cliente"
// quando a venda ja tem um vinculado). Backend propaga pros lancamentos
// financeiros vinculados pra manter consistencia de relatorios.
function ModalVincularLead({ isOpen, onClose, venda, leads, onConfirmar }) {
  const [leadId, setLeadId] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLeadId(venda?.leadId || '');
      setSalvando(false);
    }
  }, [isOpen, venda]);

  if (!venda) return null;

  const jaTemLead = !!venda.leadId;

  const handleConfirmar = async (idEscolhido) => {
    if (salvando) return;
    setSalvando(true);
    try {
      await onConfirmar(idEscolhido || null);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={jaTemLead ? 'Trocar cliente da venda' : 'Vincular cliente a venda'}
      description={`Venda #${venda.numero ?? venda.id?.slice(0, 8)} · ${fmtBRL(venda.valor)}`}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
          <UserPlus size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
          <div className="text-xs leading-relaxed">
            Vincular um cliente preserva auditoria no CRM e propaga pro
            lançamento financeiro da venda. Útil quando a venda foi feita
            sem identificar o cliente.
          </div>
        </div>

        <Combobox
          size="lg"
          label="Cliente"
          value={leadId}
          onChange={(id) => setLeadId(id)}
          placeholder="Buscar por nome ou telefone..."
          options={leads.map((l) => ({ value: l.id, label: l.nome, sublabel: l.telefone || l.email }))}
          clearable
        />

        <div className="flex justify-between gap-2 pt-2">
          {jaTemLead ? (
            <Button
              variant="danger-soft"
              size="sm"
              type="button"
              onClick={() => handleConfirmar(null)}
              disabled={salvando}
            >
              Remover cliente
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={() => handleConfirmar(leadId)}
              disabled={!leadId || leadId === venda.leadId || salvando}
            >
              {salvando ? 'Salvando...' : 'Vincular'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
