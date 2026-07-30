import { useState, useEffect, useMemo } from 'react';
import {
  Repeat, RefreshCw, MessageCircle, Clock, Info, Users, Star, UserX,
  Plus, Send, Ticket, Megaphone,
} from 'lucide-react';
import api from '../services/api';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Select, Input, Textarea, Badge,
  EmptyState, useToast, KpiCard, Tabs, TabsList, TabsTrigger, TabsContent, Switch, LabelAjuda,
} from '../components/ui';
import Modal from '../components/Modal';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const soDigitos = (t) => String(t || '').replace(/\D/g, '');

const STATUS_CAMPANHA_VARIANT = {
  RASCUNHO: 'neutral', ENVIANDO: 'warning', CONCLUIDA: 'success', ERRO: 'danger',
};
const STATUS_CAMPANHA_LABEL = {
  RASCUNHO: 'Rascunho', ENVIANDO: 'Enviando', CONCLUIDA: 'Concluída', ERRO: 'Erro',
};

const FORM_CAMPANHA_VAZIO = {
  nome: '', segmento: 'recompra', dias: '30', mensagem: '', nomeTemplate: '',
  incluirCupom: false, cupomCodigo: '', cupomTipo: 'PERCENTUAL', cupomValor: '', cupomValidoAte: '', cupomUsoMaximo: '',
};

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
  const [view, setView] = useState('segmentos');
  const [segmento, setSegmento] = useState('recompra');
  const [dias, setDias] = useState('30');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [resumo, setResumo] = useState({ recompra: 0, recorrentes: 0, 'nunca-converteram': 0, convertidos: 0 });

  const [campanhas, setCampanhas] = useState([]);
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvandoCampanha, setSalvandoCampanha] = useState(false);
  const [disparandoId, setDisparandoId] = useState(null);
  const [form, setForm] = useState(FORM_CAMPANHA_VAZIO);

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

  const carregarCampanhas = async () => {
    setCarregandoCampanhas(true);
    try {
      const r = await api.get('/campanhas');
      setCampanhas(r.data || []);
    } catch {
      toast.error('Não foi possível carregar as campanhas.');
    } finally {
      setCarregandoCampanhas(false);
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

    carregarCampanhas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirNovaCampanha = () => {
    setForm(FORM_CAMPANHA_VAZIO);
    setModalAberto(true);
  };

  const criarCampanha = async () => {
    if (!form.nome.trim()) return toast.error('Informe o nome da campanha.');
    if (!form.mensagem.trim()) return toast.error('Informe a mensagem da campanha.');
    if (form.incluirCupom && (!form.cupomCodigo.trim() || !form.cupomValor)) {
      return toast.error('Preencha o código e o valor do cupom, ou desligue o cupom.');
    }

    setSalvandoCampanha(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        segmento: form.segmento,
        diasRecompra: form.segmento === 'recompra' ? parseInt(form.dias, 10) : undefined,
        mensagem: form.mensagem.trim(),
        nomeTemplate: form.nomeTemplate.trim() || undefined,
        cupom: form.incluirCupom ? {
          codigo: form.cupomCodigo.trim(),
          tipo: form.cupomTipo,
          valor: parseFloat(form.cupomValor),
          validoAte: form.cupomValidoAte || undefined,
          usoMaximo: form.cupomUsoMaximo ? parseInt(form.cupomUsoMaximo, 10) : undefined,
        } : undefined,
      };
      await api.post('/campanhas', payload);
      toast.success('Campanha criada como rascunho.');
      setModalAberto(false);
      carregarCampanhas();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao criar campanha.');
    } finally {
      setSalvandoCampanha(false);
    }
  };

  const dispararCampanha = async (campanha) => {
    if (!campanha.nomeTemplate) {
      toast.error('Configure o nome do template aprovado na Meta antes de disparar (edite a campanha).');
      return;
    }
    if (!window.confirm(`Disparar "${campanha.nome}" pra ${campanha.totalAlvo} lead(s) agora? Essa ação não pode ser desfeita.`)) return;
    setDisparandoId(campanha.id);
    try {
      const r = await api.post(`/campanhas/${campanha.id}/disparar`);
      toast.success(`Disparo iniciado — ${r.data.totalAlvo} lead(s) na fila.`);
      carregarCampanhas();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao disparar campanha.');
    } finally {
      setDisparandoId(null);
    }
  };

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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Campanhas</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Encontre e reative os clientes que já passaram pela sua base.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={abrirNovaCampanha}>Nova campanha</Button>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList variant="pills">
          <TabsTrigger value="segmentos" variant="pills">Segmentos</TabsTrigger>
          <TabsTrigger value="campanhas" variant="pills">Minhas campanhas {campanhas.length > 0 ? `(${campanhas.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="segmentos" className="mt-5 space-y-5">
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
        </TabsContent>

        <TabsContent value="campanhas" className="mt-5 space-y-5">
          {carregandoCampanhas ? (
            <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
          ) : campanhas.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Megaphone}
                title="Nenhuma campanha ainda"
                description="Crie uma campanha pra disparar mensagem (e cupom, se quiser) pra um segmento de leads."
                action={<Button variant="primary" icon={Plus} onClick={abrirNovaCampanha}>Nova campanha</Button>}
              />
            </Card>
          ) : (
            <Card padding="none">
              <div className="divide-y divide-[var(--border)]">
                {campanhas.map((c) => {
                  const segInfo = SEGMENTOS.find((s) => s.valor === c.segmento);
                  return (
                    <div key={c.id} className="flex flex-wrap items-center gap-3 py-4 px-5">
                      <div className="w-9 h-9 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] flex-shrink-0">
                        <Megaphone size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{c.nome}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {segInfo?.label || c.segmento}
                          {c.cupom && ` · Cupom ${c.cupom.codigo} (${c.cupom.tipo === 'PERCENTUAL' ? `${c.cupom.valor}%` : fmtBRL(c.cupom.valor)})`}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          {c.status === 'RASCUNHO'
                            ? `${c.totalAlvo} lead(s) no alvo (na criação)`
                            : `${c.totalEnviado} enviado(s)${c.totalFalhou > 0 ? `, ${c.totalFalhou} falhou(aram)` : ''} de ${c.totalAlvo}`}
                        </div>
                      </div>
                      <Badge variant={STATUS_CAMPANHA_VARIANT[c.status] || 'neutral'} size="sm">
                        {STATUS_CAMPANHA_LABEL[c.status] || c.status}
                      </Badge>
                      {c.status === 'RASCUNHO' && (
                        <Button
                          variant="primary" size="sm" icon={Send}
                          onClick={() => dispararCampanha(c)}
                          loading={disparandoId === c.id}
                        >
                          Disparar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title="Nova campanha"
        description="Escolha o segmento, escreva a mensagem e, se quiser, um cupom de desconto."
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nome da campanha"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Volta com desconto - Julho"
            autoFocus
          />

          <Select
            label="Segmento alvo"
            value={form.segmento}
            onChange={(e) => setForm({ ...form, segmento: e.target.value })}
            options={SEGMENTOS.map((s) => ({ value: s.valor, label: s.label }))}
          />

          {form.segmento === 'recompra' && (
            <Select
              label="Janela de recompra"
              value={form.dias}
              onChange={(e) => setForm({ ...form, dias: e.target.value })}
              options={JANELAS}
            />
          )}

          <Textarea
            label="Mensagem"
            value={form.mensagem}
            onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
            rows={3}
            placeholder="Ex: Sentimos sua falta! Volte essa semana e ganhe 10% de desconto com o cupom VOLTA10."
          />

          <Input
            label={
              <LabelAjuda
                texto="Nome do template aprovado na Meta"
                ajuda="A Meta bloqueia mensagem automática em massa fora da janela de 24h — só libera com um template (HSM) aprovado no Meta Business Manager. Crie o template lá primeiro e cole o nome exato aqui. Sem isso, a campanha fica salva como rascunho, mas não dá pra disparar."
              />
            }
            value={form.nomeTemplate}
            onChange={(e) => setForm({ ...form, nomeTemplate: e.target.value })}
            placeholder="Ex: promocao_recompra_10off"
          />

          <div className="border-t border-[var(--border-main)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                <Ticket size={15} /> Incluir cupom de desconto
              </div>
              <Switch checked={form.incluirCupom} onChange={(v) => setForm({ ...form, incluirCupom: v })} ariaLabel="Incluir cupom de desconto" />
            </div>

            {form.incluirCupom && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Código do cupom"
                  value={form.cupomCodigo}
                  onChange={(e) => setForm({ ...form, cupomCodigo: e.target.value.toUpperCase() })}
                  placeholder="VOLTA10"
                />
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">Tipo de desconto</label>
                  <div className="flex rounded-lg border border-[var(--border-main)] overflow-hidden h-11">
                    {[['PERCENTUAL', '%'], ['VALOR', 'R$']].map(([val, lab]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm({ ...form, cupomTipo: val })}
                        className={`flex-1 text-sm font-medium transition-colors ${form.cupomTipo === val ? 'bg-[var(--primary)] text-[var(--text-on-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'}`}
                      >
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  label={form.cupomTipo === 'PERCENTUAL' ? 'Desconto (%)' : 'Desconto (R$)'}
                  type="number"
                  min="0"
                  max={form.cupomTipo === 'PERCENTUAL' ? '100' : undefined}
                  value={form.cupomValor}
                  onChange={(e) => setForm({ ...form, cupomValor: e.target.value })}
                />
                <Input
                  label="Válido até (opcional)"
                  type="date"
                  value={form.cupomValidoAte}
                  onChange={(e) => setForm({ ...form, cupomValidoAte: e.target.value })}
                />
                <Input
                  label="Limite de usos (opcional)"
                  type="number"
                  min="1"
                  value={form.cupomUsoMaximo}
                  onChange={(e) => setForm({ ...form, cupomUsoMaximo: e.target.value })}
                  placeholder="Sem limite"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button variant="primary" onClick={criarCampanha} loading={salvandoCampanha}>Criar campanha</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
