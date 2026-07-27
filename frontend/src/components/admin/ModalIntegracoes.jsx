import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileText, MessageCircle, Lock, CircleCheck, Trash2 } from 'lucide-react';
import { Input, Button, Badge, useToast } from '../ui';
import Modal from '../Modal';
import adminCredenciaisService from '../../services/adminCredenciaisService';
import { ROTULO_INTEGRACAO, ROTULO_CAMPO, ORDEM_CATEGORIA } from '../../constants/integracoes';

const ICONE_CATEGORIA = { Pagamento: CreditCard, Fiscal: FileText, WhatsApp: MessageCircle };

// Modal (admin) que gerencia as integrações de UM cliente. As chaves ficam
// guardadas por cliente (cifradas no backend) — este modal só cria/edita/remove.
export default function ModalIntegracoes({ isOpen, onClose, cliente }) {
  const toast = useToast();
  const [tipos, setTipos] = useState([]);
  const [creds, setCreds] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // o `tipo` (objeto de /tipos) aberto
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen || !cliente) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      setEditando(null);
      setForm({});
      try {
        const [ts, cs] = await Promise.all([
          adminCredenciaisService.tipos().catch(() => []),
          adminCredenciaisService.listar(cliente.id).catch(() => []),
        ]);
        if (!vivo) return;
        setTipos(Array.isArray(ts) ? ts : []);
        setCreds(Array.isArray(cs) ? cs : []);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [isOpen, cliente]);

  const credDoTipo = (tipo) => creds.find((c) => c.tipo === tipo) || null;

  const grupos = useMemo(() => {
    const porCat = {};
    for (const t of tipos) {
      const cat = t.categoria || 'Outro';
      (porCat[cat] = porCat[cat] || []).push(t);
    }
    return ORDEM_CATEGORIA
      .filter((cat) => porCat[cat]?.length)
      .map((cat) => ({ categoria: cat, itens: porCat[cat] }));
  }, [tipos]);

  const abrirForm = (t) => { setEditando(t); setForm({}); };

  const salvar = async () => {
    const t = editando;
    const obrig = t.schema?.obrigatorios || [];
    for (const campo of obrig) {
      if (!String(form[campo] || '').trim()) {
        return toast.error(`Preencha: ${ROTULO_CAMPO[campo] || campo}.`);
      }
    }
    const dados = {};
    [...(t.schema?.obrigatorios || []), ...(t.schema?.opcionais || [])].forEach((campo) => {
      const v = String(form[campo] || '').trim();
      if (v) dados[campo] = v;
    });
    setSalvando(true);
    try {
      const nome = ROTULO_INTEGRACAO[t.tipo]?.nome || t.tipo;
      const cred = credDoTipo(t.tipo);
      if (cred) await adminCredenciaisService.atualizar(cliente.id, cred.id, { nome, dados });
      else await adminCredenciaisService.criar(cliente.id, { nome, tipo: t.tipo, dados });
      toast.success('Integração salva.');
      const cs = await adminCredenciaisService.listar(cliente.id);
      setCreds(Array.isArray(cs) ? cs : []);
      setEditando(null);
      setForm({});
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar integração.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (t) => {
    const cred = credDoTipo(t.tipo);
    if (!cred) return;
    const nome = ROTULO_INTEGRACAO[t.tipo]?.nome || t.tipo;
    if (!window.confirm(`Remover a integração ${nome} deste cliente?`)) return;
    try {
      await adminCredenciaisService.excluir(cliente.id, cred.id);
      setCreds((l) => l.filter((c) => c.id !== cred.id));
      toast.success('Integração removida.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao remover.');
    }
  };

  if (!cliente) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Integrações"
      description={`${cliente.nome}${cliente.email ? ` · ${cliente.email}` : ''}`}
      size="lg"
    >
      {carregando ? (
        <div className="text-sm text-[var(--text-muted)] py-8 text-center">Carregando...</div>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => {
            const IconeCat = ICONE_CATEGORIA[g.categoria] || CreditCard;
            return (
              <div key={g.categoria}>
                <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">{g.categoria}</div>
                <div className="space-y-2">
                  {g.itens.map((t) => {
                    const cred = credDoTipo(t.tipo);
                    const meta = ROTULO_INTEGRACAO[t.tipo] || { nome: t.tipo, desc: '' };
                    const aberto = editando?.tipo === t.tipo;
                    return (
                      <div key={t.tipo} className="border border-[var(--border-main)] rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 p-3">
                          <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] flex-shrink-0">
                            <IconeCat size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-[var(--text-main)]">{meta.nome}</div>
                            <div className="text-xs text-[var(--text-muted)] truncate">{meta.desc}</div>
                          </div>
                          {cred ? (
                            <Badge variant="success" size="sm" icon={CircleCheck}>Conectado</Badge>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Não configurado</span>
                          )}
                          {cred && (
                            <button
                              type="button"
                              onClick={() => remover(t)}
                              title="Remover"
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-subtle)] transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          <Button
                            variant={aberto ? 'ghost' : 'secondary'}
                            size="sm"
                            onClick={() => (aberto ? setEditando(null) : abrirForm(t))}
                          >
                            {aberto ? 'Fechar' : cred ? 'Editar' : 'Configurar'}
                          </Button>
                        </div>

                        {aberto && (
                          <div className="border-t border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 space-y-3">
                            {(t.schema?.obrigatorios || []).map((campo) => (
                              <Input
                                key={campo}
                                type="password"
                                label={ROTULO_CAMPO[campo] || campo}
                                value={form[campo] || ''}
                                onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                                placeholder={cred ? 'Cole a chave novamente para atualizar' : ''}
                              />
                            ))}
                            {(t.schema?.opcionais || []).map((campo) => (
                              <Input
                                key={campo}
                                type="password"
                                label={`${ROTULO_CAMPO[campo] || campo} (opcional)`}
                                value={form[campo] || ''}
                                onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                              />
                            ))}
                            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                              <Lock size={12} /> A chave é cifrada no cofre e nunca volta pela tela.
                            </div>
                            {t.tipo === 'WHATSAPP_CLOUD_TOKEN' && (
                              <div className="text-[11px] text-[var(--text-muted)]">
                                O número do canal (phoneNumberId) e o verify token ficam na tela do bot, não aqui.
                              </div>
                            )}
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
                              <Button variant="primary" size="sm" onClick={salvar} loading={salvando}>Salvar</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
