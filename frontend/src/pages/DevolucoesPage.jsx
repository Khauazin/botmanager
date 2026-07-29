import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Package, Phone, ExternalLink, Check, AlertTriangle } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Badge, EmptyState, KpiCard, useToast,
} from '../components/ui';
import devolucaoService from '../services/devolucaoService';

const FILTROS = [
  { valor: 'pendente', label: 'Pendentes' },
  { valor: 'atrasada', label: 'Atrasadas' },
  { valor: 'concluida', label: 'Devolvidas' },
];

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function estaAtrasada(d) {
  return !d.devolvidoEm && new Date(d.dataDevolucao).getTime() < Date.now();
}

export default function DevolucoesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState('pendente');
  const [devolucoes, setDevolucoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [concluindo, setConcluindo] = useState(null); // id em processamento

  const carregar = async (status) => {
    setCarregando(true);
    try {
      const r = await devolucaoService.listar(status);
      setDevolucoes(r || []);
    } catch {
      toast.error('Não foi possível carregar as devoluções.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filtro change
    carregar(filtro);
  }, [filtro]);

  // KPIs sempre olham pendentes+atrasadas (independente do filtro selecionado
  // na lista) — pra dar o panorama geral de 1 olhada.
  const [resumo, setResumo] = useState({ pendentes: 0, atrasadas: 0 });
  useEffect(() => {
    devolucaoService.listar('pendente')
      .then((lista) => {
        const total = lista?.length || 0;
        const atrasadas = (lista || []).filter(estaAtrasada).length;
        setResumo({ pendentes: total, atrasadas });
      })
      .catch(() => {});
  }, [devolucoes]);

  const handleConcluir = async (d) => {
    const nomeProduto = `${d.variacao?.produto?.nome || 'produto'} (${d.variacao?.nome || ''})`;
    if (!window.confirm(`Confirmar que "${nomeProduto}" foi devolvido por ${d.lead?.nome || 'o cliente'}?`)) return;
    setConcluindo(d.id);
    try {
      await devolucaoService.concluir(d.id);
      toast.success('Devolução concluída. Estoque atualizado.');
      carregar(filtro);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao concluir devolução.');
    } finally {
      setConcluindo(null);
    }
  };

  const listaOrdenada = useMemo(
    () => [...devolucoes].sort((a, b) => new Date(a.dataDevolucao) - new Date(b.dataDevolucao)),
    [devolucoes]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Devoluções</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Itens alugados que precisam voltar pra loja. O sistema avisa o cliente e gera alerta
          por aqui quando a data se aproxima.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={RotateCcw} color="neutral" label="Pendentes" valor={resumo.pendentes} />
        <KpiCard icon={AlertTriangle} color={resumo.atrasadas > 0 ? 'danger' : 'neutral'} label="Atrasadas" valor={resumo.atrasadas} />
      </div>

      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`px-4 py-2 rounded-lg border-2 text-xs font-semibold uppercase tracking-tight transition-colors ${
              filtro === f.valor
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40 text-[var(--accent)]'
                : 'border-[var(--border-main)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : listaOrdenada.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={RotateCcw}
            title={filtro === 'concluida' ? 'Nenhuma devolução concluída ainda' : 'Nenhuma devolução por aqui'}
            description={
              filtro === 'concluida'
                ? 'Itens marcados como devolvidos aparecem aqui.'
                : 'Vendas de produtos marcados como "alugado" (em Estoque) aparecem aqui até voltarem.'
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div>
              <CardTitle>{FILTROS.find((f) => f.valor === filtro)?.label}</CardTitle>
              <CardDescription>{listaOrdenada.length} item(ns)</CardDescription>
            </div>
          </CardHeader>
          <div className="divide-y divide-[var(--border-subtle)]">
            {listaOrdenada.map((d) => {
              const atrasada = estaAtrasada(d);
              const concluida = !!d.devolvidoEm;
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    concluida ? 'bg-[var(--success-soft)] text-[var(--success-text)]' : atrasada ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                  }`}>
                    <Package size={16} strokeWidth={1.75} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--text-main)] truncate">
                      {d.variacao?.produto?.nome} <span className="text-[var(--text-muted)] font-normal">{d.variacao?.nome}</span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1 flex-wrap">
                      <span>{d.lead?.nome || 'Cliente não identificado'}</span>
                      {d.lead?.telefone && (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone size={10} /> {d.lead.telefone}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/app/vendas`)}
                        className="inline-flex items-center gap-0.5 hover:underline"
                        title="Ver venda"
                      >
                        Venda #{d.venda?.numero} <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {concluida ? 'Devolvido em' : 'Devolução em'}
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-main)]">
                      {fmtData(concluida ? d.devolvidoEm : d.dataDevolucao)}
                    </div>
                  </div>

                  {concluida ? (
                    <Badge variant="success" size="sm">Devolvido</Badge>
                  ) : (
                    <>
                      {atrasada && <Badge variant="danger" size="sm">Atrasada</Badge>}
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Check}
                        onClick={() => handleConcluir(d)}
                        loading={concluindo === d.id}
                      >
                        Marcar devolvido
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
