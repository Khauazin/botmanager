import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Moon, Upload, ImageIcon, Trash2, Save, ShieldCheck,
  Building2, ChevronRight, AlertCircle, Clock, Bell
} from 'lucide-react';
import api from '../services/api';
import notificacaoService from '../services/notificacaoService';
import catalogoService from '../services/catalogoService';
import devolucaoService from '../services/devolucaoService';
import SellergyLogo from '../components/SellergyLogo';
import { useAuthStore } from '../store/auth.store';
import { useUiStore } from '../store/ui.store';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Select, Badge,
  Tabs, TabsList, TabsTrigger, TabsContent, useToast, Switch
} from '../components/ui';

const MAX_LOGO_SIZE = 1024 * 1024; // 1 MB

/**
 * Configuracoes do CLIENTE.
 *
 * Abas compactas:
 *  - Aparencia: tema (light/dark) + branding (logo + nome customizado)
 *  - Operacao: horario de funcionamento da loja (usado pelo cron do caixa)
 *  - Catalogo: layout do PDF que o bot envia (template, cor, agrupamento)
 *  - Notificacoes: preferencias de aviso
 *  - Conta: links pra Perfil, Equipe, Permissoes
 *  - Plano: modulos liberados
 *
 * IMPORTANTE: a edicao da identidade visual (logo + nome) eh diferente
 * de "Meu perfil" (foto + dados pessoais).
 */
export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, refreshUser } = useAuthStore();
  const { theme, setTheme } = useUiStore();

  const [tab, setTab] = useState('aparencia');
  const podeEditarOperacao = user?.perfil === 'CLIENT' || user?.perfil === 'ADMINISTRADOR';
  const podeVerCatalogo = !!user?.modulosLiberados?.CATALOGO;

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="pills">
          <TabsTrigger value="aparencia" variant="pills">Aparencia</TabsTrigger>
          <TabsTrigger value="operacao" variant="pills">Operacao</TabsTrigger>
          <TabsTrigger value="catalogo" variant="pills">Catálogo</TabsTrigger>
          <TabsTrigger value="notificacoes" variant="pills">Notificações</TabsTrigger>
          <TabsTrigger value="conta" variant="pills">Conta</TabsTrigger>
          <TabsTrigger value="plano" variant="pills">Plano</TabsTrigger>
        </TabsList>

        <TabsContent value="aparencia" className="mt-5 space-y-5">
          <BlocoTema theme={theme} setTheme={setTheme} />
          {user?.perfil === 'CLIENT' ? (
            <BlocoBranding user={user} refreshUser={refreshUser} toast={toast} />
          ) : (
            <Card padding="lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  Apenas o dono da conta pode personalizar a marca da plataforma.
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="operacao" className="mt-5 space-y-5">
          {podeEditarOperacao ? (
            <>
              <BlocoHorarioFuncionamento user={user} refreshUser={refreshUser} toast={toast} />
              <BlocoDevolucao toast={toast} />
            </>
          ) : (
            <Card padding="lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  Apenas o dono da conta ou administradores podem alterar o horario de funcionamento.
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="catalogo" className="mt-5 space-y-5">
          {podeVerCatalogo ? (
            <BlocoCatalogo toast={toast} />
          ) : (
            <Card padding="lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  O modulo de Catalogo nao esta liberado para sua conta. Fale com o administrador.
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-5 space-y-5">
          <BlocoNotificacoes toast={toast} />
        </TabsContent>

        <TabsContent value="conta" className="mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ConfigLink icon={ShieldCheck} titulo="Equipe" descricao="Cadastrar colaboradores e especialistas, e definir permissões" onClick={() => navigate('/app/usuarios')} />
          </div>
        </TabsContent>

        <TabsContent value="plano" className="mt-5">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Modulos do plano</CardTitle>
                <CardDescription>Modulos liberados pelo administrador para sua conta.</CardDescription>
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(user?.modulosLiberados || {}).map(([modulo, liberado]) => (
                <div key={modulo} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  liberado ? 'border-[var(--success-soft)] bg-[var(--success-soft)]/30' : 'border-[var(--border-main)] bg-[var(--bg-subtle)]/50'
                }`}>
                  <span className="text-xs font-semibold text-[var(--text-main)] tracking-tight">{modulo}</span>
                  <Badge variant={liberado ? 'success' : 'neutral'} size="sm">
                    {liberado ? 'Liberado' : 'Bloqueado'}
                  </Badge>
                </div>
              ))}
              {Object.keys(user?.modulosLiberados || {}).length === 0 && (
                <div className="col-span-full text-xs text-[var(--text-muted)] text-center py-4">
                  Nenhum modulo configurado. Fale com o suporte.
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BlocoTema({ theme, setTheme }) {
  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Tema</CardTitle>
          <CardDescription>Escolha como o sistema aparece pra voce.</CardDescription>
        </div>
      </CardHeader>
      <div className="grid grid-cols-2 gap-3">
        <ThemeOption value="light" current={theme} onChange={setTheme} icon={Sun} label="Claro" desc="Padrao premium light" />
        <ThemeOption value="dark" current={theme} onChange={setTheme} icon={Moon} label="Escuro" desc="Estilo Linear/Vercel" />
      </div>
    </Card>
  );
}

function BlocoBranding({ user, refreshUser, toast }) {
  const fileInput = useRef(null);
  const [logo, setLogo] = useState(user?.branding?.logo || '');
  const [nome, setNome] = useState(user?.branding?.nome || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setLogo(user?.branding?.logo || '');
    setNome(user?.branding?.nome || '');
  }, [user]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas arquivos de imagem.');
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error('Imagem muito grande. Maximo 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await api.put('/autenticacao/branding', { brandLogo: logo || null, brandNome: nome || null });
      await refreshUser();
      toast.success('Marca atualizada');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemoverLogo = () => {
    setLogo('');
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Identidade visual</CardTitle>
          <CardDescription>Personalize logo e nome que sua equipe ve no menu lateral.</CardDescription>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-5 items-start">
        <div className="flex flex-col items-center gap-2">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)] flex items-center justify-center overflow-hidden">
            {logo ? (
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={28} className="text-[var(--text-muted)] opacity-50" strokeWidth={1.5} />
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button variant="ghost" size="sm" icon={Upload} onClick={() => fileInput.current?.click()}>
            Enviar
          </Button>
          {logo && (
            <button
              type="button"
              onClick={handleRemoverLogo}
              className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-muted)] hover:text-[var(--danger)] flex items-center gap-1"
            >
              <Trash2 size={10} /> Remover
            </button>
          )}
        </div>

        <div className="space-y-3">
          <Input
            label="Nome customizado"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Boutique Bella, Barbearia do Joao"
            hint="Substitui 'Sellergy Cloud' no menu lateral. Deixe em branco para usar o padrao."
          />

          <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Pre-visualizacao</div>
            <div className="flex items-center gap-2 mt-2">
              {logo ? (
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <SellergyLogo size={32} className="flex-shrink-0" />
              )}
              <div>
                <div className="text-sm font-semibold text-[var(--text-main)]">{nome || 'Sellergy Cloud'}</div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Plataforma</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" icon={Save} onClick={handleSalvar} loading={salvando}>
              Salvar marca
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Configura o horario de funcionamento da loja. Usado pelo cron diario do
// caixa (00:01) e por outras automacoes. Persiste em Cliente.horarioFuncionamento.
const DIAS_SEMANA = [
  { valor: 0, label: 'Dom', completo: 'Domingo' },
  { valor: 1, label: 'Seg', completo: 'Segunda' },
  { valor: 2, label: 'Ter', completo: 'Terca' },
  { valor: 3, label: 'Qua', completo: 'Quarta' },
  { valor: 4, label: 'Qui', completo: 'Quinta' },
  { valor: 5, label: 'Sex', completo: 'Sexta' },
  { valor: 6, label: 'Sab', completo: 'Sabado' },
];

function BlocoHorarioFuncionamento({ user, refreshUser, toast }) {
  const horarioAtual = user?.horarioFuncionamento || {};
  const [abertura, setAbertura] = useState(horarioAtual.abertura || '08:00');
  const [fechamento, setFechamento] = useState(horarioAtual.fechamento || '18:00');
  const [dias, setDias] = useState(
    Array.isArray(horarioAtual.dias) ? horarioAtual.dias : [1, 2, 3, 4, 5, 6]
  );
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const h = user?.horarioFuncionamento || {};
    setAbertura(h.abertura || '08:00');
    setFechamento(h.fechamento || '18:00');
    setDias(Array.isArray(h.dias) ? h.dias : [1, 2, 3, 4, 5, 6]);
  }, [user]);

  const toggleDia = (valor) => {
    setDias((atual) =>
      atual.includes(valor) ? atual.filter((d) => d !== valor) : [...atual, valor].sort()
    );
  };

  const handleSalvar = async () => {
    if (dias.length === 0) {
      toast.error('Selecione ao menos um dia de funcionamento.');
      return;
    }
    if (abertura >= fechamento) {
      toast.error('Horario de fechamento deve ser depois da abertura.');
      return;
    }
    setSalvando(true);
    try {
      await api.put('/autenticacao/horario-funcionamento', { abertura, fechamento, dias });
      await refreshUser();
      toast.success('Horario atualizado');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Horario de funcionamento</CardTitle>
          <CardDescription>
            Define quando a loja esta aberta. O bot do WhatsApp opera 24h, mas o caixa
            automatico fecha e reabre as 00:01 todos os dias.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Abertura"
            type="time"
            value={abertura}
            onChange={(e) => setAbertura(e.target.value)}
          />
          <Input
            label="Fechamento"
            type="time"
            value={fechamento}
            onChange={(e) => setFechamento(e.target.value)}
          />
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Dias de funcionamento
          </div>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((dia) => {
              const ativo = dias.includes(dia.valor);
              return (
                <button
                  key={dia.valor}
                  type="button"
                  onClick={() => toggleDia(dia.valor)}
                  title={dia.completo}
                  className={`px-4 py-2 rounded-lg border-2 text-xs font-semibold uppercase tracking-tight transition-colors ${
                    ativo
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40 text-[var(--accent)]'
                      : 'border-[var(--border-main)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  {dia.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[var(--bg-subtle)] rounded-xl p-3 flex items-start gap-2">
          <Clock size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--text-muted)] leading-relaxed">
            O caixa automatico do bot (vendas via WhatsApp) e fechado e reaberto todos os
            dias as 00:01, com o fundo igual ao saldo final do dia anterior. O caixa manual
            so e tocado pelo usuario.
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" icon={Save} onClick={handleSalvar} loading={salvando}>
            Salvar horario
          </Button>
        </div>
      </div>
    </Card>
  );
}

// =====================================================================
// Catalogo — layout do PDF gerado pelo bot (ver services/catalogoPdf.js e
// a ferramenta CATALOGO em iaFerramentas). Persiste em ConfiguracaoCatalogo,
// 1 registro por tenant.
// =====================================================================
const REGEX_COR_HEX = /^#[0-9a-fA-F]{6}$/;

const TEMPLATES_CATALOGO = [
  { valor: 'FOTOS_GRANDES', titulo: 'Fotos grandes', descricao: 'Uma foto por linha — bom pra poucos produtos com apelo visual.' },
  { valor: 'LISTA_COMPACTA', titulo: 'Lista compacta', descricao: 'Varios itens por pagina — ideal pra catalogos com muitos produtos.' },
  { valor: 'MINIMALISTA', titulo: 'Minimalista', descricao: 'So nome e preco, sem foto — rapido de gerar e ler.' },
];

const CONFIG_CATALOGO_PADRAO = {
  template: 'FOTOS_GRANDES',
  corDestaque: '#2563EB',
  agruparPor: 'CATEGORIA',
  mostrarPreco: true,
  mostrarFoto: true,
  mostrarDescricao: true,
  ocultarSemEstoque: true,
};

function BlocoCatalogo({ toast }) {
  const [config, setConfig] = useState(CONFIG_CATALOGO_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    catalogoService.obterConfig()
      .then((r) => setConfig(r ? { ...CONFIG_CATALOGO_PADRAO, ...r } : CONFIG_CATALOGO_PADRAO))
      .catch(() => toast.error('Nao foi possivel carregar a configuracao do catalogo.'))
      .finally(() => setCarregando(false));
  }, [toast]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const atualizado = await catalogoService.salvarConfig({
        template: config.template,
        corDestaque: config.corDestaque,
        agruparPor: config.agruparPor,
        mostrarPreco: config.mostrarPreco,
        mostrarFoto: config.mostrarFoto,
        mostrarDescricao: config.mostrarDescricao,
        ocultarSemEstoque: config.ocultarSemEstoque,
      });
      setConfig({ ...CONFIG_CATALOGO_PADRAO, ...atualizado });
      toast.success('Layout do catalogo atualizado.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <Card padding="lg">
        <div className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando…</div>
      </Card>
    );
  }

  const corValida = REGEX_COR_HEX.test(config.corDestaque) ? config.corDestaque : '#2563EB';

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Layout do catalogo em PDF</CardTitle>
          <CardDescription>
            Como o catalogo enviado pelo bot no WhatsApp e organizado e exibido pro cliente final.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="space-y-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Modelo
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TEMPLATES_CATALOGO.map((t) => {
              const ativo = config.template === t.valor;
              return (
                <button
                  key={t.valor}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, template: t.valor }))}
                  className={`p-4 rounded-xl border-2 transition-colors text-left ${
                    ativo ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40' : 'border-[var(--border-main)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--text-main)]">{t.titulo}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{t.descricao}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
              Cor de destaque
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={corValida}
                onChange={(e) => setConfig((c) => ({ ...c, corDestaque: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-[var(--border-main)] cursor-pointer bg-transparent flex-shrink-0"
                aria-label="Cor de destaque do catalogo"
              />
              <Input
                value={config.corDestaque}
                onChange={(e) => setConfig((c) => ({ ...c, corDestaque: e.target.value }))}
                placeholder="#2563EB"
              />
            </div>
          </div>

          <Select
            label="Agrupar produtos por"
            value={config.agruparPor}
            onChange={(e) => setConfig((c) => ({ ...c, agruparPor: e.target.value }))}
            options={[
              { value: 'CATEGORIA', label: 'Categoria' },
              { value: 'NENHUM', label: 'Sem agrupamento' },
            ]}
          />
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            O que aparece no catalogo
          </div>
          <div className="space-y-2">
            <TogglePreferenciaCatalogo
              label="Preco"
              descricao="Mostra o valor de cada produto."
              checked={config.mostrarPreco}
              onChange={(v) => setConfig((c) => ({ ...c, mostrarPreco: v }))}
            />
            <TogglePreferenciaCatalogo
              label="Foto"
              descricao={
                config.template === 'MINIMALISTA'
                  ? 'O modelo Minimalista nunca mostra foto, mesmo com esta opcao ligada.'
                  : 'Mostra a imagem cadastrada do produto.'
              }
              checked={config.mostrarFoto}
              disabled={config.template === 'MINIMALISTA'}
              onChange={(v) => setConfig((c) => ({ ...c, mostrarFoto: v }))}
            />
            <TogglePreferenciaCatalogo
              label="Descricao"
              descricao={
                config.template === 'MINIMALISTA'
                  ? 'O modelo Minimalista nunca mostra descricao, mesmo com esta opcao ligada.'
                  : 'Mostra o texto de descricao do produto, quando existir.'
              }
              checked={config.mostrarDescricao}
              disabled={config.template === 'MINIMALISTA'}
              onChange={(v) => setConfig((c) => ({ ...c, mostrarDescricao: v }))}
            />
          </div>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Regras do catalogo
          </div>
          <div className="space-y-2">
            <TogglePreferenciaCatalogo
              label="Ocultar produtos sem estoque"
              descricao="Produtos fisicos com estoque zerado nao aparecem no catalogo enviado pelo bot. Servicos nao sao afetados (nao controlam estoque)."
              checked={config.ocultarSemEstoque}
              onChange={(v) => setConfig((c) => ({ ...c, ocultarSemEstoque: v }))}
            />
          </div>
        </div>

        <div className="border-t border-[var(--border-main)] pt-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Pre-visualizacao
          </div>
          <div className="rounded-xl border border-[var(--border-main)] overflow-hidden bg-white">
            <div className="p-3" style={{ borderBottom: `3px solid ${corValida}` }}>
              <div className="text-xs font-bold" style={{ color: corValida }}>Sua Loja</div>
            </div>
            <div className="p-3 space-y-2">
              {config.template !== 'MINIMALISTA' && config.agruparPor === 'CATEGORIA' && (
                <div className="text-[10px] font-bold uppercase text-gray-500">Categoria exemplo</div>
              )}
              <div className={`flex gap-2 ${config.template === 'LISTA_COMPACTA' ? 'items-center' : 'items-start'}`}>
                {config.mostrarFoto && config.template !== 'MINIMALISTA' && (
                  <div className={`bg-gray-200 rounded flex-shrink-0 ${config.template === 'FOTOS_GRANDES' ? 'w-16 h-16' : 'w-8 h-8'}`} />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-800">Produto exemplo</div>
                  {config.mostrarDescricao && config.template !== 'MINIMALISTA' && (
                    <div className="text-[10px] text-gray-500">Descricao curta do produto</div>
                  )}
                  {config.mostrarPreco && (
                    <div className="text-[10px] font-bold text-gray-700 mt-0.5">R$ 49,90</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" icon={Save} onClick={handleSalvar} loading={salvando}>
            Salvar layout
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TogglePreferenciaCatalogo({ label, descricao, checked, onChange, disabled = false }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)]/40 ${disabled ? 'opacity-70' : ''}`}>
      <div>
        <div className="text-sm font-semibold text-[var(--text-main)]">{label}</div>
        <div className="text-xs text-[var(--text-muted)]">{descricao}</div>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </div>
  );
}

// =====================================================================
// Devolucao — aviso de aluguel prestes a vencer (bot + alerta na plataforma).
// So o "quantos dias antes" mora aqui; o "este produto e alugado" fica no
// cadastro do produto (Estoque), e a lista de devolucoes pendentes tem tela
// propria (app/devolucoes).
// =====================================================================
function BlocoDevolucao({ toast }) {
  const [dias, setDias] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    devolucaoService.obterConfig()
      .then((r) => setDias(r?.diasAvisoDevolucao ?? 1))
      .catch(() => toast.error('Não foi possível carregar a configuração de devolução.'))
      .finally(() => setCarregando(false));
  }, [toast]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const r = await devolucaoService.salvarConfig({ diasAvisoDevolucao: parseInt(dias, 10) || 0 });
      setDias(r.diasAvisoDevolucao);
      toast.success('Configuração de devolução salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <Card padding="lg">
        <div className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando…</div>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Aviso de devolução (aluguel)</CardTitle>
          <CardDescription>
            Produtos marcados como "alugado" no Estoque avisam o cliente e geram alerta aqui
            quando a devolução se aproxima.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="flex items-end gap-3">
        <div className="max-w-[180px]">
          <Input
            label="Avisar quantos dias antes"
            type="number"
            min="0"
            max="30"
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            hint="0 = avisa só no próprio dia da devolução."
          />
        </div>
        <Button variant="primary" icon={Save} onClick={handleSalvar} loading={salvando}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}

function ThemeOption({ value, current, onChange, icon: Icon, label, desc }) {
  const ativo = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`p-4 rounded-xl border-2 transition-colors text-left ${
        ativo ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40' : 'border-[var(--border-main)] hover:border-[var(--text-muted)]'
      }`}
    >
      <Icon size={18} className={ativo ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} strokeWidth={1.75} />
      <div className="text-sm font-semibold text-[var(--text-main)] mt-2">{label}</div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</div>
    </button>
  );
}

function ConfigLink({ icon: Icon, titulo, descricao, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex flex-col items-start gap-3 p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-[var(--accent)] hover:bg-[var(--bg-subtle)]/50 transition-colors text-left h-full"
    >
      <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)] transition-colors">
        <Icon size={18} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight flex items-center gap-1">
          {titulo}
          <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all" />
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{descricao}</div>
      </div>
    </button>
  );
}

// =====================================================================
// Notificações — opt-in por tipo
// =====================================================================
// Lista todos os tipos disponíveis com switch. Toggle salva direto no
// backend (PUT /notificacoes/preferencias/:tipo). Sem botão "Salvar"
// porque cada mudança é independente.

const ROTULOS_NOTIFICACAO = {
  LEMBRETE_FECHAMENTO_MES: {
    titulo: 'Lembrete do fechamento do mês',
    descricao: 'Avisos para você lançar suas despesas e fechar as vendas antes do dia 7.',
  },
  RELATORIO_MENSAL_PRONTO: {
    titulo: 'Relatório mensal pronto',
    descricao: 'Mostra quando o relatório de fechamento do mês anterior está disponível.',
  },
  CAIXA_AUTO_FECHADO: {
    titulo: 'Caixa automático fechado',
    descricao: 'Confirma quando o sistema fecha sozinho o caixa do bot (à meia-noite).',
  },
  CAIXA_DIVERGENCIA: {
    titulo: 'Divergência no fechamento do caixa',
    descricao: 'Alerta quando o saldo contado é diferente do saldo esperado.',
  },
  CONTA_PAGAR_VENCENDO: {
    titulo: 'Conta a pagar vencendo',
    descricao: 'Lembrete dos dias antes do vencimento das contas cadastradas.',
  },
  DEVOLUCAO_PROXIMA: {
    titulo: 'Devolução de aluguel próxima',
    descricao: 'Avisa quando um produto alugado está perto (ou passou) da data de devolução.',
  },
  GENERICA: {
    titulo: 'Avisos diversos',
    descricao: 'Mensagens gerais que não se encaixam nas outras categorias.',
  },
};

function BlocoNotificacoes({ toast }) {
  const [preferencias, setPreferencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState({}); // mapa tipo -> bool

  useEffect(() => {
    notificacaoService.listarPreferencias()
      .then((r) => setPreferencias(r || []))
      .catch(() => toast.error('Não foi possível carregar as preferências.'))
      .finally(() => setCarregando(false));
  }, [toast]);

  const handleToggle = async (tipo, novoValor) => {
    setSalvando((s) => ({ ...s, [tipo]: true }));
    // Otimista: atualiza UI antes da resposta.
    setPreferencias((arr) => arr.map((p) => p.tipo === tipo ? { ...p, ativa: novoValor } : p));
    try {
      await notificacaoService.atualizarPreferencia(tipo, novoValor);
    } catch {
      // Reverte se der erro.
      setPreferencias((arr) => arr.map((p) => p.tipo === tipo ? { ...p, ativa: !novoValor } : p));
      toast.error('Não foi possível salvar essa preferência.');
    } finally {
      setSalvando((s) => ({ ...s, [tipo]: false }));
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>O que você quer receber</CardTitle>
          <CardDescription>Escolha quais notificações aparecem no sininho do topo. Você pode mudar quando quiser.</CardDescription>
        </div>
      </CardHeader>

      {carregando ? (
        <div className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando…</div>
      ) : (
        <div className="divide-y divide-[var(--border-main)]">
          {preferencias.map((p) => {
            const cfg = ROTULOS_NOTIFICACAO[p.tipo] || { titulo: p.tipo, descricao: '' };
            return (
              <div key={p.tipo} className="flex items-start justify-between gap-4 py-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
                    <Bell size={16} strokeWidth={1.75} className="text-[var(--text-secondary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-main)]">{cfg.titulo}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{cfg.descricao}</div>
                  </div>
                </div>
                <Switch
                  checked={p.ativa}
                  disabled={!!salvando[p.tipo]}
                  onChange={(v) => handleToggle(p.tipo, v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
