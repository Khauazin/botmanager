import { useEffect, useState } from 'react';
import {
  Bot as BotIcon, MessageCircle, Plus, Trash2, Wifi, WifiOff, Settings, Copy, Sparkles, Save,
  Send, Activity, Clock,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Textarea, Select, Badge, IconButton,
  EmptyState, Switch, LabelAjuda, useToast, KpiCard,
} from '../components/ui';
import Modal from '../components/Modal';
import api, { urlPublica } from '../services/api';
import credenciaisService from '../services/credenciaisService';
import faqService from '../services/faqService';

// Tela do tenant pro bot WhatsApp: quando o bot NAO tem IA (padrao pos-pivo),
// o conteudo principal e o menu de FAQ. Quando o administrador libera o
// atendimento com IA pro bot (em admin/bots), esta tela troca o FAQ pelo
// prompt/ações da IA — as duas coisas nao coexistem em runtime (ver
// webhooksWhatsapp.routes.js: com iaAtiva, o FAQ nem e consultado). A conexao
// tecnica (phoneNumberId, verify token, credencial, callback URL) fica
// escondida atras da engrenagem: mexe uma vez, na hora de configurar, e nao
// compete com o conteudo do dia a dia.
const TIPO_CRED_WHATSAPP = 'WHATSAPP_CLOUD_TOKEN';

const TAM_MAX_PROMPT_IA = 4000;

// Espelha o registro de backend/src/services/iaFerramentas — cada chave
// precisa existir la pra ser aceita pelo PUT /bots/:id.
const ACOES_BOT_DISPONIVEIS = [
  {
    chave: 'CONSULTAR_ESTOQUE',
    titulo: 'Consultar estoque e preço',
    descricao: 'O bot confere se um produto tem estoque disponível e informa o preço quando o cliente perguntar.',
  },
  {
    chave: 'COBRANCA_PIX',
    titulo: 'Gerar cobrança Pix',
    descricao: 'O bot gera um Pix quando o cliente confirmar a compra. A venda e a baixa no estoque acontecem sozinhas assim que o pagamento é confirmado.',
  },
  {
    chave: 'CATALOGO',
    titulo: 'Enviar catálogo em PDF',
    descricao: 'O bot monta e envia o catálogo completo de produtos quando o cliente pedir para ver o que a loja vende.',
  },
];

function tempoRelativo(dataIso) {
  if (!dataIso) return '—';
  const diff = (Date.now() - new Date(dataIso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ontem';
  return `há ${Math.floor(diff / 86400)} dias`;
}

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
  const [iaForm, setIaForm] = useState({ iaPromptSistema: '', acoesPermitidas: [] });
  const [salvandoIA, setSalvandoIA] = useState(false);
  const [consumoIA, setConsumoIA] = useState(null);

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
        setIaForm({
          iaPromptSistema: b.iaPromptSistema || '',
          acoesPermitidas: Array.isArray(b.acoesPermitidas) ? b.acoesPermitidas : [],
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

  // Consumo de IA do mes — so faz sentido buscar quando o bot tem IA ligada.
  useEffect(() => {
    if (!bot?.id || !bot.iaAtiva) return;
    api.get(`/bots/${bot.id}/consumo-ia`)
      .then((r) => setConsumoIA(r.data))
      .catch(() => setConsumoIA(null));
  }, [bot?.id, bot?.iaAtiva]);

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

  const alternarAcaoBot = (chave) => {
    setIaForm((f) => ({
      ...f,
      acoesPermitidas: f.acoesPermitidas.includes(chave)
        ? f.acoesPermitidas.filter((a) => a !== chave)
        : [...f.acoesPermitidas, chave],
    }));
  };

  const salvarIA = async () => {
    if (!bot) return;
    setSalvandoIA(true);
    try {
      const r = await api.put(`/bots/${bot.id}`, {
        iaPromptSistema: iaForm.iaPromptSistema.trim() || null,
        acoesPermitidas: iaForm.acoesPermitidas,
      });
      setBot((b) => ({ ...b, ...r.data }));
      toast.success('Configuração da IA salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar a configuração da IA.');
    } finally {
      setSalvandoIA(false);
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
            {bot?.iaAtiva
              ? 'Configure o que a IA sabe sobre sua empresa e o que ela pode fazer sozinha durante o atendimento.'
              : 'Configure o atendimento automatico por menu (sem IA): o bot responde com base nas perguntas e respostas abaixo.'}
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

      {bot && (
        <div className={`grid grid-cols-2 ${bot.iaAtiva ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
          <KpiCard icon={Send} color="neutral" label="Mensagens hoje" valor={bot.mensagensHoje ?? 0} />
          <KpiCard icon={MessageCircle} color="neutral" label="Total de mensagens" valor={bot.totalMensagens ?? 0} />
          <KpiCard icon={Clock} color="neutral" label="Última atividade" valor={tempoRelativo(bot.ultimaAtividadeEm)} />
          {bot.iaAtiva && (
            <KpiCard
              icon={Activity}
              color="accent"
              label="Consumo de IA (mês)"
              valor={consumoIA ? `${consumoIA.tokensUsados.toLocaleString('pt-BR')} / ${consumoIA.tokensIncluidosMes.toLocaleString('pt-BR')}` : '—'}
            />
          )}
        </div>
      )}

      {!bot ? (
        <Card padding="md">
          <EmptyState
            icon={BotIcon}
            title="Nenhum bot ainda"
            description="Crie o bot do seu WhatsApp para comecar a configurar a conexao e o atendimento."
            action={<Button variant="primary" icon={Plus} onClick={criarBot}>Criar bot</Button>}
          />
        </Card>
      ) : bot.iaAtiva ? (
        <Card padding="md">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--text-muted)]" /> Atendimento com IA
              </CardTitle>
              <CardDescription>
                Modelo: {bot.iaModelo}. A ativação/desativação da IA e o modelo usado são definidos pelo administrador.
              </CardDescription>
            </div>
          </CardHeader>

          <div className="space-y-5">
            <Textarea
              label={
                <LabelAjuda
                  texto="Informações da empresa para a IA"
                  ajuda="Escreva em texto livre: nome do negócio, horários, políticas de troca, formas de pagamento, tom de voz. A IA usa esse texto como contexto para responder o cliente com precisão."
                />
              }
              rows={8}
              value={iaForm.iaPromptSistema}
              onChange={(e) => setIaForm((f) => ({ ...f, iaPromptSistema: e.target.value.slice(0, TAM_MAX_PROMPT_IA) }))}
              placeholder="Ex: Somos a Boutique Bella, funcionamos de seg a sab das 9h as 18h. Trocas em ate 7 dias com nota fiscal. Aceitamos Pix e cartao..."
              hint={`${iaForm.iaPromptSistema.length}/${TAM_MAX_PROMPT_IA} caracteres`}
            />

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Ações que o bot pode fazer sozinho
              </div>
              <div className="space-y-2">
                {ACOES_BOT_DISPONIVEIS.map((acao) => {
                  const ativa = iaForm.acoesPermitidas.includes(acao.chave);
                  return (
                    <div
                      key={acao.chave}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border ${
                        ativa ? 'border-[var(--success-soft)] bg-[var(--success-soft)]/20' : 'border-[var(--border-main)] bg-[var(--bg-subtle)]/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-main)]">{acao.titulo}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{acao.descricao}</div>
                      </div>
                      <Switch checked={ativa} onChange={() => alternarAcaoBot(acao.chave)} ariaLabel={acao.titulo} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" icon={Save} onClick={salvarIA} loading={salvandoIA}>
                Salvar configuração da IA
              </Button>
            </div>
          </div>
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

      <Modal
        isOpen={conexaoAberta}
        onClose={() => setConexaoAberta(false)}
        title="Conexao do WhatsApp"
        description="Numero, verify token e credencial do canal — mexe uma vez, na configuracao."
        size="lg"
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
      </Modal>
    </div>
  );
}
