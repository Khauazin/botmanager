import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Bot as BotIcon, MessageCircle, Copy, RefreshCw, Lock, AlertCircle,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Select, Badge, IconButton, useToast,
} from '../components/ui';
import api, { urlPublica } from '../services/api';
import credenciaisService from '../services/credenciaisService';

function gerarVerifyToken() {
  // 32 chars hex pseudo-aleatorios — suficiente como verify token publico.
  let s = '';
  const arr = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  for (const b of arr) s += b.toString(16).padStart(2, '0');
  return s;
}

export default function BotCanalPage() {
  const { botId } = useParams();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [credenciais, setCredenciais] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    credencialCanalId: '',
    identificadorCanal: '',
    verifyTokenCanal: '',
    fluxoPadraoId: '',
  });

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    setCarregando(true);
    Promise.all([
      api.get(`/bots/${botId}`).catch(() => ({ data: null })),
      credenciaisService.listar().catch(() => []),
      api.get(`/builder/fluxos/${botId}`).catch(() => ({ data: [] })),
    ])
      .then(([respBot, listaCreds, respFluxos]) => {
        if (!ativo) return;
        const b = respBot.data;
        setBot(b);
        setCredenciais(listaCreds || []);
        setFluxos(Array.isArray(respFluxos.data) ? respFluxos.data : []);
        if (b) {
          setForm({
            credencialCanalId: b.credencialCanalId || '',
            identificadorCanal: b.identificadorCanal || '',
            verifyTokenCanal: b.verifyTokenCanal || '',
            fluxoPadraoId: b.fluxoPadraoId || '',
          });
        }
      })
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [botId]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const body = {
        canal: 'WHATSAPP',
        credencialCanalId: form.credencialCanalId || null,
        identificadorCanal: form.identificadorCanal.trim() || null,
        verifyTokenCanal: form.verifyTokenCanal.trim() || null,
        fluxoPadraoId: form.fluxoPadraoId || null,
      };
      const r = await api.patch(`/bots/${botId}/canal`, body);
      setBot(r.data);
      toast.success('Configuracao do canal salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || e.response?.data?.error || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const copiar = (texto, label) => {
    navigator.clipboard?.writeText(texto).then(
      () => toast.success(`${label} copiado.`),
      () => toast.error('Falha ao copiar.'),
    );
  };

  if (carregando) {
    return <div className="text-sm text-[var(--text-muted)]">Carregando...</div>;
  }

  const credenciaisDoCanal = credenciais.filter((c) => c.tipo === 'WHATSAPP_CLOUD_TOKEN');

  // Precisa bater EXATAMENTE com a montagem do backend: index.js faz
  // `app.use('/webhooks', rotasWebhooksWhatsapp)` e o handler responde em
  // '/whatsapp'. Nao existe segmento de botId — quem identifica o bot e o
  // verify token (na verificacao) e o phone_number_id (nas mensagens).
  // Qualquer coisa fora disso devolve 404 e a Meta recusa o endpoint.
  const urlReceiver = `${urlPublica()}/webhooks/whatsapp`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/admin/bots">
          <Button variant="ghost" icon={ArrowLeft} size="sm">Voltar para bots</Button>
        </Link>
        <div className="flex-1" />
        <Button variant="primary" icon={Save} loading={salvando} onClick={salvar}>
          Salvar
        </Button>
      </div>

      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
            <BotIcon size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Bot</div>
            <div className="text-sm font-semibold text-[var(--text-main)] truncate">{bot?.nome || botId}</div>
          </div>
          <Badge variant="neutral" size="sm" icon={MessageCircle}>WhatsApp</Badge>
        </div>
      </Card>

      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Configuracao do canal</CardTitle>
            <CardDescription>
              Vincule este bot ao WhatsApp. Mensagens entrantes disparam o fluxo padrao
              escolhido. Respostas saem com a credencial vinculada.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4">
          <Select
            label="Credencial do canal"
            value={form.credencialCanalId}
            onChange={(e) => setForm({ ...form, credencialCanalId: e.target.value })}
            options={credenciaisDoCanal.map((c) => ({ value: c.id, label: `${c.nome} · ${c.tipo}` }))}
            placeholder={
              credenciaisDoCanal.length === 0
                ? '— Nenhuma credencial WhatsApp cadastrada —'
                : '— Selecione uma credencial —'
            }
            hint={
              credenciaisDoCanal.length === 0
                ? 'Cadastre a integração do WhatsApp em Clientes > Integrações.'
                : undefined
            }
          />

          <Input
            label="Phone Number ID"
            value={form.identificadorCanal}
            onChange={(e) => setForm({ ...form, identificadorCanal: e.target.value })}
            placeholder="Ex: 1290672074119010"
            hint="Vem do painel da Meta (Identificacao do numero de telefone). Obrigatorio: sem ele, mensagens recebidas nao chegam a nenhum bot."
          />

          <Select
            label="Fluxo padrao (disparado a cada mensagem entrante)"
            value={form.fluxoPadraoId}
            onChange={(e) => setForm({ ...form, fluxoPadraoId: e.target.value })}
            options={fluxos.map((f) => ({ value: f.id, label: f.nome }))}
            placeholder={
              fluxos.length === 0
                ? '— Nenhum fluxo cadastrado para este bot —'
                : '— Sem fluxo padrao —'
            }
            hint="O fluxo deve comecar com no MANUAL ou WEBHOOK."
          />
        </div>
      </Card>

      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Webhook publico do WhatsApp</CardTitle>
            <CardDescription>
              Use estes valores no painel da Meta (Configuracao do app, secao Webhooks).
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
              Callback URL
            </label>
            <div className="flex gap-1.5">
              <Input value={urlReceiver || ''} readOnly />
              <IconButton
                icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar URL"
                onClick={() => copiar(urlReceiver, 'URL')}
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Em producao precisa ser HTTPS publico. Use ngrok/cloudflared em dev.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
              Verify Token
            </label>
            <div className="flex gap-1.5">
              <Input
                type="text"
                value={form.verifyTokenCanal}
                onChange={(e) => setForm({ ...form, verifyTokenCanal: e.target.value })}
                placeholder="Defina um valor secreto para a verificacao da Meta"
              />
              <IconButton
                icon={RefreshCw} variant="secondary" size="sm" ariaLabel="Gerar novo"
                onClick={() => setForm({ ...form, verifyTokenCanal: gerarVerifyToken() })}
              />
              <IconButton
                icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar token"
                onClick={() => copiar(form.verifyTokenCanal, 'Verify token')}
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              <Lock size={10} className="inline" /> Cole exatamente o mesmo no painel da Meta.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--info-soft)] text-[var(--info-text)] text-xs leading-snug">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              Webhook fields a marcar na Meta: <code className="font-mono">messages</code>.
              A Meta envia GET de verificacao primeiro. Depois envia POST a cada mensagem
              entrante (mensagens fluem em segundos).
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
