// ============================================================================
//  FINANCEIRO — contas a receber da locadora
//
//  Duas formas de cobrar convivem: registrar o que foi combinado (dinheiro,
//  cartão, PIX na mão) ou gerar um PIX de verdade pelo provedor e mandar o
//  link no WhatsApp. O botão de PIX só aparece se a integração estiver ligada.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Search,
  CheckCircle2,
  QrCode,
  Trash2,
  Pencil,
  TrendingUp,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Copy,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { api } from '../api.js';
import { brl, data as fmtData, telefone, linkSeguro } from '../format.js';
import DataTable from '../components/DataTable.jsx';
import { Modal, useConfirm } from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { SkeletonStats } from '../components/Skeleton.jsx';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Segmented,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Select,
  LinkAction,
  cx,
} from '../components/ui.jsx';

const TIPOS = {
  sinal: { label: 'Sinal', tone: 'violet' },
  diarias: { label: 'Diárias', tone: 'brand' },
  caucao: { label: 'Caução', tone: 'slate' },
  extra: { label: 'Extra', tone: 'amber' },
  multa: { label: 'Multa', tone: 'red' },
};

const SITUACOES = {
  pendente: { label: 'Pendente', tone: 'amber' },
  vencido: { label: 'Vencido', tone: 'red' },
  pago: { label: 'Pago', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'slate' },
  estornado: { label: 'Estornado', tone: 'slate' },
};

const FILTROS = [
  { value: '', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'vencido', label: 'Vencidas' },
  { value: 'pago', label: 'Pagas' },
];

const VAZIO = {
  reservationId: '',
  kind: 'extra',
  amount: '',
  dueDate: '',
  description: '',
  status: 'pendente',
  method: '',
};

/** Cartão de indicador do topo. */
function Indicador({ icon: Icon, rotulo, valor, detalhe, tom = 'slate' }) {
  const tons = {
    slate: 'bg-sutil text-conteudo-2',
    green: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
    red: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300',
  };
  return (
    <Card className="p-5" hover>
      <div className="flex items-center gap-2 text-[12px] text-suave mb-2.5">
        <span className={cx('grid place-items-center w-6 h-6 rounded-lg', tons[tom])}>
          <Icon size={13} strokeWidth={2.3} />
        </span>
        {rotulo}
      </div>
      <div className="text-[26px] font-bold text-conteudo leading-none">{valor}</div>
      {detalhe && <div className="text-[11.5px] text-suave-2 mt-2">{detalhe}</div>}
    </Card>
  );
}

export default function Financeiro() {
  const [cobrancas, setCobrancas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [reservas, setReservas] = useState([]);
  const [temPix, setTemPix] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const [form, setForm] = useState(null); // { ...VAZIO, id? }
  const [salvando, setSalvando] = useState(false);
  const [pix, setPix] = useState(null); // resultado da geração

  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [lista, res, integracao] = await Promise.all([
        api.get('/api/payments'),
        api.get('/api/payments/resumo'),
        api.get('/api/payments/integracao').catch(() => ({ pix: false })),
      ]);
      setCobrancas(lista);
      setResumo(res);
      setTemPix(!!integracao.pix);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // Reservas alimentam o seletor da nova cobrança.
    api.get('/api/reservations').then(setReservas).catch(() => {});
  }, []);

  // ------------------------------------------------------------------ ações
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const corpo = {
        kind: form.kind,
        amount: Number(form.amount),
        description: form.description.trim() || undefined,
        dueDate: form.dueDate || undefined,
        status: form.status,
        method: form.method || undefined,
      };
      if (form.id) {
        await api.patch(`/api/payments/${form.id}`, corpo);
        toast.sucesso('Cobrança atualizada.');
      } else {
        await api.post('/api/payments', {
          ...corpo,
          reservationId: form.reservationId || undefined,
        });
        toast.sucesso('Cobrança registrada.');
      }
      setForm(null);
      carregar();
    } catch (err) {
      setForm((f) => ({ ...f, erro: err.message }));
    } finally {
      setSalvando(false);
    }
  }

  async function gerarDaReserva() {
    if (!form?.reservationId) return;
    setSalvando(true);
    try {
      const criadas = await api.post(`/api/payments/da-reserva/${form.reservationId}`);
      toast.sucesso(`${criadas.length} cobrança(s) criada(s) a partir da locação.`);
      setForm(null);
      carregar();
    } catch (err) {
      setForm((f) => ({ ...f, erro: err.message }));
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPago(cobranca) {
    const ok = await confirmar({
      titulo: `Confirmar recebimento de ${brl(cobranca.amount)}?`,
      mensagem: 'A cobrança passa para "pago" com a data de hoje.',
      confirmar: 'Recebi',
      tom: 'brand',
    });
    if (!ok) return;
    try {
      await api.patch(`/api/payments/${cobranca.id}`, { status: 'pago' });
      toast.sucesso('Pagamento registrado.');
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  async function gerarPix(cobranca) {
    try {
      const r = await api.post(`/api/payments/${cobranca.id}/pix`);
      setPix(r);
      toast.sucesso('PIX gerado e link enviado ao cliente no WhatsApp.');
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  async function remover(cobranca) {
    const ok = await confirmar({
      titulo: 'Excluir esta cobrança?',
      mensagem: 'Ela some do financeiro. O histórico da locação não muda.',
      confirmar: 'Excluir',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/payments/${cobranca.id}`);
      toast.sucesso('Cobrança excluída.');
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  function abrirEdicao(c) {
    setForm({
      id: c.id,
      reservationId: c.reservation_id || '',
      kind: c.kind,
      amount: String(c.amount),
      dueDate: c.due_date ? String(c.due_date).slice(0, 10) : '',
      description: c.description || '',
      status: c.status === 'vencido' ? 'pendente' : c.status,
      method: c.method || '',
    });
  }

  // ------------------------------------------------------------------ dados
  const contagens = useMemo(() => {
    const c = {};
    for (const p of cobrancas) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [cobrancas]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return cobrancas
      .filter((p) => (filtro ? p.status === filtro : true))
      .filter((p) =>
        t
          ? `${p.customer_name || ''} ${p.description || ''} ${p.vehicle_model || ''} ${
              p.vehicle_plate || ''
            }`
              .toLowerCase()
              .includes(t)
          : true
      );
  }, [cobrancas, filtro, busca]);

  const colunas = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (p) => (
        <div className="min-w-0">
          <div className="font-medium text-conteudo truncate">{p.customer_name || '—'}</div>
          <div className="text-xs text-suave-2">
            {p.customer_phone ? telefone(p.customer_phone) : 'cobrança avulsa'}
          </div>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Tipo',
      render: (p) => {
        const t = TIPOS[p.kind] || { label: p.kind, tone: 'slate' };
        return <Badge tone={t.tone}>{t.label}</Badge>;
      },
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (p) => (
        <div className="min-w-0">
          <div className="text-[13px] text-conteudo-2 truncate">{p.description || '—'}</div>
          {p.vehicle_model && (
            <div className="text-xs text-suave-2">
              {p.vehicle_model} · {p.vehicle_plate}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'due_date',
      header: 'Vencimento',
      render: (p) => (
        <span className={cx('text-[13px]', p.status === 'vencido' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-conteudo-2')}>
          {p.due_date ? fmtData(p.due_date) : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'right',
      render: (p) => <span className="font-semibold text-conteudo">{brl(p.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (p) => {
        const s = SITUACOES[p.status] || { label: p.status, tone: 'slate' };
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
  ];

  const acoes = (p) => (
    <>
      {p.status !== 'pago' && (
        <LinkAction icon={CheckCircle2} tone="green" onClick={() => marcarPago(p)}>
          Recebi
        </LinkAction>
      )}
      {temPix && p.status !== 'pago' && p.customer_phone && (
        <LinkAction icon={QrCode} onClick={() => gerarPix(p)}>
          PIX
        </LinkAction>
      )}
      {p.external_url && (
        <LinkAction
          icon={ExternalLink}
          tone="slate"
          onClick={() => window.open(p.external_url, '_blank', 'noopener')}
        >
          Link
        </LinkAction>
      )}
      <LinkAction icon={Pencil} tone="slate" onClick={() => abrirEdicao(p)}>
        Editar
      </LinkAction>
      <LinkAction icon={Trash2} tone="red" onClick={() => remover(p)}>
        Excluir
      </LinkAction>
    </>
  );

  return (
    <div>
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        subtitle="O que já entrou, o que falta receber e o que passou do vencimento."
      >
        <Button icon={Plus} onClick={() => setForm({ ...VAZIO })}>
          Nova cobrança
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {/* Indicadores */}
      {carregando || !resumo ? (
        <SkeletonStats count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Indicador
            icon={TrendingUp}
            tom="green"
            rotulo="Recebido (30 dias)"
            valor={brl(resumo.recebido)}
            detalhe={`${resumo.qtd_recebido} pagamento(s)`}
          />
          <Indicador
            icon={Clock}
            tom="amber"
            rotulo="A receber"
            valor={brl(resumo.a_receber)}
            detalhe={`${resumo.qtd_a_receber} cobrança(s) em aberto`}
          />
          <Indicador
            icon={AlertTriangle}
            tom="red"
            rotulo="Vencido"
            valor={brl(resumo.vencido)}
            detalhe={
              resumo.qtd_vencido > 0
                ? `${resumo.qtd_vencido} passou do prazo`
                : 'nada atrasado 👏'
            }
          />
          <Indicador
            icon={ShieldCheck}
            rotulo="Caução em mãos"
            valor={brl(resumo.caucao_em_maos)}
            detalhe="a devolver no fim das locações"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 my-5">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suave-2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, descrição ou veículo…"
            className="pl-10"
          />
        </div>
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <Segmented
            value={filtro}
            onChange={setFiltro}
            options={FILTROS.map((f) => ({
              ...f,
              count: f.value ? contagens[f.value] : cobrancas.length,
            }))}
          />
        </div>
      </div>

      {/* Lista */}
      <Card className="overflow-hidden">
        <DataTable
          columns={colunas}
          rows={filtradas}
          loading={carregando}
          actions={acoes}
          empty={
            <EmptyState
              icon={Wallet}
              title={busca || filtro ? 'Nada com esse filtro' : 'Nenhuma cobrança ainda'}
              hint={
                busca || filtro
                  ? 'Tente outra busca ou volte para “Todas”.'
                  : 'Registre a primeira cobrança ou gere as diárias e a caução direto de uma locação.'
              }
              action={
                !busca &&
                !filtro && (
                  <Button icon={Plus} onClick={() => setForm({ ...VAZIO })}>
                    Nova cobrança
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      {!temPix && (
        <p className="mt-3 text-[12px] text-suave-2">
          Cobrança automática por PIX está desligada. Com a chave do provedor configurada no
          servidor, aparece um botão para gerar o PIX e mandar o link no WhatsApp.
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Nova cobrança / edição                                            */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar cobrança' : 'Nova cobrança'}
        icon={Wallet}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-cobranca" loading={salvando}>
              {form?.id ? 'Salvar' : 'Registrar cobrança'}
            </Button>
          </>
        }
      >
        {form && (
          <form id="form-cobranca" onSubmit={salvar} className="space-y-4">
            {!form.id && (
              <>
                <Field
                  label="Locação (opcional)"
                  hint="Ligando à locação, a cobrança já sai com o cliente e o veículo."
                >
                  <Select
                    value={form.reservationId}
                    onChange={(e) => setForm({ ...form, reservationId: e.target.value })}
                  >
                    <option value="">Cobrança avulsa</option>
                    {reservas.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.customer_name || telefone(r.customer_phone)} · {r.vehicle_model} ·{' '}
                        {fmtData(r.pickup_at)}
                      </option>
                    ))}
                  </Select>
                </Field>

                {form.reservationId && (
                  <button
                    type="button"
                    onClick={gerarDaReserva}
                    disabled={salvando}
                    className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/25
                               text-left hover:bg-brand-100/70 dark:hover:bg-brand-500/20 transition-colors disabled:opacity-60"
                  >
                    <Sparkles size={16} className="text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="text-[12.5px] text-brand-900 dark:text-brand-200">
                      <b>Gerar automaticamente</b> as diárias e a caução desta locação, com
                      vencimento no dia da retirada.
                    </span>
                  </button>
                )}
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tipo" required>
                <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(TIPOS).map(([id, t]) => (
                    <option key={id} value={id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Valor (R$)" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="150,00"
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Vencimento">
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </Field>
              <Field label="Situação">
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">Já recebi</option>
                  <option value="cancelado">Cancelada</option>
                  <option value="estornado">Estornada</option>
                </Select>
              </Field>
            </div>

            {form.status === 'pago' && (
              <Field label="Como recebeu">
                <Select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  <option value="">Não informar</option>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="transferencia">Transferência</option>
                  <option value="boleto">Boleto</option>
                  <option value="outro">Outro</option>
                </Select>
              </Field>
            )}

            <Field label="Descrição">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: lavagem na devolução"
              />
            </Field>

            {form.erro && (
              <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-3.5 py-2.5">
                {form.erro}
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* ---------------------------------------------------------------- */}
      {/* PIX gerado                                                        */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={!!pix}
        onClose={() => setPix(null)}
        title="PIX gerado"
        subtitle="O link também foi enviado ao cliente no WhatsApp."
        icon={QrCode}
        footer={
          <Button variant="secondary" onClick={() => setPix(null)}>
            Fechar
          </Button>
        }
      >
        {pix && (
          <div className="space-y-4 text-center">
            {pix.qrCode && (
              <img
                src={`data:image/png;base64,${pix.qrCode}`}
                alt="QR Code do PIX"
                className="w-48 h-48 mx-auto rounded-xl border border-borda"
              />
            )}

            {pix.copiaECola && (
              <div>
                <div className="text-[11px] text-suave mb-1.5">PIX copia e cola</div>
                <div className="flex gap-2">
                  <Input readOnly value={pix.copiaECola} className="text-[11px] font-mono" />
                  <Button
                    variant="secondary"
                    icon={Copy}
                    onClick={() => {
                      navigator.clipboard?.writeText(pix.copiaECola);
                      toast.sucesso('Código copiado.');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            )}

            {/* O endereço vem do provedor de cobrança, ou seja, de fora.
                linkSeguro só deixa passar http/https. */}
            {linkSeguro(pix.link) && (
              <a
                href={linkSeguro(pix.link)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 dark:text-brand-300 hover:underline"
              >
                Abrir a fatura <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
