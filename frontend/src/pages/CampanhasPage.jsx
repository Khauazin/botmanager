import { useState, useEffect, useMemo } from 'react';
import { Repeat, RefreshCw, MessageCircle, Clock, Info, Users, Star, UserX } from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, Select, Badge, EmptyState, useToast, KpiCard,
} from '../components/ui';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const soDigitos = (t) => String(t || '').replace(/\D/g, '');

const JANELAS = [
  { value: '30', label: 'Compraram ha 30+ dias' },
  { value: '45', label: 'Compraram ha 45+ dias' },
  { value: '60', label: 'Compraram ha 60+ dias' },
  { value: '90', label: 'Compraram ha 90+ dias' },
];

const SEGMENTOS = [
  {
    valor: 'recompra',
    label: 'Sumiram após comprar',
    icon: Clock,
    cor: 'warning',
    aviso: 'Compraram ou agendaram uma vez e não voltaram na janela escolhida. Envio ainda é manual, um a um.',
  },
  {
    valor: 'recorrentes',
    label: 'Recorrentes',
    icon: Star,
    cor: 'success',
    aviso: 'Já compraram ou agendaram 2 vezes ou mais — bons candidatos pra fidelidade ou indicação.',
  },
  {
    valor: 'nunca-converteram',
    label: 'Nunca converteram',
    icon: UserX,
    cor: 'danger',
    aviso: 'Entraram na base há 7 dias ou mais e nunca fecharam compra nem atendimento. Vale retomar contato.',
  },
  {
    valor: 'convertidos',
    label: 'Já converteram',
    icon: Users,
    cor: 'accent',
    aviso: 'Todo lead que já comprou ou foi atendido pelo menos uma vez — sua base de clientes reais.',
  },
];

export default function CampanhasPage() {
  const toast = useToast();
  const [segmento, setSegmento] = useState('recompra');
  const [dias, setDias] = useState('30');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [resumo, setResumo] = useState({ recompra: 0, recorrentes: 0, 'nunca-converteram': 0, convertidos: 0 });

  const carregar = async (seg, d) => {
    setCarregando(true);
    try {
      const url = seg === 'recompra' ? `/campanhas/recompra?dias=${encodeURIComponent(d)}` : `/campanhas/${seg}`;
      const r = await api.get(url);
      setDados(r.data);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao carregar a lista.');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega ao montar
    carregar('recompra', '30');

    // Contagem de cada segmento pro resumo do topo — 1 leitura leve por
    // segmento, independente de qual esta selecionado.
    Promise.all([
      api.get('/campanhas/recompra?dias=30').then((r) => r.data.candidatos?.length || 0).catch(() => 0),
      api.get('/campanhas/recorrentes').then((r) => r.data.leads?.length || 0).catch(() => 0),
      api.get('/campanhas/nunca-converteram').then((r) => r.data.leads?.length || 0).catch(() => 0),
      api.get('/campanhas/convertidos').then((r) => r.data.leads?.length || 0).catch(() => 0),
    ]).then(([recompra, recorrentes, nuncaConverteram, convertidos]) => {
      setResumo({ recompra, recorrentes, 'nunca-converteram': nuncaConverteram, convertidos });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMudarSegmento = (seg) => {
    setSegmento(seg);
    carregar(seg, dias);
  };

  const handleMudarDias = (d) => {
    setDias(d);
    carregar('recompra', d);
  };

  // Normaliza os 3 formatos de resposta (recompra/leads-conversao/leads-novos)
  // num unico formato de linha, pra renderizar com 1 so template.
  const itens = useMemo(() => {
    if (!dados) return [];
    if (segmento === 'recompra') {
      return (dados.candidatos || []).map((c) => ({
        leadId: c.leadId,
        nome: c.nome,
        telefone: c.telefone,
        metrica: `Última compra ${fmtData(c.ultimaCompra)} · há ${c.diasDesde} dias`,
        submetrica: `${c.totalCompras} compra(s) · ${fmtBRL(c.valorTotal)}`,
        contatado: c.contatadoAposCompra,
      }));
    }
    if (segmento === 'recorrentes' || segmento === 'convertidos') {
      return (dados.leads || []).map((l) => ({
        leadId: l.leadId,
        nome: l.nome,
        telefone: l.telefone,
        metrica: `${l.totalConversoes} conversão(ões) · última em ${fmtData(l.ultimaConversao)}`,
        submetrica: `${l.compras} compra(s) · ${l.atendimentos} atendimento(s)${l.valorTotal ? ` · ${fmtBRL(l.valorTotal)}` : ''}`,
      }));
    }
    if (segmento === 'nunca-converteram') {
      return (dados.leads || []).map((l) => ({
        leadId: l.leadId,
        nome: l.nome,
        telefone: l.telefone,
        metrica: `Cadastrado há ${l.diasSemConverter} dias`,
        submetrica: 'Nunca comprou nem agendou',
      }));
    }
    return [];
  }, [dados, segmento]);

  const segAtual = SEGMENTOS.find((s) => s.valor === segmento);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Campanhas</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Encontre e reative os clientes que já passaram pela sua base.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SEGMENTOS.map((s) => (
          <button
            key={s.valor}
            type="button"
            onClick={() => handleMudarSegmento(s.valor)}
            className={`text-left rounded-xl transition-shadow ${
              segmento === s.valor ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-page)]' : ''
            }`}
          >
            <KpiCard icon={s.icon} color={s.cor} label={s.label} valor={resumo[s.valor] ?? 0} />
          </button>
        ))}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--info-soft)] text-[var(--info-text)]">
        <Info size={18} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed">{segAtual?.aviso}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Repeat size={18} className="text-[var(--text-muted)]" />
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">{segAtual?.label}</h2>
          {!carregando && <Badge variant="neutral" size="sm">{itens.length}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {segmento === 'recompra' && (
            <Select
              value={dias}
              onChange={(e) => handleMudarDias(e.target.value)}
              options={JANELAS}
              placeholder=""
              fullWidth={false}
              className="w-56"
            />
          )}
          <Button variant="secondary" size="md" icon={RefreshCw} onClick={() => carregar(segmento, dias)}>Atualizar</Button>
        </div>
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : itens.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={segAtual?.icon || Repeat}
            title={`Ninguém em "${segAtual?.label}"`}
            description="Quando leads entrarem nesse critério, eles aparecem aqui."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-main)]">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Cliente</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Situação</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-44"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.leadId} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 transition-colors">
                    <td className="py-3 px-5">
                      <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{it.nome}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{it.telefone || 'Sem telefone'}</div>
                    </td>
                    <td className="py-3 px-5">
                      <div className="text-sm text-[var(--text-secondary)]">{it.metrica}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{it.submetrica}</div>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {it.contatado && <Badge variant="success" size="sm">Já contatado</Badge>}
                        {it.telefone ? (
                          <a href={`https://wa.me/${soDigitos(it.telefone)}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="primary" size="sm" icon={MessageCircle}>WhatsApp</Button>
                          </a>
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">sem contato</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
