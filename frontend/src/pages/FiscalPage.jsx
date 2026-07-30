import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt, Plus, RefreshCw, FileText, FileX, Clock as ClockIcon, Download, Lock, Trash2,
  FileSpreadsheet, Store, Pencil,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Badge, EmptyState,
  Input, Select, Drawer, useToast, LabelAjuda, KpiCard,
} from '../components/ui';
import fiscalService from '../services/fiscalService';
import credenciaisService from '../services/credenciaisService';
import catalogoService from '../services/catalogoService';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ITEM_EMIT = { variacaoId: '', quantidade: '1', ncm: '', cfop: '', cest: '' };
const DEST_VAZIO = { nome: '', documento: '', email: '', uf: '', municipio: '' };

// Emissores suportados + o tipo de credencial exigido (espelha
// backend/src/adapters/fiscal/index.js).
const PROVEDORES = [
  { id: 'FOCUS_NFE', nome: 'Focus NFe', tipoCredencial: 'FOCUS_NFE_KEY' },
  { id: 'NUVEM_FISCAL', nome: 'Nuvem Fiscal', tipoCredencial: 'NUVEM_FISCAL_KEY' },
];
const TIPO_POR_PROVEDOR = Object.fromEntries(PROVEDORES.map((p) => [p.id, p.tipoCredencial]));

const STATUS_VARIANT = {
  PENDENTE: 'warning', PROCESSANDO: 'warning', EMITIDA: 'success',
  ERRO: 'danger', CANCELADA: 'neutral',
};

// Icone + cor do avatar de cada documento na lista — bate visualmente com o
// Badge de status ao lado, pra situacao ficar clara so de bater o olho.
const ICONE_STATUS = {
  PENDENTE: ClockIcon, PROCESSANDO: ClockIcon, EMITIDA: FileText,
  ERRO: FileX, CANCELADA: FileText,
};
const COR_ICONE_STATUS = {
  PENDENTE: 'bg-[var(--warning-soft)] text-[var(--warning-text)]',
  PROCESSANDO: 'bg-[var(--warning-soft)] text-[var(--warning-text)]',
  EMITIDA: 'bg-[var(--success-soft)] text-[var(--success-text)]',
  ERRO: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
  CANCELADA: 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
};

export default function FiscalPage() {
  const toast = useToast();
  const [credenciais, setCredenciais] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [configAtiva, setConfigAtiva] = useState(false);
  // Config ja feita: mostra so um resumo compacto, com "Editar" pra abrir o
  // formulario inteiro. Sem config ainda: formulario ja vem aberto.
  const [editandoConfig, setEditandoConfig] = useState(false);
  const [form, setForm] = useState({
    provedor: '', credencialId: '', ambiente: 'HOMOLOGACAO',
    cnpj: '', regime: '', inscricao: '', csc: '', serie: '', ativo: true,
    // Dados do emitente
    razaoSocial: '', nomeFantasia: '', inscricaoMunicipal: '', cnae: '',
    emailEmitente: '', telefoneEmitente: '',
    logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '', cep: '',
  });

  // Helper pros muitos campos de texto: {...campo('razaoSocial')}.
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [cfg, creds, docs] = await Promise.all([
        fiscalService.obterConfig().catch(() => null),
        credenciaisService.listar().catch(() => []),
        fiscalService.listarDocumentos().catch(() => []),
      ]);
      setCredenciais(creds || []);
      setDocumentos(docs || []);
      setConfigAtiva(!!(cfg?.provedor && cfg?.ativo));
      if (cfg) {
        setForm((f) => ({
          ...f,
          provedor: cfg.provedor || '',
          credencialId: cfg.credencialId || '',
          ambiente: cfg.ambiente || 'HOMOLOGACAO',
          cnpj: cfg.cnpj || '',
          regime: cfg.regime || '',
          inscricao: cfg.inscricao || '',
          csc: cfg.csc || '',
          serie: cfg.serie || '',
          ativo: cfg.ativo ?? true,
          razaoSocial: cfg.razaoSocial || '',
          nomeFantasia: cfg.nomeFantasia || '',
          inscricaoMunicipal: cfg.inscricaoMunicipal || '',
          cnae: cfg.cnae || '',
          emailEmitente: cfg.emailEmitente || '',
          telefoneEmitente: cfg.telefoneEmitente || '',
          logradouro: cfg.logradouro || '',
          numero: cfg.numero || '',
          complemento: cfg.complemento || '',
          bairro: cfg.bairro || '',
          municipio: cfg.municipio || '',
          uf: cfg.uf || '',
          cep: cfg.cep || '',
        }));
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
  }, []);

  const credenciaisDoProvedor = form.provedor
    ? credenciais.filter((c) => c.tipo === TIPO_POR_PROVEDOR[form.provedor])
    : [];

  const nomeProvedorAtual = PROVEDORES.find((p) => p.id === form.provedor)?.nome || form.provedor;

  const stats = useMemo(() => {
    const agora = new Date();
    const emitidas = documentos.filter((d) => d.status === 'EMITIDA');
    const faturadoMes = emitidas
      .filter((d) => {
        const dt = d.criadoEm ? new Date(d.criadoEm) : null;
        return dt && dt.getMonth() === agora.getMonth() && dt.getFullYear() === agora.getFullYear();
      })
      .reduce((acc, d) => acc + (d.valorTotal || 0), 0);
    return {
      total: documentos.length,
      emitidas: emitidas.length,
      comErro: documentos.filter((d) => d.status === 'ERRO').length,
      faturadoMes,
    };
  }, [documentos]);

  const salvarConfig = async () => {
    if (!form.provedor) return toast.error('Escolha um emissor.');
    setSalvando(true);
    try {
      const salvo = await fiscalService.salvarConfig(form);
      setConfigAtiva(!!(salvo?.provedor && salvo?.ativo));
      setEditandoConfig(false);
      toast.success('Configuracao fiscal salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar configuracao.');
    } finally {
      setSalvando(false);
    }
  };

  const sincronizar = async (id) => {
    try {
      const atualizado = await fiscalService.sincronizar(id);
      setDocumentos((lista) => lista.map((d) => (d.id === id ? { ...d, ...atualizado } : d)));
      toast.success('Status atualizado.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao sincronizar.');
    }
  };

  // Exporta os itens da nota em CSV (busca o detalhe pra ter os itens).
  // Neutraliza injeção de fórmula: célula iniciada com = + - @ ganha aspa.
  const exportarCsv = async (doc) => {
    try {
      const completo = await fiscalService.obterDocumento(doc.id);
      const itens = completo.itens || [];
      const safe = (c) => {
        let s = String(c ?? '');
        if (/^[=+\-@]/.test(s)) s = `'${s}`;
        return s.replace(/"/g, '""');
      };
      const linhas = [['descricao', 'quantidade', 'valor_unitario', 'valor_total']];
      itens.forEach((it) => linhas.push([it.descricao, it.quantidade, it.valorUnitario, it.valorTotal]));
      if (!itens.length) linhas.push(['(nota por valor, sem itens)', '', '', completo.valorTotal ?? '']);
      const csv = linhas.map((l) => l.map((c) => `"${safe(c)}"`).join(';')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nota-${doc.numero || doc.id.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Falha ao exportar CSV.');
    }
  };

  const aoEmitir = (novo) => {
    setDocumentos((lista) => [novo, ...lista]);
    setDrawerAberto(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/app/configuracoes" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
          Configuracoes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-2">Fiscal</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Emissao de nota via provedor (NFC-e para loja, NFS-e para servico). Configure o emissor
          e acompanhe os documentos. A emissao real depende do certificado e do ambiente.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={FileText} color="neutral" label="Documentos" valor={stats.total} />
        <KpiCard icon={FileText} color="success" label="Emitidas" valor={stats.emitidas} />
        <KpiCard icon={FileX} color="danger" label="Com erro" valor={stats.comErro} />
        <KpiCard icon={Receipt} color="neutral" label="Faturado (mês)" valor={fmtBRL(stats.faturadoMes)} />
      </div>

      {/* Config do emissor — resumo compacto quando ja configurado; formulario
          completo na primeira vez ou ao clicar "Editar". */}
      {configAtiva && !editandoConfig ? (
        <Card padding="md">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0 text-[var(--text-secondary)]">
                <Store size={18} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-main)] truncate">
                  {nomeProvedorAtual} · {form.ambiente === 'PRODUCAO' ? 'Produção' : 'Homologação'}
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {form.razaoSocial || 'Razão social não preenchida'}{form.cnpj ? ` · CNPJ ${form.cnpj}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="success" size="sm">Ativo</Badge>
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditandoConfig(true)}>Editar</Button>
            </div>
          </div>
        </Card>
      ) : (
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Emissor fiscal</CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={11} /> A nota e emitida via API de terceiro; a chave fica cifrada no cofre.
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Emissor"
            value={form.provedor}
            onChange={(e) => setForm({ ...form, provedor: e.target.value, credencialId: '' })}
            options={[
              { value: '', label: 'Selecione...' },
              ...PROVEDORES.map((p) => ({ value: p.id, label: p.nome })),
            ]}
          />
          <Select
            label="Credencial (do cofre)"
            value={form.credencialId}
            onChange={(e) => setForm({ ...form, credencialId: e.target.value })}
            disabled={!form.provedor}
            options={[
              { value: '', label: credenciaisDoProvedor.length ? 'Selecione...' : 'Nenhuma credencial compativel' },
              ...credenciaisDoProvedor.map((c) => ({ value: c.id, label: c.nome })),
            ]}
          />
          <Select
            label="Ambiente"
            value={form.ambiente}
            onChange={(e) => setForm({ ...form, ambiente: e.target.value })}
            options={[
              { value: 'HOMOLOGACAO', label: 'Homologacao (teste)' },
              { value: 'PRODUCAO', label: 'Producao' },
            ]}
          />
          <Input label="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          <Input label="Regime tributario" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })} placeholder="Simples / Presumido / Real" />
          <Input label="Inscricao estadual/municipal" value={form.inscricao} onChange={(e) => setForm({ ...form, inscricao: e.target.value })} />
          <Input label="CSC (NFC-e)" value={form.csc} onChange={(e) => setForm({ ...form, csc: e.target.value })} />
          <Input label="Serie" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="1" />
        </div>

        {form.provedor && credenciaisDoProvedor.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Este emissor ainda não tem integração configurada na sua conta.
            Fale com o administrador para ativar.
          </p>
        )}

        {/* Dados da empresa (emitente) — aparecem na nota */}
        <div className="border-t border-[var(--border-main)] mt-6 pt-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Dados da empresa (emitente)</div>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
            Aparecem na nota emitida. Exigidos só na emissão real — pode preencher aos poucos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Razao social" {...campo('razaoSocial')} />
            <Input label="Nome fantasia" {...campo('nomeFantasia')} />
            <Input label="Inscricao municipal" {...campo('inscricaoMunicipal')} />
            <Input label={<LabelAjuda texto="CNAE" ajuda="Codigo da atividade economica principal da empresa." />} {...campo('cnae')} />
            <Input label="E-mail" type="email" {...campo('emailEmitente')} />
            <Input label="Telefone" {...campo('telefoneEmitente')} />
          </div>

          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mt-5 mb-2">Endereco</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2"><Input label="Logradouro" {...campo('logradouro')} /></div>
            <Input label="Numero" {...campo('numero')} />
            <Input label="Complemento" {...campo('complemento')} />
            <Input label="Bairro" {...campo('bairro')} />
            <Input label="Municipio" {...campo('municipio')} />
            <Input label="UF" maxLength={2} {...campo('uf')} />
            <Input label="CEP" {...campo('cep')} />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--border-main)]">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativo
          </label>
          <div className="flex items-center gap-2">
            {configAtiva && (
              <Button variant="secondary" onClick={() => setEditandoConfig(false)}>Cancelar</Button>
            )}
            <Button variant="primary" onClick={salvarConfig} loading={salvando} disabled={!form.provedor}>
              Salvar configuracao
            </Button>
          </div>
        </div>
      </Card>
      )}

      {/* Documentos */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>{documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}</CardTitle>
            <CardDescription>NFC-e e NFS-e emitidas, com status e arquivos.</CardDescription>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setDrawerAberto(true)} disabled={!configAtiva} title={!configAtiva ? 'Salve a configuracao (emissor + ativo) antes de emitir' : undefined}>
            Emitir documento
          </Button>
        </CardHeader>

        {carregando ? (
          <div className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando...</div>
        ) : documentos.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhum documento ainda"
            description="Emita a primeira NFC-e ou NFS-e para acompanhar aqui."
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {documentos.map((d) => {
              const IconeStatus = ICONE_STATUS[d.status] || FileText;
              return (
              <div key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${COR_ICONE_STATUS[d.status] || 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                  <IconeStatus size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--text-main)]">
                    {d.tipo}{d.numero ? ` #${d.numero}` : ''}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {d.provedor}{d.chave ? ` · ${d.chave}` : ''}{d.mensagemErro ? ` · ${d.mensagemErro}` : ''}
                  </div>
                </div>
                {d.valorTotal != null && (
                  <span className="text-xs tabular-nums text-[var(--text-secondary)]">{fmtBRL(d.valorTotal)}</span>
                )}
                {d.urlPdf && (
                  <a href={d.urlPdf} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] inline-flex items-center gap-1 hover:underline">
                    <Download size={12} /> PDF
                  </a>
                )}
                <button onClick={() => exportarCsv(d)} className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
                  <FileSpreadsheet size={12} /> CSV
                </button>
                <Badge variant={STATUS_VARIANT[d.status] || 'neutral'} size="sm">{d.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => sincronizar(d.id)}
                  disabled={d.status === 'EMITIDA' || d.status === 'CANCELADA'}
                >
                  Sincronizar
                </Button>
              </div>
              );
            })}
          </div>
        )}
      </Card>

      <EmitirDrawer aberto={drawerAberto} onClose={() => setDrawerAberto(false)} onEmitido={aoEmitir} />
    </div>
  );
}

// --- Drawer "Emitir documento" (por produtos, com toggle venda/custo) ---
function EmitirDrawer({ aberto, onClose, onEmitido }) {
  const toast = useToast();
  const [variacoes, setVariacoes] = useState([]); // { value, label, preco, precoCusto }
  const [form, setForm] = useState({ tipo: 'NFCE', base: 'VENDA', descricao: '', fiscalOn: false, dest: { ...DEST_VAZIO } });
  const [itens, setItens] = useState([{ ...ITEM_EMIT }]);
  const [enviando, setEnviando] = useState(false);
  const setDest = (k, val) => setForm((f) => ({ ...f, dest: { ...f.dest, [k]: val } }));

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    (async () => {
      const prods = await catalogoService.listar().catch(() => []);
      if (!vivo) return;
      const flat = [];
      (Array.isArray(prods) ? prods : []).forEach((p) => (p.variacoes || []).forEach((v) => {
        const ehPadrao = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
        flat.push({
          value: v.id,
          label: ehPadrao ? p.nome : `${p.nome} — ${v.nome}`,
          preco: Number(v.preco || 0),
          precoCusto: Number(v.precoCusto || 0),
        });
      }));
      setVariacoes(flat);
      setForm({ tipo: 'NFCE', base: 'VENDA', descricao: '', fiscalOn: false, dest: { ...DEST_VAZIO } });
      setItens([{ ...ITEM_EMIT }]);
    })();
    return () => { vivo = false; };
  }, [aberto]);

  const mapaVar = useMemo(() => Object.fromEntries(variacoes.map((v) => [v.value, v])), [variacoes]);
  const unitDe = (variacaoId) => {
    const v = mapaVar[variacaoId];
    if (!v) return 0;
    return form.base === 'CUSTO' ? v.precoCusto : v.preco;
  };

  const setItem = (i, k, val) => setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: val } : it)));
  const addItem = () => setItens((arr) => [...arr, { ...ITEM_EMIT }]);
  const removeItem = (i) => setItens((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const total = useMemo(
    () => itens.reduce((s, it) => s + unitDe(it.variacaoId) * (parseFloat(it.quantidade) || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itens, form.base, mapaVar],
  );

  const emitir = async () => {
    const validos = itens.filter((it) => it.variacaoId && parseFloat(it.quantidade) > 0);
    if (validos.length === 0) return toast.error('Selecione ao menos um produto com quantidade.');
    if (total <= 0) return toast.error('O total ficou zero. No modo Custo, produtos sem custo ficam em R$ 0 — use Venda.');
    setEnviando(true);
    try {
      const d = form.dest;
      const temDest = d.nome || d.documento || d.email || d.uf || d.municipio;
      const novo = await fiscalService.emitir({
        tipo: form.tipo,
        baseValor: form.base,
        descricao: form.descricao || undefined,
        itens: validos.map((it) => ({
          variacaoId: it.variacaoId,
          quantidade: parseInt(it.quantidade, 10),
          ncm: it.ncm || undefined,
          cfop: it.cfop || undefined,
          cest: it.cest || undefined,
        })),
        destinatario: temDest ? d : undefined,
      });
      onEmitido(novo);
      toast.success('Documento enviado para emissao.');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao emitir.');
    } finally {
      setEnviando(false);
    }
  };

  const opcoes = [{ value: '', label: 'Selecione o produto...' }, ...variacoes];

  return (
    <Drawer
      isOpen={aberto}
      onClose={onClose}
      size="xl"
      title="Emitir documento"
      description="Selecione os produtos; o valor unitário sai travado do catálogo."
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-[var(--text-secondary)]">
            Total: <strong className="text-[var(--text-main)] tabular-nums">{fmtBRL(total)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={emitir} loading={enviando}>Emitir</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            options={[{ value: 'NFCE', label: 'NFC-e (loja/varejo)' }, { value: 'NFSE', label: 'NFS-e (servico)' }]}
          />
          <div>
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
              <LabelAjuda texto="Valor que sai na nota" ajuda="Venda = preço de revenda. Custo = preço de compra (ex.: remessa/transferência)." />
            </label>
            <div className="flex rounded-lg border border-[var(--border-main)] overflow-hidden h-11">
              {[['VENDA', 'Preço de venda'], ['CUSTO', 'Preço de custo']].map(([val, lab]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm({ ...form, base: val })}
                  className={`flex-1 text-sm font-medium transition-colors ${form.base === val ? 'bg-[var(--primary)] text-[var(--text-on-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'}`}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">Produtos</span>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input type="checkbox" checked={form.fiscalOn} onChange={(e) => setForm({ ...form, fiscalOn: e.target.checked })} />
                Dados fiscais (NCM/CFOP)
              </label>
              <Button variant="ghost" size="sm" icon={Plus} onClick={addItem}>Adicionar</Button>
            </div>
          </div>
          <div className="space-y-2">
            {itens.map((it, i) => {
              const unit = unitDe(it.variacaoId);
              const sub = unit * (parseFloat(it.quantidade) || 0);
              return (
                <div key={i} className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 md:col-span-6">
                      <Select value={it.variacaoId} onChange={(e) => setItem(i, 'variacaoId', e.target.value)} options={opcoes} placeholder="" />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <Input type="number" min="1" step="1" placeholder="Qtd." value={it.quantidade} onChange={(e) => setItem(i, 'quantidade', e.target.value)} />
                    </div>
                    <div className="col-span-3 md:col-span-2 text-xs text-[var(--text-muted)] tabular-nums">
                      {it.variacaoId ? `un. ${fmtBRL(unit)}` : ''}
                    </div>
                    <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-1">
                      <span className="text-sm tabular-nums text-[var(--text-secondary)]">{fmtBRL(sub)}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={itens.length === 1}
                        title="Remover"
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {form.fiscalOn && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input size="sm" placeholder="NCM (8 díg.)" value={it.ncm} onChange={(e) => setItem(i, 'ncm', e.target.value)} inputMode="numeric" />
                      <Input size="sm" placeholder="CFOP (4 díg.)" value={it.cfop} onChange={(e) => setItem(i, 'cfop', e.target.value)} inputMode="numeric" />
                      <Input size="sm" placeholder="CEST (7 díg., opcional)" value={it.cest} onChange={(e) => setItem(i, 'cest', e.target.value)} inputMode="numeric" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Destinatario — opcional em teste; obrigatorio na emissao real (gate de producao) */}
        <div className="rounded-xl border border-[var(--border-main)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Destinatario (quem recebe a nota)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nome / Razao social" value={form.dest.nome} onChange={(e) => setDest('nome', e.target.value)} />
            <Input label={<LabelAjuda texto="CNPJ / CPF" ajuda="So os numeros. Validamos o digito verificador." />} value={form.dest.documento} onChange={(e) => setDest('documento', e.target.value)} inputMode="numeric" />
            <Input label="E-mail" type="email" value={form.dest.email} onChange={(e) => setDest('email', e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Input label="Municipio" value={form.dest.municipio} onChange={(e) => setDest('municipio', e.target.value)} /></div>
              <Input label="UF" maxLength={2} value={form.dest.uf} onChange={(e) => setDest('uf', e.target.value)} />
            </div>
          </div>
        </div>

        <Input label="Descricao (opcional)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />

        <div className="flex items-start gap-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] p-3 text-xs text-[var(--text-muted)]">
          <Lock size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            O valor unitário vem travado do catálogo ({form.base === 'CUSTO' ? 'preço de custo' : 'preço de venda'}).
            A emissão roda em modo de teste (sem SEFAZ) por enquanto.
          </span>
        </div>
      </div>
    </Drawer>
  );
}
