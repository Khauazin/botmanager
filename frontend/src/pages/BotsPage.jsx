import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Bot, Edit2, Trash2, MoreHorizontal, Wifi, WifiOff, AlertCircle,
  Sparkles, Copy, MessageCircle,
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Select, Badge, Switch,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider, useToast,
  Combobox, KpiCard,
} from '../components/ui';
import Modal from '../components/Modal';
import { formatarTelefoneIntl } from '../utils/formatTelefone';
import adminCredencialIAService from '../services/adminCredencialIAService';

const STATUS_LABELS = {
  ONLINE: { label: 'Online', variant: 'success', icon: Wifi },
  OFFLINE: { label: 'Offline', variant: 'neutral', icon: WifiOff },
  ERROR: { label: 'Erro', variant: 'danger', icon: AlertCircle },
};

const CANAIS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

// Espelha MODELOS_VALIDOS do backend (adapters/ia/deepseek.js).
const MODELOS_IA = [
  { value: 'deepseek-v4-flash', label: 'Rapido e economico (deepseek-v4-flash)' },
  { value: 'deepseek-v4-pro', label: 'Avancado (deepseek-v4-pro)' },
];

export default function BotsPage() {
  const toast = useToast();
  const [bots, setBots] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [modal, setModal] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, bot: null });

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [b, c] = await Promise.all([
        api.get('/bots'),
        api.get('/clientes'),
      ]);
      setBots(b.data || []);
      setClientes(c.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return bots.filter((b) => {
      if (filtroCliente && b.clienteId !== filtroCliente) return false;
      if (filtroStatus && b.status !== filtroStatus) return false;
      if (q && !b.nome?.toLowerCase().includes(q) && !b.cliente?.nome?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bots, busca, filtroCliente, filtroStatus]);

  const stats = useMemo(() => ({
    total: bots.length,
    online: bots.filter((b) => b.status === 'ONLINE').length,
    erro: bots.filter((b) => b.status === 'ERROR').length,
    msgs: bots.reduce((acc, b) => acc + Number(b.totalMensagens || 0), 0),
  }), [bots]);

  const handleSalvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/bots/${dados.id}`, dados);
        toast.success('Bot atualizado');
      } else {
        await api.post('/bots', dados);
        toast.success('Bot criado');
      }
      setModal({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleExcluir = async (b) => {
    if (!confirm(`Excluir bot "${b.nome}"?\nIsso remove todos os fluxos vinculados.`)) return;
    try {
      await api.delete(`/bots/${b.id}`);
      toast.success('Bot excluido');
      setDrawer({ open: false, bot: null });
      carregar();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleDuplicar = async (b) => {
    try {
      await api.post(`/bots/${b.id}/duplicate`);
      toast.success('Bot duplicado');
      carregar();
    } catch {
      toast.error('Erro ao duplicar');
    }
  };

  // Publicar/despublicar = toggle ONLINE <-> OFFLINE. ERROR e estado de sistema.
  const handlePublicar = async (b) => {
    const novoStatus = b.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    try {
      await api.patch(`/bots/${b.id}/status`, { status: novoStatus });
      toast.success(novoStatus === 'ONLINE' ? 'Bot publicado (online)' : 'Bot despublicado (offline)');
      setDrawer({ open: false, bot: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao mudar status');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Bot} color="neutral" label="Total" valor={stats.total} />
        <KpiCard icon={Wifi} color="success" label="Online" valor={stats.online} />
        <KpiCard icon={AlertCircle} color="danger" label="Em erro" valor={stats.erro} />
        <KpiCard icon={MessageCircle} color="neutral" label="Mensagens" valor={stats.msgs.toLocaleString('pt-BR')} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar bot ou cliente..." />
        </div>
        <Select
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          placeholder="Todos clientes"
          options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          fullWidth={false}
          className="w-48"
        />
        <Select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          placeholder="Todos status"
          options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
          fullWidth={false}
          className="w-40"
        />
        <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>Novo bot</Button>
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Bot}
            title={bots.length === 0 ? 'Nenhum bot cadastrado' : 'Sem resultados'}
            description={bots.length === 0 ? 'Cadastre o primeiro bot de atendimento.' : null}
            action={bots.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>Novo bot</Button>
            )}
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Bot</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Cliente</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Canal</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Status</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Hoje</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Total</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((b) => {
                const status = STATUS_LABELS[b.status] || { label: b.status, variant: 'neutral' };
                return (
                  <tr key={b.id} onClick={() => setDrawer({ open: true, bot: b })} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
                          <Bot size={16} strokeWidth={1.75} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{b.nome}</div>
                          {b.telefone && <div className="text-[11px] text-[var(--text-muted)]">{b.telefone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">{b.cliente?.nome || '—'}</td>
                    <td className="py-3 px-5"><Badge variant="neutral" size="sm">{b.canal}</Badge></td>
                    <td className="py-3 px-5"><Badge variant={status.variant} size="sm" icon={status.icon}>{status.label}</Badge></td>
                    <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">{b.mensagensHoje || 0}</td>
                    <td className="py-3 px-5 text-right text-sm text-[var(--text-secondary)] tabular-nums">{(b.totalMensagens || 0).toLocaleString('pt-BR')}</td>
                    <td onClick={(e) => e.stopPropagation()} className="py-3 px-3">
                      <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                        <DropdownItem icon={Edit2} onClick={() => setModal({ open: true, data: b })}>Editar</DropdownItem>
                        <DropdownItem icon={MessageCircle}>
                          <Link to={`/admin/bots/${b.id}/canal`}>Canal externo</Link>
                        </DropdownItem>
                        <DropdownItem icon={Copy} onClick={() => handleDuplicar(b)}>Duplicar</DropdownItem>
                        <DropdownItem icon={b.status === 'ONLINE' ? WifiOff : Wifi} onClick={() => handlePublicar(b)}>
                          {b.status === 'ONLINE' ? 'Despublicar' : 'Publicar'}
                        </DropdownItem>
                        <DropdownDivider />
                        <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluir(b)}>Excluir</DropdownItem>
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ModalBot
        isOpen={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        bot={modal.data}
        clientes={clientes}
        onSalvar={handleSalvar}
      />

      <DrawerBot
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, bot: null })}
        bot={drawer.bot}
        cliente={clientes.find((c) => c.id === drawer.bot?.clienteId)}
        onEditar={() => { setModal({ open: true, data: drawer.bot }); setDrawer({ open: false, bot: null }); }}
        onExcluir={() => handleExcluir(drawer.bot)}
        onDuplicar={() => handleDuplicar(drawer.bot)}
        onPublicar={() => handlePublicar(drawer.bot)}
      />
    </div>
  );
}

// Kpi local removido — usa KpiCard compartilhado do ui/.

// Converte entre a unidade que o backend guarda (centavos, inteiro — evita
// erro de arredondamento de float) e a que a pessoa digita (reais).
const centavosParaReais = (c) => ((Number(c) || 0) / 100).toFixed(2);
const reaisParaCentavos = (r) => Math.round((parseFloat(r) || 0) * 100);

const FORM_VAZIO = {
  nome: '', clienteId: '', canal: 'WHATSAPP', telefone: '',
  iaAtiva: false, iaModelo: 'deepseek-v4-flash',
  iaTokensIncluidosMes: 100000, iaPrecoPorMilTokensExcedente: '0.08',
};

function ModalBot({ isOpen, onClose, bot, clientes, onSalvar }) {
  const toast = useToast();
  const [form, setForm] = useState(FORM_VAZIO);
  const [chaveIA, setChaveIA] = useState(''); // valor novo digitado (vazio = manter a atual)
  const [chaveIAConfigurada, setChaveIAConfigurada] = useState(null); // null = carregando
  const [salvandoChave, setSalvandoChave] = useState(false);

  useEffect(() => {
    if (bot) {
      setForm({
        ...bot,
        telefone: bot.telefone || '',
        iaAtiva: bot.iaAtiva ?? false,
        iaModelo: bot.iaModelo || 'deepseek-v4-flash',
        iaTokensIncluidosMes: bot.iaTokensIncluidosMes ?? 100000,
        iaPrecoPorMilTokensExcedente: centavosParaReais(bot.iaPrecoPorMilTokensExcedenteCentavos ?? 8),
      });
    } else {
      setForm(FORM_VAZIO);
    }
    setChaveIA('');
  }, [bot, isOpen]);

  // A chave da DeepSeek e da PLATAFORMA (uma so, nao por bot) — mas o cadastro
  // fica aqui mesmo, no modal do bot, pra nao mandar o admin pra outro lugar.
  // Por isso o status e buscado sempre que o modal abre, independente de qual
  // bot esta sendo editado.
  useEffect(() => {
    if (!isOpen) return;
    let ativo = true;
    adminCredencialIAService.obter()
      .then((cred) => { if (ativo) setChaveIAConfigurada(!!cred); })
      .catch(() => { if (ativo) setChaveIAConfigurada(false); });
    return () => { ativo = false; };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clienteId) { alert('Selecione um cliente'); return; }

    if (chaveIA.trim()) {
      setSalvandoChave(true);
      try {
        await adminCredencialIAService.salvar({ apiKey: chaveIA.trim() });
        setChaveIAConfigurada(true);
        setChaveIA('');
      } catch (err) {
        toast.error(err.response?.data?.erro || 'Falha ao salvar a chave da DeepSeek.');
        setSalvandoChave(false);
        return; // nao salva o bot se a chave falhou — evita ligar iaAtiva sem chave valida
      }
      setSalvandoChave(false);
    }

    onSalvar({
      ...form,
      iaTokensIncluidosMes: parseInt(form.iaTokensIncluidosMes, 10) || 0,
      iaPrecoPorMilTokensExcedenteCentavos: reaisParaCentavos(form.iaPrecoPorMilTokensExcedente),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={bot ? 'Editar bot' : 'Novo bot'} description="Configuracao basica do bot. O construtor de fluxo fica em outra tela." size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nome do bot" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          <Combobox
            label="Cliente"
            value={form.clienteId}
            onChange={(id) => setForm({ ...form, clienteId: id })}
            placeholder="Selecione..."
            options={clientes.map((c) => ({ value: c.id, label: c.nome, sublabel: c.email }))}
          />
          <Select label="Canal" value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} options={CANAIS} placeholder="" />
          <Input
            label="Telefone (canal)"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: formatarTelefoneIntl(e.target.value) })}
            placeholder="+5511999999999"
            maxLength={16}
            inputMode="tel"
            hint="Formato internacional E.164 (com +). Maximo 15 digitos."
          />
        </div>

        <div className="border-t border-[var(--border-main)] pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
              <Sparkles size={12} /> Atendimento com IA
            </div>
            <Switch checked={form.iaAtiva} onChange={(v) => setForm({ ...form, iaAtiva: v })} ariaLabel="Ativar atendimento com IA" />
          </div>

          {form.iaAtiva && (
            <>
              <div className="mb-3">
                <Input
                  label="Chave da API DeepSeek"
                  type="password"
                  value={chaveIA}
                  onChange={(e) => setChaveIA(e.target.value)}
                  placeholder={
                    chaveIAConfigurada === null ? 'Verificando...' :
                    chaveIAConfigurada ? 'Cole uma nova chave para trocar' :
                    'Cole a chave da conta DeepSeek'
                  }
                  hint={
                    <span className="inline-flex items-center gap-1.5">
                      {chaveIAConfigurada
                        ? <Badge variant="success" size="sm">Conectada</Badge>
                        : chaveIAConfigurada === false
                          ? <Badge variant="warning" size="sm">Nao configurada</Badge>
                          : null}
                      <span>Unica pra toda a plataforma — vale pra todos os bots com IA ativa, nao so este.</span>
                    </span>
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Modelo"
                  value={form.iaModelo}
                  onChange={(e) => setForm({ ...form, iaModelo: e.target.value })}
                  options={MODELOS_IA}
                  placeholder=""
                />
                <Input
                  label="Tokens inclusos por mes"
                  type="number" min="0" step="1000"
                  value={form.iaTokensIncluidosMes}
                  onChange={(e) => setForm({ ...form, iaTokensIncluidosMes: e.target.value })}
                />
                <Input
                  label="R$ a cada 1.000 tokens excedentes"
                  type="number" min="0" step="0.01"
                  value={form.iaPrecoPorMilTokensExcedente}
                  onChange={(e) => setForm({ ...form, iaPrecoPorMilTokensExcedente: e.target.value })}
                  hint="Cobrado do cliente quando o uso do mes passa do limite acima."
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-3">
                O prompt de atendimento (dados da empresa, regras) e preenchido pelo proprio
                cliente na tela do bot dele.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit" loading={salvandoChave}>{bot ? 'Salvar' : 'Criar bot'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerBot({ isOpen, onClose, bot, cliente, onEditar, onExcluir, onDuplicar, onPublicar }) {
  if (!bot) return null;
  const status = STATUS_LABELS[bot.status] || { label: bot.status, variant: 'neutral' };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={bot.nome}
      description={cliente?.nome || 'Sem cliente'}
      size="md"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="danger-soft" icon={Trash2} onClick={onExcluir}>Excluir</Button>
          <div className="flex gap-2">
            <Button variant="secondary" icon={Copy} onClick={onDuplicar}>Duplicar</Button>
            <Button variant="primary" icon={Edit2} onClick={onEditar}>Editar</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Bot size={20} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="neutral">{bot.canal}</Badge>
              <Badge variant={status.variant} icon={status.icon}>{status.label}</Badge>
            </div>
            {bot.telefone && <div className="text-xs text-[var(--text-muted)] mt-1">{bot.telefone}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Mensagens hoje" valor={bot.mensagensHoje || 0} />
          <InfoBox label="Total" valor={(bot.totalMensagens || 0).toLocaleString('pt-BR')} />
        </div>

        {/* Publicar/despublicar: deixa o bot online (atendendo) ou offline. */}
        <Button
          variant="secondary"
          icon={bot.status === 'ONLINE' ? WifiOff : Wifi}
          fullWidth
          onClick={onPublicar}
        >
          {bot.status === 'ONLINE' ? 'Despublicar (deixar offline)' : 'Publicar (deixar online)'}
        </Button>

        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--text-muted)]" />
          {bot.iaAtiva ? (
            <Badge variant="success" size="sm">IA ativa · {bot.iaModelo}</Badge>
          ) : (
            <Badge variant="neutral" size="sm">Sem atendimento por IA</Badge>
          )}
        </div>

        <InfoBox label="Ultima atividade" valor={bot.ultimaAtividadeEm ? new Date(bot.ultimaAtividadeEm).toLocaleString('pt-BR') : 'Sem registros'} />
      </div>
    </Drawer>
  );
}

function InfoBox({ label, valor }) {
  return (
    <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--text-main)] mt-0.5 tabular-nums">{valor}</div>
    </div>
  );
}
