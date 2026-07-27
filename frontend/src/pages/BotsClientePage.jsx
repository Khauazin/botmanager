import { useEffect, useState } from 'react';
import {
  Bot as BotIcon, MessageCircle, Plus, Trash2, Wifi, WifiOff, Settings, Copy,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Select, Badge, IconButton,
  EmptyState, Drawer, useToast,
} from '../components/ui';
import api, { urlPublica } from '../services/api';
import credenciaisService from '../services/credenciaisService';
import faqService from '../services/faqService';

// Tela do tenant pro bot WhatsApp (pos-pivo, sem IA): atendimento (FAQ) e o
// conteudo principal — e o que se mexe toda semana. A conexao tecnica
// (phoneNumberId, verify token, credencial, callback URL) fica escondida atras
// da engrenagem: mexe uma vez, na hora de configurar, e nao compete mais com o
// conteudo do dia a dia.
const TIPO_CRED_WHATSAPP = 'WHATSAPP_CLOUD_TOKEN';

function gerarVerifyToken() {
  let s = '';
  const arr = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  for (const b of arr) s += b.toString(16).padStart(2, '0');
  return s;
}

export default function BotsClientePage() {
  const toast = useToast();
  const [bot, setBot] = useState(null);
  const [credenciais, setCredenciais] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  const [conexaoAberta, setConexaoAberta] = useState(false);
  const [conexao, setConexao] = useState({ credencialCanalId: '', identificadorCanal: '', verifyTokenCanal: '' });
  const [novaFaq, setNovaFaq] = useState({ pergunta: '', resposta: '', palavrasChave: '' });
  const [editandoChaves, setEditandoChaves] = useState({}); // { [faqId]: texto em edicao }

  const carregar = async () => {
    setCarregando(true);
    try {
      const [bots, creds, listaFaq] = await Promise.all([
        api.get('/bots').then((r) => r.data).catch(() => []),
        credenciaisService.listar().catch(() => []),
        faqService.listar().catch(() => []),
      ]);
      const b = Array.isArray(bots) ? bots[0] : null;
      setBot(b || null);
      setCredenciais(creds || []);
      setFaqs(listaFaq || []);
      if (b) {
        setConexao({
          credencialCanalId: b.credencialCanalId || '',
          identificadorCanal: b.identificadorCanal || '',
          verifyTokenCanal: b.verifyTokenCanal || '',
        });
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
  }, []);

  const credsWhatsapp = credenciais.filter((c) => c.tipo === TIPO_CRED_WHATSAPP);
  const online = bot?.status === 'ONLINE';
  // Rota compartilhada por todos os bots (nao tem segmento de botId) — quem
  // identifica o bot e o verify token (na verificacao) e o phoneNumberId (nas
  // mensagens). Ver backend/src/routes/webhooksWhatsapp.routes.js.
  const urlWebhook = `${urlPublica()}/webhooks/whatsapp`;

  const copiar = (texto, label) => {
    navigator.clipboard?.writeText(texto).then(
      () => toast.success(`${label} copiado.`),
      () => toast.error('Falha ao copiar.'),
    );
  };

  const criarBot = async () => {
    try {
      const r = await api.post('/bots', { nome: 'WhatsApp', canal: 'WHATSAPP' });
      setBot(r.data);
      toast.success('Bot criado. Configure a conexao na engrenagem.');
      setConexaoAberta(true);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao criar bot.');
    }
  };

  const salvarCanal = async () => {
    if (!bot) return;
    setSalvandoCanal(true);
    try {
      const r = await api.patch(`/bots/${bot.id}/canal`, {
        canal: 'WHATSAPP',
        credencialCanalId: conexao.credencialCanalId || null,
        identificadorCanal: conexao.identificadorCanal.trim() || null,
        verifyTokenCanal: conexao.verifyTokenCanal.trim() || null,
      });
      setBot((b) => ({ ...b, ...r.data }));
      toast.success('Conexao salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar conexao.');
    } finally {
      setSalvandoCanal(false);
    }
  };

  const alternarStatus = async () => {
    if (!bot) return;
    const novo = online ? 'OFFLINE' : 'ONLINE';
    try {
      const r = await api.patch(`/bots/${bot.id}/status`, { status: novo });
      setBot((b) => ({ ...b, ...r.data }));
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao mudar status.');
    }
  };

  const adicionarFaq = async () => {
    if (!novaFaq.pergunta.trim() || !novaFaq.resposta.trim()) return toast.error('Preencha pergunta e resposta.');
    try {
      const palavrasChave = novaFaq.palavrasChave
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const f = await faqService.criar({
        pergunta: novaFaq.pergunta, resposta: novaFaq.resposta, ordem: faqs.length, palavrasChave,
      });
      setFaqs((l) => [...l, f]);
      setNovaFaq({ pergunta: '', resposta: '', palavrasChave: '' });
      toast.success('Pergunta adicionada.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao adicionar.');
    }
  };

  const alternarFaqAtivo = async (f) => {
    try {
      const at = await faqService.atualizar(f.id, { ativo: !f.ativo });
      setFaqs((l) => l.map((x) => (x.id === f.id ? at : x)));
    } catch {
      toast.error('Falha ao atualizar.');
    }
  };

  const salvarChaves = async (f) => {
    const texto = editandoChaves[f.id] ?? '';
    const palavrasChave = texto.split(',').map((p) => p.trim()).filter(Boolean);
    try {
      const at = await faqService.atualizar(f.id, { palavrasChave });
      setFaqs((l) => l.map((x) => (x.id === f.id ? at : x)));
      setEditandoChaves((e) => { const n = { ...e }; delete n[f.id]; return n; });
      toast.success('Palavras-chave salvas.');
    } catch {
      toast.error('Falha ao salvar palavras-chave.');
    }
  };

  const excluirFaq = async (f) => {
    if (!window.confirm(`Excluir "${f.pergunta}"?`)) return;
    try {
      await faqService.excluir(f.id);
      setFaqs((l) => l.filter((x) => x.id !== f.id));
    } catch {
      toast.error('Falha ao excluir.');
    }
  };

  if (carregando) {
    return <div className="text-sm text-[var(--text-muted)] py-10 text-center">Carregando...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Bot WhatsApp</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Configure o atendimento automatico por menu (sem IA): o bot responde com base
            nas perguntas e respostas abaixo.
          </p>
        </div>
        {bot && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={online ? 'success' : 'neutral'} size="sm">
              {online ? <Wifi size={12} /> : <WifiOff size={12} />} {online ? 'Online' : 'Offline'}
            </Badge>
            <IconButton
              icon={Settings} variant="secondary" size="sm" ariaLabel="Conexao do WhatsApp"
              onClick={() => setConexaoAberta(true)}
            />
          </div>
        )}
      </div>

      {!bot ? (
        <Card padding="md">
          <EmptyState
            icon={BotIcon}
            title="Nenhum bot ainda"
            description="Crie o bot do seu WhatsApp para comecar a configurar a conexao e o atendimento."
            action={<Button variant="primary" icon={Plus} onClick={criarBot}>Criar bot</Button>}
          />
        </Card>
      ) : (
        <Card padding="md">
          <CardHeader>
            <div>
              <CardTitle>Atendimento automatico (FAQ)</CardTitle>
              <CardDescription>Perguntas e respostas que viram o menu do bot. Sem IA.</CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
            <Input
              label="Pergunta"
              value={novaFaq.pergunta}
              onChange={(e) => setNovaFaq({ ...novaFaq, pergunta: e.target.value })}
              placeholder="Ex: Qual o horario?"
            />
            <Input
              label="Resposta"
              value={novaFaq.resposta}
              onChange={(e) => setNovaFaq({ ...novaFaq, resposta: e.target.value })}
              placeholder="Ex: Seg a Sex, 9h as 18h."
            />
            <Input
              label="Palavras-chave (opcional)"
              value={novaFaq.palavrasChave}
              onChange={(e) => setNovaFaq({ ...novaFaq, palavrasChave: e.target.value })}
              placeholder="horario, abre, fecha"
              hint="Separe por virgula. O bot tambem responde se o cliente usar essas palavras."
            />
            <Button variant="secondary" icon={Plus} onClick={adicionarFaq}>Adicionar</Button>
          </div>

          {faqs.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={MessageCircle}
                title="Sem perguntas ainda"
                description="Adicione a primeira pergunta para o bot comecar a responder."
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)] mt-4">
              {faqs.map((f) => (
                <div key={f.id} className="py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[var(--text-main)]">{f.pergunta}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">{f.resposta}</div>
                    </div>
                    <button
                      type="button"
                      className="text-xs hover:underline"
                      onClick={() => alternarFaqAtivo(f)}
                    >
                      <Badge variant={f.ativo ? 'success' : 'neutral'} size="sm">{f.ativo ? 'Ativa' : 'Inativa'}</Badge>
                    </button>
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => excluirFaq(f)}>Excluir</Button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 max-w-md">
                    <Input
                      size="sm"
                      placeholder="Palavras-chave (separadas por virgula)"
                      value={editandoChaves[f.id] ?? (f.palavrasChave || []).join(', ')}
                      onChange={(e) => setEditandoChaves((s) => ({ ...s, [f.id]: e.target.value }))}
                      onBlur={() => { if (editandoChaves[f.id] !== undefined) salvarChaves(f); }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Drawer
        isOpen={conexaoAberta}
        onClose={() => setConexaoAberta(false)}
        title="Conexao do WhatsApp"
        description="Numero, verify token e credencial do canal — mexe uma vez, na configuracao."
      >
        <div className="space-y-5">
          <div className="space-y-4">
            <Input
              label="Phone Number ID"
              value={conexao.identificadorCanal}
              onChange={(e) => setConexao({ ...conexao, identificadorCanal: e.target.value })}
              placeholder="Ex: 1290672074119010"
              hint="Vem do painel da Meta (Identificacao do numero de telefone). Obrigatorio: sem ele, mensagens recebidas nao chegam ao bot."
            />
            <Select
              label="Credencial (token do canal)"
              value={conexao.credencialCanalId}
              onChange={(e) => setConexao({ ...conexao, credencialCanalId: e.target.value })}
              options={[
                { value: '', label: credsWhatsapp.length ? 'Selecione...' : 'Nenhuma credencial WhatsApp' },
                ...credsWhatsapp.map((c) => ({ value: c.id, label: c.nome })),
              ]}
              hint={credsWhatsapp.length === 0 ? 'Cadastre a integracao do WhatsApp com o administrador.' : undefined}
            />
            <div>
              <Input
                label="Verify token"
                value={conexao.verifyTokenCanal}
                onChange={(e) => setConexao({ ...conexao, verifyTokenCanal: e.target.value })}
                placeholder="Use no painel da Meta ao configurar o webhook"
              />
              <button
                type="button"
                className="text-xs text-[var(--accent)] mt-1 hover:underline"
                onClick={() => setConexao({ ...conexao, verifyTokenCanal: gerarVerifyToken() })}
              >
                Gerar verify token
              </button>
            </div>
          </div>

          <div className="border-t border-[var(--border-main)] pt-4">
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
              Callback URL (cole no painel da Meta)
            </label>
            <div className="flex gap-1.5">
              <Input value={urlWebhook} readOnly />
              <IconButton
                icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar URL"
                onClick={() => copiar(urlWebhook, 'URL')}
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Essa URL e a mesma pra todo mundo — o que identifica o seu bot e o verify token acima.
            </p>
          </div>

          <div className="border-t border-[var(--border-main)] pt-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-main)]">Status do bot</div>
              <div className="text-xs text-[var(--text-muted)]">{online ? 'Online' : 'Offline'}</div>
            </div>
            <Button variant={online ? 'secondary' : 'primary'} size="sm" onClick={alternarStatus}>
              {online ? 'Desligar' : 'Ligar'}
            </Button>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <Button variant="primary" onClick={salvarCanal} loading={salvandoCanal}>Salvar conexao</Button>
        </div>
      </Drawer>
    </div>
  );
}
