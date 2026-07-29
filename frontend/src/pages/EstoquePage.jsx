import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, TrendingUp,
  Plus, Edit2, Trash2, MoreHorizontal, Activity, Tag, Image as ImageIcon, ArrowLeftRight,
  HelpCircle,
} from 'lucide-react';
import api from '../services/api';
import {
  Card, CardHeader, CardTitle, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, useToast, Tabs, TabsList, TabsTrigger, TabsContent,
  Dropdown, DropdownItem, DropdownDivider, UploadImagem, InputDuracao,
  KpiCard, Tooltip, Switch,
} from '../components/ui';
import Modal from '../components/Modal';
import catalogoService from '../services/catalogoService';

// Mapeia o slug da URL pro `value` da Tab interna do componente.
// O TabsList nao e mais visivel — a navegacao acontece via sidebar.
// Mantemos o componente Tabs/TabsContent porque ja existe e seleciona o
// conteudo pela prop `value`.
const SLUG_PARA_TAB = {
  'visao-geral': 'dashboard',
  'produtos': 'estoque',
  'movimentacoes': 'movimentacoes',
  'reposicao': 'reposicao',
  'categorias': 'categorias',
};
const TITULOS_ABA = {
  'visao-geral': { titulo: 'Visão geral', descricao: 'Patrimônio, ruptura e alertas do seu estoque.' },
  'produtos': { titulo: 'Produtos', descricao: 'Listagem completa com estoque, custos e ações rápidas.' },
  'movimentacoes': { titulo: 'Movimentações', descricao: 'Histórico de entradas, saídas e ajustes.' },
  'reposicao': { titulo: 'Reposição', descricao: 'Produtos abaixo do mínimo — fila pra compra.' },
  'categorias': { titulo: 'Categorias', descricao: 'Agrupamentos de produtos por categoria financeira.' },
};

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_MOV_LABELS = {
  COMPRA_FORNECEDOR: { label: 'Compra', variant: 'info', sentido: 'in' },
  VENDA: { label: 'Venda', variant: 'success', sentido: 'out' },
  AJUSTE: { label: 'Ajuste', variant: 'warning', sentido: 'in' },
  DEVOLUCAO: { label: 'Devolucao', variant: 'neutral', sentido: 'in' },
  RESERVA: { label: 'Reserva', variant: 'neutral', sentido: 'out' },
};

export default function EstoquePage() {
  const toast = useToast();
  const { aba } = useParams();
  const navigate = useNavigate();
  const tab = SLUG_PARA_TAB[aba] || 'dashboard';
  const tituloAba = TITULOS_ABA[aba] || TITULOS_ABA['visao-geral'];
  const [stats, setStats] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [reposicao, setReposicao] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  const [modalMov, setModalMov] = useState({ open: false });
  const [modalProduto, setModalProduto] = useState({ open: false, data: null });
  const [modalEditarVar, setModalEditarVar] = useState({ open: false, variacao: null });
  const [modalCategoria, setModalCategoria] = useState({ open: false, data: null });

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [s, m, r, p, c] = await Promise.all([
        api.get('/estoque/dashboard').catch(() => ({ data: null })),
        api.get('/estoque/movimentacoes').catch(() => ({ data: [] })),
        api.get('/estoque/reposicao').catch(() => ({ data: [] })),
        api.get('/catalogo').catch(() => ({ data: [] })),
        api.get('/financeiro/categorias?uso=PRODUTO').catch(() => ({ data: [] })),
      ]);
      setStats(s.data);
      setMovimentacoes(m.data || []);
      setReposicao(r.data || []);
      // Estoque so lista produtos FISICOS. Servicos sao gerenciados no Catalogo.
      // Filtro local pra blindar contra dados legados/criados por outras vias
      // (ex: bot) — backend continua retornando tudo do tenant.
      setProdutos((p.data || []).filter((prod) => prod.tipo === 'FISICO'));
      setCategorias(c.data || []);
    } finally {
      setCarregando(false);
    }
  };

  // Categorias do estoque = categorias financeiras de tipo RECEITA (produtos vendidos viram receita)
  const categoriasProdutos = useMemo(
    () => categorias.filter((c) => c.tipo === 'RECEITA'),
    [categorias]
  );

  const variacoesFlat = useMemo(() => {
    const out = [];
    produtos.forEach((p) => {
      (p.variacoes || []).forEach((v) => out.push({ ...v, produto: p }));
    });
    return out;
  }, [produtos]);

  const variacoesFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return variacoesFlat;
    return variacoesFlat.filter(
      (v) => v.nome?.toLowerCase().includes(q) ||
             v.produto?.nome?.toLowerCase().includes(q) ||
             v.sku?.toLowerCase().includes(q)
    );
  }, [variacoesFlat, busca]);

  // Filtros pra as outras abas — todos usam o mesmo `busca` global pra
  // simplificar (a SearchBar fica no header, compartilhada).
  const movimentacoesFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return movimentacoes;
    return movimentacoes.filter((m) =>
      m.variacao?.produto?.nome?.toLowerCase().includes(q) ||
      m.variacao?.nome?.toLowerCase().includes(q) ||
      m.observacao?.toLowerCase().includes(q)
    );
  }, [movimentacoes, busca]);

  const reposicaoFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return reposicao;
    return reposicao.filter((r) =>
      r.produto?.toLowerCase().includes(q) ||
      r.variacao?.toLowerCase().includes(q)
    );
  }, [reposicao, busca]);

  const categoriasFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return categoriasProdutos;
    return categoriasProdutos.filter((c) => c.nome?.toLowerCase().includes(q));
  }, [categoriasProdutos, busca]);

  const handleMovimentar = async (dados) => {
    try {
      await api.post('/estoque/movimentar', dados);
      toast.success('Movimentacao registrada');
      setModalMov({ open: false });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao movimentar');
    }
  };

  const handleSalvarProduto = async (dados) => {
    try {
      // Cria produto + variacao em sequencia (uma chamada de catalogo POST com variacoes inline)
      await api.post('/catalogo', dados);
      toast.success('Produto criado');
      setModalProduto({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao criar produto');
    }
  };

  const handleSalvarCategoria = async (dados) => {
    try {
      if (dados.id) {
        await api.patch(`/financeiro/categorias/${dados.id}`, dados);
        toast.success('Categoria atualizada');
      } else {
        await api.post('/financeiro/categorias', { ...dados, tipo: 'RECEITA', uso: 'PRODUTO' });
        toast.success('Categoria criada');
      }
      setModalCategoria({ open: false, data: null });
      carregar();
    } catch {
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleExcluirCategoria = async (c) => {
    if (!confirm(`Excluir categoria "${c.nome}"?`)) return;
    try {
      await api.delete(`/financeiro/categorias/${c.id}`);
      toast.success('Categoria excluida');
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header — titulo dinamico vindo da sub-rota + acoes */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
            Estoque
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-1">
            {tituloAba.titulo}
            {tab === 'reposicao' && reposicao.length > 0 && (
              <span className="ml-2 text-base font-semibold text-[var(--warning)] tabular-nums">({reposicao.length})</span>
            )}
            {tab === 'categorias' && categoriasProdutos.length > 0 && (
              <span className="ml-2 text-base font-semibold text-[var(--text-muted)] tabular-nums">({categoriasProdutos.length})</span>
            )}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{tituloAba.descricao}</p>
        </div>
        {/* Botoes condicionais por aba — cada tela so mostra o que cabe.
            Visao geral nao tem botao de cadastro (e dashboard, nao cadastro). */}
        <div className="flex flex-wrap gap-2">
          {tab === 'estoque' && (
            <Button variant="primary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>
              Novo produto
            </Button>
          )}
          {tab === 'movimentacoes' && (
            <Button variant="primary" icon={Plus} onClick={() => setModalMov({ open: true })}>
              Nova movimentação
            </Button>
          )}
          {tab === 'categorias' && (
            <Button variant="primary" icon={Plus} onClick={() => setModalCategoria({ open: true, data: null })}>
              Nova categoria
            </Button>
          )}
          {/* Reposicao: sem botao no header — cada item tem '3 pontinhos'
              com acao 'Repor agora' (abre movimentacao prefilada).
              Visao geral: sem botao de cadastro. */}
        </div>
      </div>

      {/* Barra de busca condicional — todas as abas tem (exceto Visao geral).
          Placeholder muda pelo contexto. */}
      {tab !== 'dashboard' && (
        <div className="max-w-md">
          <SearchBar
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              tab === 'estoque'        ? 'Buscar produto, variação, SKU...' :
              tab === 'movimentacoes'  ? 'Buscar por produto ou observação...' :
              tab === 'reposicao'      ? 'Buscar produto pra repor...' :
              tab === 'categorias'     ? 'Buscar categoria...' :
              'Buscar...'
            }
          />
        </div>
      )}

      <Tabs value={tab}>
        <TabsContent value="dashboard">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <KpiCard icon={TrendingUp} color="accent" label="Valor inventario" valor={stats ? fmtBRL(stats.valorTotalInventario) : '—'} />
            <KpiCard icon={Box} color="info" label="Total variacoes" valor={stats?.totalProdutos ?? '—'} />
            <KpiCard icon={AlertTriangle} color={stats?.itensAbaixoMinimo > 0 ? 'warning' : 'neutral'} label="Abaixo do minimo" valor={stats?.itensAbaixoMinimo ?? '—'} />
            <KpiCard icon={Activity} color={(stats?.indiceRuptura || 0) > 5 ? 'danger' : 'neutral'} label="Indice ruptura" valor={stats ? `${stats.indiceRuptura}%` : '—'} />
          </div>

          <Card padding="lg">
            <CardHeader>
              <div><CardTitle>Movimentacoes recentes</CardTitle></div>
            </CardHeader>
            {movimentacoes.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Nenhuma movimentacao" description="Registre entradas e saidas." />
            ) : (
              <ListaMovimentacoes movimentacoes={movimentacoes.slice(0, 10)} />
            )}
          </Card>
        </TabsContent>

        {/* Produtos — SearchBar foi promovida pro header (compartilhada). */}
        <TabsContent value="estoque">
          {variacoesFiltered.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Box}
                title="Nenhum produto"
                description="Cadastre seus produtos pra controlar estoque."
                action={<Button variant="primary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>Novo produto</Button>}
              />
            </Card>
          ) : (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-main)]">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-28"></th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Categoria</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Variacao / SKU</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Estoque</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Custo</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Venda</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Lucro</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor total</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {variacoesFiltered.map((v) => {
                    const abaixo = v.estoqueAtual < (v.estoqueMinimo || 0);
                    const cat = categorias.find((c) => c.id === v.produto?.categoriaId);
                    const imagemUrl = v.imagemUrl || v.produto?.imagemUrl;
                    return (
                      <tr key={v.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50">
                        {/* Foto reduzida pra w-14 h-14 (era w-24 = exagerado) */}
                        <td className="py-3 px-5">
                          {imagemUrl ? (
                            <img
                              src={imagemUrl}
                              alt=""
                              className="w-14 h-14 object-contain"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)] tracking-tight">{v.produto?.nome}</td>
                        <td className="py-3 px-5 text-xs">{cat ? <Badge variant="neutral" size="sm">{cat.nome}</Badge> : '—'}</td>
                        <td className="py-3 px-5 text-xs">
                          <div className="text-[var(--text-secondary)]">{v.nome}</div>
                          {v.sku && <div className="text-[var(--text-muted)]">SKU: {v.sku}</div>}
                        </td>
                        <td className={`py-3 px-5 text-right text-sm font-semibold tabular-nums ${abaixo ? 'text-[var(--danger)]' : 'text-[var(--text-main)]'}`}>
                          {v.estoqueAtual}
                          {abaixo && <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />}
                        </td>
                        <td className="py-3 px-5 text-right text-sm text-[var(--text-secondary)] tabular-nums">{fmtBRL(v.precoCusto)}</td>
                        <td className="py-3 px-5 text-right text-sm text-[var(--text-main)] tabular-nums">{fmtBRL(v.preco)}</td>
                        <td className="py-3 px-5 text-right text-sm text-[var(--success)] tabular-nums">{fmtBRL((v.preco || 0) - (v.precoCusto || 0))}</td>
                        <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(v.estoqueAtual * (v.precoCusto || 0))}</td>
                        <td className="py-3 px-5 text-right">
                          <Dropdown trigger={<IconButton icon={MoreHorizontal} size="sm" variant="ghost" ariaLabel="Ações" />} align="right">
                            <DropdownItem
                              icon={ArrowLeftRight}
                              onClick={() => setModalMov({ open: true, variacaoIdInicial: v.id })}
                            >
                              Nova movimentação
                            </DropdownItem>
                            <DropdownItem
                              icon={Edit2}
                              onClick={() => setModalEditarVar({ open: true, variacao: v })}
                            >
                              Editar produto
                            </DropdownItem>
                            {cat && (
                              <>
                                <DropdownDivider />
                                <DropdownItem
                                  icon={Tag}
                                  onClick={() => {
                                    setBusca(cat.nome);
                                    navigate('/app/estoque/categorias');
                                  }}
                                >
                                  Ver categoria
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
            </Card>
          )}
        </TabsContent>

        {/* Movimentacoes */}
        <TabsContent value="movimentacoes">
          {movimentacoesFiltered.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={TrendingUp}
                title={busca ? 'Nenhuma movimentação encontrada' : 'Nenhuma movimentação'}
                description={busca ? 'Tente outro termo.' : 'Registre entradas e saídas pra rastrear o estoque.'}
                action={!busca && (
                  <Button variant="primary" icon={Plus} onClick={() => setModalMov({ open: true })}>
                    Nova movimentação
                  </Button>
                )}
              />
            </Card>
          ) : (
            <Card padding="none">
              <ListaMovimentacoes
                movimentacoes={movimentacoesFiltered}
                onVerProduto={(nome) => {
                  // Hyperlink cruzado: leva pra aba Produtos ja filtrando pelo nome.
                  setBusca(nome);
                  navigate('/app/estoque/produtos');
                }}
              />
            </Card>
          )}
        </TabsContent>

        {/* Reposicao */}
        <TabsContent value="reposicao">
          {reposicaoFiltered.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={AlertTriangle}
                title={busca ? 'Nenhum produto encontrado' : 'Nada para repor'}
                description={busca ? 'Tente outro termo.' : 'Tudo acima do mínimo. Você está em dia.'}
              />
            </Card>
          ) : (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-main)]">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-20"></th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto / Variação</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Atual</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Min</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Ideal</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Repor</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Urgência</th>
                    <th className="w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {reposicaoFiltered.map((r) => {
                    const ehVarPadrao = !r.variacao || r.variacao === 'Padrão' || r.variacao === 'Padrao';
                    return (
                      <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50">
                        {/* Foto menor (w-14 h-14) — antes era w-24 h-24 e tava enorme */}
                        <td className="py-3 px-5">
                          {r.imagemUrl ? (
                            <img
                              src={r.imagemUrl}
                              alt=""
                              className="w-14 h-14 object-contain"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5">
                          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{r.produto}</div>
                          {!ehVarPadrao && <div className="text-xs text-[var(--text-muted)]">{r.variacao}</div>}
                        </td>
                        <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums text-[var(--danger)]">{r.estoqueAtual}</td>
                        <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-muted)]">{r.estoqueMinimo || 0}</td>
                        <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-muted)]">{r.estoqueIdeal || 0}</td>
                        <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums text-[var(--text-main)]">{r.necessidade}</td>
                        <td className="py-3 px-5"><Badge variant={r.urgencia === 'ALTA' ? 'danger' : 'warning'} size="sm">{r.urgencia}</Badge></td>
                        {/* Botao 'Repor' direto + 3 pontinhos pra acoes secundarias.
                            Como toda a tela e sobre repor, a acao principal fica
                            visivel sem precisar abrir dropdown. */}
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="primary"
                              size="sm"
                              icon={ArrowDownToLine}
                              onClick={() => setModalMov({
                                open: true,
                                variacaoIdInicial: r.variacaoId || r.id,
                                quantidadeInicial: r.necessidade,
                                tipoInicial: 'COMPRA_FORNECEDOR',
                              })}
                            >
                              Repor
                            </Button>
                            <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Mais ações" />} align="right">
                              <DropdownItem
                                icon={Box}
                                onClick={() => {
                                  setBusca(r.produto);
                                  navigate('/app/estoque/produtos');
                                }}
                              >
                                Ver produto
                              </DropdownItem>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* Categorias — botao 'Nova categoria' fica no header (condicional). */}
        <TabsContent value="categorias">
          {categoriasFiltered.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Tag}
                title={busca ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria'}
                description={
                  busca
                    ? 'Tente outro termo.'
                    : 'Categorias agrupam seus produtos (ex: Bebidas, Roupas, Cabelo). Vincule cada produto a uma categoria pra organizar relatórios e CMV.'
                }
                action={!busca && (
                  <Button variant="primary" icon={Plus} onClick={() => setModalCategoria({ open: true, data: null })}>
                    Criar primeira categoria
                  </Button>
                )}
              />
            </Card>
          ) : (
            <Card padding="none">
              <div className="divide-y divide-[var(--border-subtle)]">
                {categoriasFiltered.map((c) => {
                  const qtdVariacoes = variacoesFlat.filter((v) => v.produto?.categoriaId === c.id).length;
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-subtle)]/50">
                      {/* Icone reduzido (w-10 h-10) — alinhado com o padrao das
                          outras telas (movimentacoes/reposicao usam w-14 pra foto
                          e w-8 pra badges). Aqui meio termo. */}
                      <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                        <Tag size={16} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">{c.nome}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {qtdVariacoes} {qtdVariacoes === 1 ? 'variação vinculada' : 'variações vinculadas'}
                        </div>
                      </div>
                      <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Ações" />} align="right">
                        <DropdownItem icon={Edit2} onClick={() => setModalCategoria({ open: true, data: c })}>Editar</DropdownItem>
                        <DropdownDivider />
                        <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluirCategoria(c)}>Excluir</DropdownItem>
                      </Dropdown>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ModalMovimentacao
        isOpen={modalMov.open}
        onClose={() => setModalMov({ open: false })}
        variacoes={variacoesFlat}
        onSalvar={handleMovimentar}
        variacaoIdInicial={modalMov.variacaoIdInicial}
        quantidadeInicial={modalMov.quantidadeInicial}
        tipoInicial={modalMov.tipoInicial}
      />
      <ModalEditarVariacao
        isOpen={modalEditarVar.open}
        onClose={() => setModalEditarVar({ open: false, variacao: null })}
        variacao={modalEditarVar.variacao}
        onSucesso={() => {
          carregar();
          setModalEditarVar({ open: false, variacao: null });
        }}
      />
      <ModalProduto
        isOpen={modalProduto.open}
        onClose={() => setModalProduto({ open: false, data: null })}
        categorias={categoriasProdutos}
        onSalvar={handleSalvarProduto}
      />
      <ModalCategoria
        isOpen={modalCategoria.open}
        onClose={() => setModalCategoria({ open: false, data: null })}
        cat={modalCategoria.data}
        onSalvar={handleSalvarCategoria}
      />
    </div>
  );
}

// Limpa o motivo gravado em movimentacoes antigas que tinham UUID no texto.
// Pra registros novos o backend ja grava com `Venda #<numero>` (humano).
// Aqui usamos o `m.venda.numero` quando disponivel pra ter consistencia
// mesmo em movimentacoes antigas (que tem UUID gravado no motivo).
function formatarMotivoMov(m) {
  if (m.vendaId) {
    const numero = m.venda?.numero;
    const sufixo = numero ? ` #${numero}` : '';
    if (m.tipo === 'DEVOLUCAO') return `Cancelamento da venda${sufixo}`;
    if (m.tipo === 'VENDA') return `Venda${sufixo}`;
  }
  if (!m.motivo) return 'Sem motivo';
  // Remove UUID se vier no texto (formato "Venda #abc-123-..." ou similar).
  return m.motivo.replace(/#[a-f0-9-]{20,}/gi, '').replace(/\s+—\s*$/, '').trim() || 'Sem motivo';
}

// onVerProduto: callback que filtra a aba Produtos pelo nome (link cruzado).
// Quando nao passado, o 3 pontinhos nao aparece (uso na Visao geral).
function ListaMovimentacoes({ movimentacoes, onVerProduto }) {
  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {movimentacoes.map((m) => {
        const tipo = TIPO_MOV_LABELS[m.tipo] || { label: m.tipo, variant: 'neutral', sentido: 'in' };
        const Icon = tipo.sentido === 'in' ? ArrowDownToLine : ArrowUpFromLine;
        const imagemUrl = m.variacao?.imagemUrl || m.variacao?.produto?.imagemUrl;
        const ehVarPadrao = !m.variacao?.nome || m.variacao.nome === 'Padrão' || m.variacao.nome === 'Padrao';
        const motivoLimpo = formatarMotivoMov(m);
        const nomeProduto = m.variacao?.produto?.nome;
        return (
          <div key={m.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--bg-subtle)]/50">
            {/* Foto reduzida pra w-14 h-14 (era w-24 h-24 = tava enorme) */}
            {imagemUrl ? (
              <img
                src={imagemUrl}
                alt=""
                className="w-14 h-14 object-contain flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0 text-[var(--text-muted)]">
                <ImageIcon size={20} />
              </div>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              tipo.sentido === 'in' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'
            }`}>
              <Icon size={14} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">
                {nomeProduto}{!ehVarPadrao && ` · ${m.variacao?.nome}`}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {motivoLimpo} · {new Date(m.data).toLocaleString('pt-BR')}
              </div>
            </div>
            <Badge variant={tipo.variant} size="sm">{tipo.label}</Badge>
            <div className={`text-base font-bold tabular-nums w-16 text-right ${
              m.quantidade > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}>
              {m.quantidade > 0 ? '+' : ''}{m.quantidade}
            </div>
            {/* 3 pontinhos so quando habilitado (aba Movimentacoes — nao em Visao geral) */}
            {onVerProduto && nomeProduto && (
              <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Ações" />} align="right">
                <DropdownItem
                  icon={Box}
                  onClick={() => onVerProduto(nomeProduto)}
                >
                  Ver no produto
                </DropdownItem>
              </Dropdown>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Tipos de movimentacao expostos no UI. `direcao` controla se a quantidade
// vai virar positiva (entrada) ou negativa (saida) no submit.
// AJUSTE_POSITIVO/NEGATIVO sao "atalhos" do mesmo tipo AJUSTE no backend —
// a direcao e definida pela quantidade gravada (positiva ou negativa).
const TIPOS_MOVIMENTACAO = [
  { value: 'COMPRA_FORNECEDOR', label: 'Compra de fornecedor', sentido: 'in', sublabel: 'entrada', icone: '📦', tipoBackend: 'COMPRA_FORNECEDOR' },
  { value: 'DEVOLUCAO',          label: 'Devolução do cliente', sentido: 'in', sublabel: 'entrada', icone: '↩️', tipoBackend: 'DEVOLUCAO' },
  { value: 'AJUSTE_POSITIVO',    label: 'Ajuste para mais', sentido: 'in', sublabel: 'corrigir contagem', icone: '➕', tipoBackend: 'AJUSTE' },
  { value: 'VENDA',              label: 'Venda manual', sentido: 'out', sublabel: 'saída', icone: '🛒', tipoBackend: 'VENDA' },
  { value: 'AJUSTE_NEGATIVO',    label: 'Ajuste para menos', sentido: 'out', sublabel: 'corrigir contagem (perda/quebra)', icone: '➖', tipoBackend: 'AJUSTE' },
  { value: 'RESERVA',            label: 'Reserva', sentido: 'out', sublabel: 'separar pra cliente', icone: '🔒', tipoBackend: 'RESERVA' },
];

const fmtBRL2 = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ModalMovimentacao({ isOpen, onClose, variacoes, onSalvar, variacaoIdInicial, quantidadeInicial, tipoInicial }) {
  const [form, setForm] = useState({
    variacaoId: '', tipo: 'COMPRA_FORNECEDOR', quantidade: 1, motivo: '',
    precoCusto: '', precoVenda: '',
  });

  useEffect(() => {
    if (isOpen) setForm({
      variacaoId: variacaoIdInicial || '',
      // Quando vem de 'Repor agora' na Reposicao, ja chega prefilado como
      // COMPRA_FORNECEDOR + quantidade sugerida.
      tipo: tipoInicial || 'COMPRA_FORNECEDOR',
      quantidade: quantidadeInicial && quantidadeInicial > 0 ? quantidadeInicial : 1,
      motivo: '', precoCusto: '', precoVenda: ''
    });
  }, [isOpen, variacaoIdInicial, quantidadeInicial, tipoInicial]);

  const variacaoSel = variacoes.find((v) => v.id === form.variacaoId);
  const tipoCfg = TIPOS_MOVIMENTACAO.find((t) => t.value === form.tipo);
  const ehSaida = tipoCfg?.sentido === 'out';
  const ehCompra = form.tipo === 'COMPRA_FORNECEDOR';
  const maxQtd = ehSaida && variacaoSel ? variacaoSel.estoqueAtual : null;

  const qtdNum = Math.max(0, parseInt(form.quantidade, 10) || 0);
  const estoqueAtual = variacaoSel?.estoqueAtual ?? 0;
  const estoqueMinimo = variacaoSel?.estoqueMinimo ?? 0;
  const estoqueDepois = variacaoSel
    ? (ehSaida ? estoqueAtual - qtdNum : estoqueAtual + qtdNum)
    : null;
  const valorTotalCompra = (ehCompra && form.precoCusto && qtdNum > 0)
    ? qtdNum * parseFloat(form.precoCusto)
    : null;

  const estoqueAtualBaixo = variacaoSel && variacaoSel.produto?.tipo === 'FISICO' && estoqueAtual <= estoqueMinimo;
  const estoqueDepoisBaixo = variacaoSel && variacaoSel.produto?.tipo === 'FISICO' && estoqueDepois !== null && estoqueDepois <= estoqueMinimo;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.variacaoId) { alert('Selecione um produto'); return; }
    if (!tipoCfg) { alert('Tipo invalido'); return; }

    let quantidade = parseInt(form.quantidade, 10);
    if (isNaN(quantidade) || quantidade < 1) {
      alert('Quantidade deve ser maior que zero');
      return;
    }

    if (ehSaida) {
      if (maxQtd !== null && quantidade > maxQtd) {
        alert(`Estoque insuficiente. Disponivel: ${maxQtd}`);
        return;
      }
      quantidade = -Math.abs(quantidade);
    } else {
      quantidade = Math.abs(quantidade);
    }

    onSalvar({
      variacaoId: form.variacaoId,
      tipo: tipoCfg.tipoBackend, // mapeia AJUSTE_POSITIVO/NEGATIVO -> AJUSTE
      quantidade,
      motivo: form.motivo,
      precoCusto: form.precoCusto || undefined,
      precoVenda: form.precoVenda || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar movimentação" description="Compra, venda, devolução ou ajuste manual." size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Produto"
          value={form.variacaoId}
          onChange={(e) => setForm({ ...form, variacaoId: e.target.value })}
          placeholder="Selecione um produto..."
          options={variacoes.map((v) => ({
            value: v.id,
            label: `${v.produto?.nome}${v.nome && v.nome !== 'Padrão' && v.nome !== 'Padrao' ? ' · ' + v.nome : ''} (${v.estoqueAtual} em estoque)`
          }))}
          required
        />

        {/* Card de detalhes do produto selecionado */}
        {variacaoSel && (
          <CardProdutoSelecionado
            variacao={variacaoSel}
            estoqueBaixo={estoqueAtualBaixo}
          />
        )}

        <Select
          label="O que aconteceu?"
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          options={TIPOS_MOVIMENTACAO.map((t) => ({
            value: t.value,
            label: `${t.icone} ${t.label} — ${t.sublabel}`,
          }))}
          placeholder=""
        />

        <Input
          label="Quantidade"
          type="number"
          min="1"
          max={maxQtd ?? undefined}
          value={form.quantidade}
          onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
          required
          hint={ehSaida && maxQtd !== null ? `Disponível em estoque: ${maxQtd}` : undefined}
        />

        {/* Preview do impacto */}
        {variacaoSel && qtdNum > 0 && variacaoSel.produto?.tipo === 'FISICO' && (
          <div className={`text-xs px-3 py-2.5 rounded-xl border ${
            estoqueDepoisBaixo
              ? 'bg-[var(--warning-soft)] border-[var(--warning)]/30 text-[var(--warning)]'
              : ehSaida
                ? 'bg-[var(--bg-subtle)] border-[var(--border-main)] text-[var(--text-secondary)]'
                : 'bg-[var(--success-soft)] border-[var(--success)]/30 text-[var(--success)]'
          }`}>
            <strong>Estoque após esta movimentação:</strong>{' '}
            <span className="font-bold tabular-nums">{estoqueDepois}</span> unidades
            {estoqueDepoisBaixo && (
              <span className="ml-2 opacity-80">⚠ abaixo do estoque mínimo ({estoqueMinimo})</span>
            )}
            {valorTotalCompra !== null && (
              <span className="block mt-1">
                <strong>Valor total da compra:</strong> {fmtBRL2(valorTotalCompra)}
              </span>
            )}
          </div>
        )}

        {ehCompra && (
          <div className="border border-[var(--border-main)] rounded-xl p-4 bg-[var(--bg-subtle)]/40 space-y-3">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">
              Atualizar preços (opcional)
            </div>
            <div className="text-[11px] text-[var(--text-muted)] -mt-2">
              Se preencher, atualiza o preço do produto pra próximas vendas/compras.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Novo preço de custo"
                type="number"
                step="0.01"
                min="0"
                value={form.precoCusto}
                onChange={(e) => setForm({ ...form, precoCusto: e.target.value })}
                placeholder={variacaoSel?.precoCusto ? `Atual: ${fmtBRL2(variacaoSel.precoCusto)}` : 'R$ 0,00'}
              />
              <Input
                label="Novo preço de venda"
                type="number"
                step="0.01"
                min="0"
                value={form.precoVenda}
                onChange={(e) => setForm({ ...form, precoVenda: e.target.value })}
                placeholder={variacaoSel?.preco ? `Atual: ${fmtBRL2(variacaoSel.preco)}` : 'R$ 0,00'}
              />
            </div>
          </div>
        )}

        <Textarea
          label="Motivo / observação"
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          rows={2}
          placeholder={
            form.tipo === 'AJUSTE_NEGATIVO' ? 'Ex.: 2 unidades quebradas no manuseio' :
            form.tipo === 'AJUSTE_POSITIVO' ? 'Ex.: contagem física revelou 3 unidades a mais' :
            form.tipo === 'DEVOLUCAO' ? 'Ex.: cliente devolveu por defeito' :
            form.tipo === 'RESERVA' ? 'Ex.: separado pra Maria, retira sexta' :
            'Opcional'
          }
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">Registrar</Button>
        </div>
      </form>
    </Modal>
  );
}

// Modal de edicao rapida da variacao (foto, preco, custo, estoque, sku).
// Usa PUT /catalogo/variacoes/:id ja existente. Imagem usa o endpoint
// definitivo (variacao ja existe). Categoria/tipo do produto pai nao
// sao editaveis aqui — pra isso o cliente vai na tela de Catalogo.
// Calcula o preco de venda a partir do custo + lucro. VALOR = R$ fixo somado ao
// custo; PERCENTUAL = % sobre o custo. Em sync com o backend (CatalogoController).
function calcularPrecoVenda(custo, lucroTipo, lucroValor) {
  const c = parseFloat(custo) || 0;
  const l = parseFloat(lucroValor) || 0;
  const bruto = lucroTipo === 'PERCENTUAL' ? c * (1 + l / 100) : c + l;
  return Math.round(bruto * 100) / 100;
}

// Rotulo de campo com a explicacao escondida num icone de ajuda (?) logo ao
// lado do texto. Mantem o formulario limpo: a dica aparece no tooltip, nao
// embaixo do campo. Passe o retorno na prop `label` do Input (e remova o `hint`).
function rotuloAjuda(texto, ajuda) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{texto}</span>
      {ajuda && (
        <Tooltip content={ajuda} position="top">
          <HelpCircle
            size={15}
            strokeWidth={2}
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-help"
          />
        </Tooltip>
      )}
    </span>
  );
}

// Bloco de precificacao: o usuario digita o CUSTO e o LUCRO (R$ ou %), e o
// PRECO DE VENDA aparece calculado (custo + lucro). Quando o custo mudar (nota),
// o lucro fica e o preco recalcula sozinho. Usado nos forms de criar e editar.
function CampoCustoLucro({ form, setForm }) {
  const lucroTipo = form.lucroTipo === 'PERCENTUAL' ? 'PERCENTUAL' : 'VALOR';
  const preco = calcularPrecoVenda(form.precoCusto, lucroTipo, form.lucroValor);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Input
        size="lg"
        label={rotuloAjuda('Quanto você pagou (R$)', 'O custo de cada unidade — o quanto você gastou pra comprar ou produzir.')}
        type="number"
        step="0.01"
        min="0"
        value={form.precoCusto}
        onChange={(e) => setForm({ ...form, precoCusto: e.target.value })}
      />
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          <span>Seu lucro</span>
          <Tooltip content="Quanto você ganha em cima do custo. Escolha R$ (valor fixo) ou % do custo." position="top">
            <HelpCircle size={15} strokeWidth={2} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-help" />
          </Tooltip>
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.lucroValor ?? ''}
            onChange={(e) => setForm({ ...form, lucroValor: e.target.value })}
            className="flex-1 min-w-0 h-12 px-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-main)] focus:outline-none focus:border-[var(--border-strong)]"
          />
          <div className="flex rounded-lg border border-[var(--border-main)] overflow-hidden flex-shrink-0">
            {['VALOR', 'PERCENTUAL'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, lucroTipo: t })}
                className={`px-3.5 text-sm font-medium transition-colors ${lucroTipo === t ? 'bg-[var(--primary)] text-[var(--text-on-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'}`}
              >
                {t === 'VALOR' ? 'R$' : '%'}
              </button>
            ))}
          </div>
        </div>      </div>
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          <span>Preço de venda</span>
          <Tooltip content="Custo + lucro. É o valor que o cliente paga. Calculado automaticamente." position="top">
            <HelpCircle size={15} strokeWidth={2} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-help" />
          </Tooltip>
        </label>
        <div className="h-12 px-4 flex items-center rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-main)] font-semibold tabular-nums">
          {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </div>      </div>
    </div>
  );
}

// Aluguel/devolucao — so faz sentido pra produto fisico (Estoque cadastra so
// FISICO, entao nao precisa checar tipo aqui). Quando ligado, a venda desse
// produto exige data de devolucao + cliente identificado.
function BlocoDevolucao({ form, setForm }) {
  return (
    <div className="border-t border-[var(--border-main)] pt-5">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          {rotuloAjuda('Este produto é alugado?', 'Ative quando o cliente leva o produto emprestado e precisa devolver depois — o sistema vai pedir a data de devolução na venda e avisar quando ela chegar perto.')}
        </label>
        <Switch
          checked={form.temDevolucao}
          onChange={(v) => setForm({ ...form, temDevolucao: v, diasParaDevolucaoPadrao: v ? form.diasParaDevolucaoPadrao : '' })}
          ariaLabel="Este produto é alugado"
        />
      </div>
      {form.temDevolucao && (
        <div className="mt-3 max-w-xs">
          <Input
            label={rotuloAjuda('Prazo padrão (dias)', 'Quantos dias depois da venda o produto costuma voltar. Sugestão pro funcionário — ele pode ajustar a data exata em cada venda. Deixe em branco pra sempre escolher a data na hora.')}
            type="number"
            min="1"
            value={form.diasParaDevolucaoPadrao}
            onChange={(e) => setForm({ ...form, diasParaDevolucaoPadrao: e.target.value })}
            placeholder="Ex: 3"
          />
        </div>
      )}
    </div>
  );
}

function ModalEditarVariacao({ isOpen, onClose, variacao, onSucesso }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: '', sku: '', preco: 0, precoCusto: 0, lucroTipo: 'VALOR', lucroValor: 0,
    estoqueAtual: 0, estoqueMinimo: 0, estoqueIdeal: 0,
    imagemUrl: '', temDevolucao: false, diasParaDevolucaoPadrao: '',
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen && variacao) {
      setForm({
        nome: variacao.nome || '',
        sku: variacao.sku || '',
        preco: variacao.preco ?? 0,
        precoCusto: variacao.precoCusto ?? 0,
        lucroTipo: variacao.lucroTipo || 'VALOR',
        lucroValor: variacao.lucroValor ?? 0,
        estoqueAtual: variacao.estoqueAtual ?? 0,
        estoqueMinimo: variacao.estoqueMinimo ?? 0,
        estoqueIdeal: variacao.estoqueIdeal ?? 0,
        // Fallback visual pra imagem do produto quando a variacao nao tem
        // imagem propria (mesma logica da tabela). Upload novo sobrescreve
        // na variacao; o produto fica intacto.
        imagemUrl: variacao.imagemUrl || variacao.produto?.imagemUrl || '',
        temDevolucao: variacao.produto?.temDevolucao ?? false,
        diasParaDevolucaoPadrao: variacao.produto?.diasParaDevolucaoPadrao ?? '',
      });
    }
  }, [isOpen, variacao]);

  if (!variacao) return null;

  const handleUploadImagem = async (file) => {
    const url = await catalogoService.uploadImagemVariacao(variacao.id, file);
    setForm((prev) => ({ ...prev, imagemUrl: url }));
  };

  const handleRemoverImagem = async () => {
    await catalogoService.removerImagemVariacao(variacao.id);
    setForm((prev) => ({ ...prev, imagemUrl: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await Promise.all([
        api.put(`/catalogo/variacoes/${variacao.id}`, {
          nome: form.nome,
          sku: form.sku || null,
          precoCusto: parseFloat(form.precoCusto) || 0,
          lucroTipo: form.lucroTipo || 'VALOR',
          lucroValor: parseFloat(form.lucroValor) || 0,
          preco: calcularPrecoVenda(form.precoCusto, form.lucroTipo, form.lucroValor),
          estoqueAtual: parseInt(form.estoqueAtual, 10) || 0,
          estoqueMinimo: parseInt(form.estoqueMinimo, 10) || 0,
          estoqueIdeal: parseInt(form.estoqueIdeal, 10) || 0,
        }),
        // Aluguel/devolucao vive no produto (nao na variacao) — atualiza em
        // paralelo via a mesma rota do Catalogo.
        catalogoService.atualizar(variacao.produtoId, {
          temDevolucao: form.temDevolucao,
          diasParaDevolucaoPadrao: form.temDevolucao && form.diasParaDevolucaoPadrao !== ''
            ? parseInt(form.diasParaDevolucaoPadrao, 10) || null
            : null,
        }),
      ]);
      toast.success?.('Produto atualizado.');
      onSucesso?.();
    } catch (err) {
      toast.error?.(err?.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar produto" description={variacao.produto?.nome} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-4">
          <UploadImagem
            imagemUrl={form.imagemUrl || null}
            onUpload={handleUploadImagem}
            onRemover={handleRemoverImagem}
            tamanho="md"
          />
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={rotuloAjuda('Versão / Modelo', "Deixe 'Padrão' se o produto não tem versões.")}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
            <Input
              label="Código interno (SKU)"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="Opcional"
            />
          </div>
        </div>

        <CampoCustoLucro form={form} setForm={setForm} />

        {/* Estoque so lida com FISICO — campos de quantidade sempre visiveis,
            sem condicional. Duracao (servicos) e cadastrada no Catalogo. */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label={rotuloAjuda('Estoque atual', 'A quantidade que está disponível na loja agora.')}
            type="number"
            min="0"
            value={form.estoqueAtual}
            onChange={(e) => setForm({ ...form, estoqueAtual: e.target.value })}
          />
          <Input
            label={rotuloAjuda('Estoque mínimo', 'Quando chegar nessa quantidade, o sistema avisa que está acabando.')}
            type="number"
            min="0"
            value={form.estoqueMinimo}
            onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
          />
          <Input
            label={rotuloAjuda('Estoque ideal', 'Quando precisar repor, é essa quantidade que você compra.')}
            type="number"
            min="0"
            value={form.estoqueIdeal}
            onChange={(e) => setForm({ ...form, estoqueIdeal: e.target.value })}
          />
        </div>

        <BlocoDevolucao form={form} setForm={setForm} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit" loading={salvando}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}

function CardProdutoSelecionado({ variacao, estoqueBaixo }) {
  const ehVariacaoPadrao = !variacao.nome || variacao.nome === 'Padrão' || variacao.nome === 'Padrao';
  const ehFisico = variacao.produto?.tipo === 'FISICO';
  const imagemUrl = variacao.imagemUrl || variacao.produto?.imagemUrl;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-subtle)]/30">
      {imagemUrl ? (
        <img
          src={imagemUrl}
          alt=""
          className="w-14 h-14 rounded-xl object-cover border border-[var(--border-main)] flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex items-center justify-center flex-shrink-0 text-[var(--text-muted)]">
          <Box size={20} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-main)] truncate">
          {variacao.produto?.nome}
          {!ehVariacaoPadrao && <span className="text-[var(--text-muted)] font-medium"> · {variacao.nome}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)] mt-0.5">
          {variacao.produto?.categoria?.nome && (
            <span>{variacao.produto.categoria.nome}</span>
          )}
          <span>Venda: <strong className="text-[var(--text-main)]">{fmtBRL2(variacao.preco)}</strong></span>
          {variacao.precoCusto > 0 && (
            <span>Custo: {fmtBRL2(variacao.precoCusto)}</span>
          )}
        </div>
      </div>
      {ehFisico && (
        <div className={`text-right flex-shrink-0 ${estoqueBaixo ? 'text-[var(--warning)]' : 'text-[var(--text-main)]'}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Estoque</div>
          <div className="text-lg font-black tabular-nums leading-none mt-0.5">{variacao.estoqueAtual}</div>
          {estoqueBaixo && (
            <div className="text-[9px] uppercase tracking-wider mt-0.5">⚠ baixo</div>
          )}
        </div>
      )}
    </div>
  );
}

function ModalProduto({ isOpen, onClose, categorias, onSalvar }) {
  const [form, setForm] = useState({
    nome: '', descricao: '', categoriaId: '', tipo: 'FISICO', imagemUrl: '',
    nomeVariacao: 'Padrao', sku: '', preco: 0, precoCusto: '', lucroTipo: 'VALOR', lucroValor: '',
    estoqueAtual: '', estoqueMinimo: '', estoqueIdeal: '', duracaoMin: '', imagemVariacaoUrl: '',
    temDevolucao: false, diasParaDevolucaoPadrao: '',
  });
  const [tempsParaLimpar, setTempsParaLimpar] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setForm({
        nome: '', descricao: '', categoriaId: '', tipo: 'FISICO', imagemUrl: '',
        nomeVariacao: 'Padrao', sku: '', preco: 0, precoCusto: 0, lucroTipo: 'VALOR', lucroValor: 0,
        estoqueAtual: 0, estoqueMinimo: 0, estoqueIdeal: 0, duracaoMin: '', imagemVariacaoUrl: '',
        temDevolucao: false, diasParaDevolucaoPadrao: '',
      });
      setTempsParaLimpar([]);
    }
  }, [isOpen]);

  const handleClose = () => {
    for (const url of tempsParaLimpar) catalogoService.removerImagemTemp(url);
    setTempsParaLimpar([]);
    onClose();
  };

  const handleUploadProduto = async (file) => {
    const url = await catalogoService.uploadImagemTemp(file);
    setTempsParaLimpar((prev) => [...prev, url]);
    setForm((prev) => ({ ...prev, imagemUrl: url }));
  };

  const handleRemoverImagemProduto = async () => {
    if (form.imagemUrl) {
      await catalogoService.removerImagemTemp(form.imagemUrl);
      setTempsParaLimpar((prev) => prev.filter((u) => u !== form.imagemUrl));
    }
    setForm((prev) => ({ ...prev, imagemUrl: '' }));
  };

  const handleUploadVariacao = async (file) => {
    const url = await catalogoService.uploadImagemTemp(file);
    setTempsParaLimpar((prev) => [...prev, url]);
    setForm((prev) => ({ ...prev, imagemVariacaoUrl: url }));
  };

  const handleRemoverImagemVariacao = async () => {
    if (form.imagemVariacaoUrl) {
      await catalogoService.removerImagemTemp(form.imagemVariacaoUrl);
      setTempsParaLimpar((prev) => prev.filter((u) => u !== form.imagemVariacaoUrl));
    }
    setForm((prev) => ({ ...prev, imagemVariacaoUrl: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.categoriaId) {
      alert('Selecione uma categoria. Se ainda não tem nenhuma, use o link no topo do modal pra cadastrar.');
      return;
    }

    // Estoque cadastra SO produtos fisicos. Servicos sao no Catalogo.
    // Forcar tipo=FISICO no payload pra blindar mesmo que algo no estado mude.
    onSalvar({
      nome: form.nome,
      descricao: form.descricao,
      categoriaId: form.categoriaId,
      tipo: 'FISICO',
      visibilidade: 'ATIVO',
      imagemUrl: form.imagemUrl || null,
      temDevolucao: form.temDevolucao,
      diasParaDevolucaoPadrao: form.temDevolucao && form.diasParaDevolucaoPadrao !== ''
        ? parseInt(form.diasParaDevolucaoPadrao, 10) || null
        : null,
      variacoes: [{
        nome: form.nomeVariacao || 'Padrao',
        sku: form.sku || null,
        precoCusto: parseFloat(form.precoCusto) || 0,
        lucroTipo: form.lucroTipo || 'VALOR',
        lucroValor: parseFloat(form.lucroValor) || 0,
        preco: calcularPrecoVenda(form.precoCusto, form.lucroTipo, form.lucroValor),
        estoqueAtual: parseInt(form.estoqueAtual) || 0,
        estoqueMinimo: parseInt(form.estoqueMinimo) || 0,
        estoqueIdeal: parseInt(form.estoqueIdeal) || 0,
        imagemUrl: form.imagemVariacaoUrl || null,
      }],
    });
    setTempsParaLimpar([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Novo produto" description="Cadastre o produto com nome, foto, preço e quantidade — tudo em uma tela." size="2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Banner amigavel quando nao tem categoria cadastrada — com link direto
            pra tela de cadastro. Encurta a rota (1 click vs ter que voltar). */}
        {categorias.length === 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
            <Tag size={18} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed flex-1">
              <strong>Você ainda não tem nenhuma categoria.</strong> Cadastre uma antes pra organizar seus produtos.{' '}
              <Link
                to="/app/estoque/categorias"
                onClick={handleClose}
                className="font-semibold underline hover:no-underline"
              >
                Cadastrar categoria agora →
              </Link>
            </div>
          </div>
        )}

        <div className="flex items-start gap-4">
          <UploadImagem
            imagemUrl={form.imagemUrl || null}
            onUpload={handleUploadProduto}
            onRemover={handleRemoverImagemProduto}
            tamanho="md"
          />
          <div className="flex-1 min-w-0 space-y-4">
            <Input
              size="lg"
              label="Nome do produto"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
              autoFocus
            />
            <Select
              size="lg"
              label="Categoria"
              value={form.categoriaId}
              onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              placeholder="Selecione..."
              options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
              required
              disabled={categorias.length === 0}
              hint={categorias.length === 0 ? 'Cadastre uma categoria primeiro (link no banner acima).' : null}
            />
          </div>
        </div>

        <Textarea
          size="lg"
          label="Descrição (opcional)"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          rows={2}
        />

        {/* Sem seletor de Tipo: Estoque cadastra so produtos fisicos.
            Servicos sao cadastrados no Catalogo. */}

        <BlocoDevolucao form={form} setForm={setForm} />

        <div className="border-t border-[var(--border-main)] pt-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">Preço e quantidade</div>

          <div className="flex items-start gap-4 mb-4">
            <UploadImagem
              imagemUrl={form.imagemVariacaoUrl || null}
              onUpload={handleUploadVariacao}
              onRemover={handleRemoverImagemVariacao}
              tamanho="sm"
            />
            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                size="lg"
                label={rotuloAjuda('Tem cor/tamanho diferente?', "Ex.: 'Tamanho M', 'Cor azul'. Se o produto vem em uma versão só, deixe 'Padrão'.")}
                value={form.nomeVariacao}
                onChange={(e) => setForm({ ...form, nomeVariacao: e.target.value })}
                required
              />
              <Input
                size="lg"
                label={rotuloAjuda('Código do produto', 'Um apelido seu pra achar rápido (também chamado de SKU). Opcional.')}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
          </div>

          <CampoCustoLucro form={form} setForm={setForm} />

          {/* Estoque so cadastra produtos fisicos — campos de quantidade
              sempre visiveis. Servicos com duracao vao pro Catalogo. */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Input
              size="lg"
              label={rotuloAjuda('Quanto tem hoje?', 'A quantidade que está disponível na loja agora.')}
              type="number"
              min="0"
              value={form.estoqueAtual}
              onChange={(e) => setForm({ ...form, estoqueAtual: e.target.value })}
            />
            <Input
              size="lg"
              label={rotuloAjuda('Avisar quando tiver', 'Quando chegar nessa quantidade, o sistema avisa que está acabando.')}
              type="number"
              min="0"
              value={form.estoqueMinimo}
              onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
            />
            <Input
              size="lg"
              label={rotuloAjuda('Quanto comprar quando acabar', 'Quando precisar repor, é essa quantidade que você compra.')}
              type="number"
              min="0"
              value={form.estoqueIdeal}
              onChange={(e) => setForm({ ...form, estoqueIdeal: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">Criar produto</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCategoria({ isOpen, onClose, cat, onSalvar }) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (cat) setNome(cat.nome);
    else setNome('');
  }, [cat, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar({ id: cat?.id, nome });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cat ? 'Editar categoria' : 'Nova categoria de produto'} description="Agrupa seus produtos para organizar relatorios e CMV." size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Bebidas, Roupas, Cabelo, Equipamentos..."
          required
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{cat ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  );
}
