// ============================================================================
//  LEADS — funil de possíveis clientes em formato kanban.
//  Cada coluna é uma etapa (Novo → Qualificado → Negociação → Ganho → Perdido).
//  No computador arrasta o cartão entre colunas; no celular usa as setas do
//  cartão para avançar/voltar. Importa leads de planilha (CSV) numa janela.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Upload,
  Pencil,
  Trash2,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api.js';
import { brl, telefone } from '../format.js';
import { parseCSV, mapearColunas, linhasParaLeads } from '../utils/csv.js';
import { useArrastoKanban } from '../hooks/useArrastoKanban.js';
import { useToast } from '../components/Toast.jsx';
import { Modal, useConfirm } from '../components/Modal.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import {
  PageHeader,
  Card,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Badge,
  ErrorBanner,
  IconButton,
  cx,
} from '../components/ui.jsx';

// As colunas do funil, na ordem. A cor identifica a etapa de relance.
const COLUNAS = [
  { status: 'novo', label: 'Novo', dot: 'bg-slate-400', tone: 'slate', barra: 'bg-slate-400' },
  { status: 'qualificado', label: 'Qualificado', dot: 'bg-brand-500', tone: 'brand', barra: 'bg-brand-500' },
  { status: 'negociacao', label: 'Negociação', dot: 'bg-amber-500', tone: 'amber', barra: 'bg-amber-500' },
  { status: 'ganho', label: 'Ganho', dot: 'bg-emerald-500', tone: 'green', barra: 'bg-emerald-500' },
  { status: 'perdido', label: 'Perdido', dot: 'bg-red-500', tone: 'red', barra: 'bg-red-500' },
];
const ORDEM = COLUNAS.map((c) => c.status);

// ------------------------------------------------------------- esfriamento
//
// Lead parado é lead perdendo temperatura, e num funil cheio ele some no meio
// dos outros. Aqui a conta é simples: dias desde a última mexida (updated_at,
// que o servidor carimba a cada edição ou mudança de etapa).

/** Dias inteiros desde a última mexida no lead. */
function diasParado(lead) {
  const base = lead.updated_at || lead.created_at;
  if (!base) return 0;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
}

/**
 * Cor do cartão pelo tempo parado.
 *
 * "Ganho" e "Perdido" são etapas de fim: lead fechado não esfria, ele acabou —
 * marcar de vermelho ali só faria barulho por nada.
 */
function tomDoEsfriamento(dias, status) {
  if (status === 'ganho' || status === 'perdido') {
    return { borda: 'border-borda', badge: null };
  }
  if (dias >= 10) {
    return {
      borda: 'border-red-300 dark:border-red-500/40',
      badge: { tone: 'red', texto: `parado há ${dias} dias` },
    };
  }
  if (dias >= 4) {
    return {
      borda: 'border-amber-300 dark:border-amber-500/40',
      badge: { tone: 'amber', texto: `${dias} dias sem contato` },
    };
  }
  return { borda: 'border-borda hover:border-borda-forte', badge: null };
}

const VAZIO = { name: '', phone: '', email: '', source: '', status: 'novo', estimated_value: '', notes: '' };

// -------------------------------------------------------------------- cartão
function CartaoLead({ lead, propsAlca, onEditar, onRemover, onMover, esmaecido }) {
  const idx = ORDEM.indexOf(lead.status);
  const parado = diasParado(lead);
  const tom = tomDoEsfriamento(parado, lead.status);

  return (
    <div
      className={cx(
        'group bg-superficie border rounded-xl p-3 shadow-card dark:shadow-none',
        'transition-all duration-150 hover:shadow-card-hover',
        tom.borda,
        esmaecido && 'opacity-40'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Alça de arraste: sempre visível. No celular não existe "passar o
            mouse", então esconder a alça no hover era escondê-la para sempre.
            Área de toque generosa (-m compensa o padding). */}
        <span
          {...propsAlca}
          aria-label="Arrastar para outra etapa"
          className="shrink-0 -m-1 p-1 grid place-items-center text-suave-2
                     hover:text-conteudo active:scale-95 transition-colors touch-none"
        >
          <GripVertical size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-conteudo truncate">{lead.name}</h4>
            {lead.estimated_value != null && (
              <span className="text-[13px] font-bold text-conteudo tabular shrink-0">
                {brl(lead.estimated_value)}
              </span>
            )}
          </div>

          {/* Contatos */}
          <div className="mt-1.5 flex flex-col gap-1">
            {lead.phone && (
              <a
                href={`https://wa.me/${String(lead.phone).replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-xs text-suave hover:text-brand-600 dark:hover:text-brand-400 transition-colors w-fit"
              >
                <Phone size={11} /> {telefone(lead.phone)}
              </a>
            )}
            {lead.email && (
              <span className="inline-flex items-center gap-1.5 text-xs text-suave truncate">
                <Mail size={11} className="shrink-0" /> {lead.email}
              </span>
            )}
          </div>

          {(lead.source || tom.badge) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {lead.source && <Badge tone="slate">{lead.source}</Badge>}
              {tom.badge && <Badge tone={tom.badge.tone}>{tom.badge.texto}</Badge>}
            </div>
          )}

          {lead.notes && (
            <p className="mt-2 text-xs text-suave leading-relaxed line-clamp-2">{lead.notes}</p>
          )}

          {/* Ações */}
          <div className="flex items-center gap-0.5 mt-2.5 pt-2.5 border-t border-borda">
            <IconButton
              icon={ChevronLeft}
              label="Voltar etapa"
              size={15}
              onClick={() => onMover(lead, -1)}
              disabled={idx <= 0}
              className={cx('w-9 h-9', idx <= 0 && 'opacity-30 pointer-events-none')}
            />
            <IconButton
              icon={ChevronRight}
              label="Avançar etapa"
              size={15}
              onClick={() => onMover(lead, +1)}
              disabled={idx >= ORDEM.length - 1}
              className={cx('w-9 h-9', idx >= ORDEM.length - 1 && 'opacity-30 pointer-events-none')}
            />
            <div className="flex-1" />
            <IconButton icon={Pencil} label="Editar" size={14} onClick={() => onEditar(lead)} className="w-9 h-9" />
            <IconButton
              icon={Trash2}
              label="Remover"
              size={14}
              onClick={() => onRemover(lead)}
              className="w-9 h-9 hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [importar, setImportar] = useState(false);

  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setLeads(await api.get('/api/leads'));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Atalho ⌘K → "Adicionar lead" chega com ?novo=1
  useEffect(() => {
    if (params.get('novo')) {
      abrirNovo();
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function abrirNovo() {
    setEditId(null);
    setForm(VAZIO);
    setErroForm('');
    setAberto(true);
  }

  function abrirEdicao(l) {
    setEditId(l.id);
    setForm({
      name: l.name ?? '',
      phone: l.phone ?? '',
      email: l.email ?? '',
      source: l.source ?? '',
      status: l.status ?? 'novo',
      estimated_value: l.estimated_value ?? '',
      notes: l.notes ?? '',
    });
    setErroForm('');
    setAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      const payload = { name: form.name.trim(), status: form.status };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.source.trim()) payload.source = form.source.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.estimated_value !== '' && form.estimated_value != null)
        payload.estimated_value = Number(form.estimated_value);

      if (editId) await api.patch(`/api/leads/${editId}`, payload);
      else await api.post('/api/leads', payload);

      toast.sucesso(editId ? 'Lead atualizado.' : `${payload.name} entrou no funil.`);
      setAberto(false);
      carregar();
    } catch (err) {
      setErroForm(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(l) {
    const ok = await confirmar({
      titulo: `Remover ${l.name}?`,
      mensagem: 'O lead sai do funil. Essa ação não pode ser desfeita.',
      confirmar: 'Remover',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/leads/${l.id}`);
      setLeads((atual) => atual.filter((x) => x.id !== l.id));
      toast.sucesso('Lead removido.');
    } catch (e) {
      toast.erro(e.message);
    }
  }

  // Arraste que funciona no dedo (o draggable nativo do HTML não funciona no
  // celular, e o celular é a prioridade). Ver useArrastoKanban.
  const arrasto = useArrastoKanban({
    onSoltar: (lead, coluna) => mudarStatus(lead, coluna),
  });

  // -------------------------------------------------------- mudança de coluna
  async function mudarStatus(lead, novoStatus) {
    if (!novoStatus || novoStatus === lead.status) return;
    const anterior = lead.status;
    // Otimista: move na tela na hora, desfaz se a API falhar.
    setLeads((atual) => atual.map((x) => (x.id === lead.id ? { ...x, status: novoStatus } : x)));
    try {
      await api.patch(`/api/leads/${lead.id}`, { status: novoStatus });
    } catch (e) {
      setLeads((atual) => atual.map((x) => (x.id === lead.id ? { ...x, status: anterior } : x)));
      toast.erro(e.message);
    }
  }

  function moverPorSeta(lead, delta) {
    const idx = ORDEM.indexOf(lead.status);
    const destino = ORDEM[idx + delta];
    if (destino) mudarStatus(lead, destino);
  }

  // ------------------------------------------------------------------ dados
  const porColuna = useMemo(() => {
    const grupos = Object.fromEntries(ORDEM.map((s) => [s, []]));
    for (const l of leads) (grupos[l.status] || (grupos[l.status] = [])).push(l);
    // Mais parado em cima: quem está esfriando é justamente quem some no meio
    // da pilha, então a ordem coloca a cobrança na frente dos olhos.
    for (const chave of Object.keys(grupos)) {
      grupos[chave].sort((a, b) => diasParado(b) - diasParado(a));
    }
    return grupos;
  }, [leads]);

  const totalValor = (lista) =>
    lista.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Leads"
        subtitle="Seu funil de possíveis clientes, do primeiro contato ao fechamento."
      >
        <Button variant="secondary" icon={Upload} onClick={() => setImportar(true)}>
          Importar planilha
        </Button>
        <Button icon={Plus} onClick={abrirNovo}>
          Novo lead
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {COLUNAS.map((c) => (
            <div key={c.status} className="space-y-3">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum lead ainda"
            hint="Adicione um lead na mão ou importe uma planilha (CSV) para começar a trabalhar seu funil."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" icon={Upload} onClick={() => setImportar(true)}>
                  Importar planilha
                </Button>
                <Button icon={Plus} onClick={abrirNovo}>
                  Novo lead
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x">
          {COLUNAS.map((col) => {
            const lista = porColuna[col.status] || [];
            const valor = totalValor(lista);
            const destacada = arrasto.colunaAlvo === col.status;
            return (
              <div
                key={col.status}
                // O gancho de arraste acha a coluna sob o dedo por este atributo.
                data-coluna={col.status}
                className={cx(
                  'w-[280px] shrink-0 snap-start flex flex-col rounded-2xl border transition-colors',
                  destacada
                    ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-500/10'
                    : 'border-borda bg-elevado/40'
                )}
              >
                {/* Cabeçalho da coluna */}
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-borda">
                  <span className={cx('w-2 h-2 rounded-full', col.dot)} />
                  <span className="text-sm font-semibold text-conteudo">{col.label}</span>
                  <span className="text-xs font-medium text-suave bg-sutil px-1.5 py-0.5 rounded-md">
                    {lista.length}
                  </span>
                  {valor > 0 && (
                    <span className="ml-auto text-[11px] font-semibold text-suave tabular">{brl(valor)}</span>
                  )}
                </div>

                {/* Cartões */}
                <div className="flex-1 p-2.5 space-y-2.5 min-h-[120px]">
                  {lista.length === 0 ? (
                    <div className="h-full min-h-[100px] grid place-items-center text-center px-3">
                      <p className="text-xs text-suave-2 leading-relaxed">
                        {destacada ? 'Solte aqui' : 'Arraste um lead para cá'}
                      </p>
                    </div>
                  ) : (
                    lista.map((l) => (
                      <CartaoLead
                        key={l.id}
                        lead={l}
                        propsAlca={arrasto.propsDaAlca(l)}
                        esmaecido={arrasto.fantasma?.id === l.id}
                        onEditar={abrirEdicao}
                        onRemover={remover}
                        onMover={moverPorSeta}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cartão fantasma que segue o dedo enquanto arrasta. Fica fora das
          colunas de propósito: se ficasse dentro, o próprio fantasma cobriria
          a coluna na hora de descobrir onde o dedo está. */}
      {arrasto.fantasma && (
        <div
          style={arrasto.estiloDoFantasma}
          className="w-[220px] bg-superficie border border-brand-400 rounded-xl p-3 shadow-pop"
        >
          <div className="text-sm font-semibold text-conteudo truncate">
            {arrasto.fantasma.name}
          </div>
          <div className="text-[11px] text-suave mt-0.5">
            {arrasto.colunaAlvo
              ? `soltar em ${COLUNAS.find((c) => c.status === arrasto.colunaAlvo)?.label}`
              : 'arraste até uma coluna'}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Janela de cadastro/edição                                        */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={editId ? 'Editar lead' : 'Novo lead'}
        subtitle={editId ? 'Atualize os dados ou mude a etapa.' : 'Adicione um possível cliente ao funil.'}
        icon={Users}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAberto(false)} type="button">
              Cancelar
            </Button>
            <Button type="submit" form="form-lead" loading={salvando}>
              {editId ? 'Salvar alterações' : 'Adicionar ao funil'}
            </Button>
          </>
        }
      >
        <form id="form-lead" onSubmit={salvar} className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <Field label="Nome" required className="col-span-2 sm:col-span-4">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="João da Silva"
              required
            />
          </Field>
          <Field label="Etapa" className="col-span-2">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {COLUNAS.map((c) => (
                <option key={c.status} value={c.status}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Telefone / WhatsApp" className="col-span-2 sm:col-span-3">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(34) 99999-9999"
            />
          </Field>
          <Field label="E-mail" className="col-span-2 sm:col-span-3">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="joao@email.com"
            />
          </Field>

          <Field label="Origem" hint="De onde veio o lead." className="col-span-1 sm:col-span-3">
            <Input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="WhatsApp, indicação, Instagram…"
            />
          </Field>
          <Field label="Valor estimado (R$)" className="col-span-1 sm:col-span-3">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
              placeholder="1.200,00"
            />
          </Field>

          <Field label="Observações" className="col-span-2 sm:col-span-6">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex.: quer um SUV para viagem no fim do mês."
              rows={2}
            />
          </Field>

          {erroForm && (
            <div className="col-span-2 sm:col-span-6 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-3.5 py-2.5">
              {erroForm}
            </div>
          )}
        </form>
      </Modal>

      {/* Janela de importação de planilha */}
      <ImportarLeads
        open={importar}
        onClose={() => setImportar(false)}
        onPronto={() => {
          setImportar(false);
          carregar();
        }}
      />
    </div>
  );
}

// ============================================================================
//  IMPORTAÇÃO DE PLANILHA (CSV)
//  Lê o arquivo no navegador, casa as colunas, mostra uma prévia e envia.
// ============================================================================
function ImportarLeads({ open, onClose, onPronto }) {
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [prontos, setProntos] = useState([]); // leads mapeados
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();

  function limpar() {
    setNomeArquivo('');
    setProntos([]);
    setErro('');
  }

  function aoEscolher(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro('');
    setNomeArquivo(arquivo.name);
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const linhas = parseCSV(String(leitor.result));
        if (linhas.length < 2) {
          setErro('A planilha precisa de um cabeçalho e ao menos uma linha de dados.');
          setProntos([]);
          return;
        }
        const { mapa } = mapearColunas(linhas);
        if (mapa.name < 0) {
          setErro('Não encontrei a coluna de nome. Garanta um cabeçalho como "Nome" na planilha.');
          setProntos([]);
          return;
        }
        const leads = linhasParaLeads(linhas, mapa);
        if (leads.length === 0) {
          setErro('Nenhuma linha com nome foi encontrada.');
          setProntos([]);
          return;
        }
        setProntos(leads);
      } catch (err) {
        setErro('Não consegui ler esse arquivo. Confirme que é um CSV.');
        setProntos([]);
      }
    };
    leitor.readAsText(arquivo, 'utf-8');
  }

  async function confirmar() {
    setEnviando(true);
    setErro('');
    try {
      const { inseridos } = await api.post('/api/leads/import', { leads: prontos });
      toast.sucesso(`${inseridos} lead(s) importado(s).`);
      limpar();
      onPronto();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        limpar();
        onClose();
      }}
      title="Importar leads de planilha"
      subtitle="Arquivo CSV com uma coluna de nome (telefone, e-mail e origem são opcionais)."
      icon={FileSpreadsheet}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              limpar();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} loading={enviando} disabled={prontos.length === 0}>
            Importar {prontos.length > 0 ? `${prontos.length} lead(s)` : ''}
          </Button>
        </>
      }
    >
      {/* Área de escolha do arquivo */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-borda-forte hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-500/10 transition-colors text-center"
      >
        <span className="grid place-items-center w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400">
          <Upload size={22} />
        </span>
        <span className="text-sm font-medium text-conteudo">
          {nomeArquivo || 'Escolher arquivo CSV'}
        </span>
        <span className="text-xs text-suave">Clique para selecionar ou troque o arquivo</span>
      </button>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={aoEscolher} className="hidden" />

      {erro && (
        <div className="mt-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-3.5 py-2.5">
          {erro}
        </div>
      )}

      {/* Prévia */}
      {prontos.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-conteudo mb-2.5">
            <CheckCircle2 size={16} className="text-emerald-500" />
            {prontos.length} lead(s) prontos para importar
          </div>
          <div className="rounded-xl border border-borda overflow-hidden">
            <div className="max-h-64 overflow-y-auto divide-y divide-borda">
              {prontos.slice(0, 50).map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-3.5 py-2 text-sm">
                  <span className="font-medium text-conteudo truncate flex-1">{l.name}</span>
                  {l.phone && <span className="text-xs text-suave shrink-0">{telefone(l.phone)}</span>}
                  {l.estimated_value != null && (
                    <span className="text-xs font-semibold text-conteudo tabular shrink-0">
                      {brl(l.estimated_value)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {prontos.length > 50 && (
            <p className="text-xs text-suave-2 mt-2">
              Mostrando os primeiros 50 — todos os {prontos.length} serão importados.
            </p>
          )}
          <p className="text-xs text-suave-2 mt-2">
            Todos entram na coluna <b className="text-suave">Novo</b>. Depois é só arrastar pelo funil.
          </p>
        </div>
      )}
    </Modal>
  );
}
