// ============================================================================
//  AGENDA DE RESERVAS
//  A tela do dia a dia: o que sai hoje, o que volta hoje, o que está na rua
//  e o que precisa de decisão. Filtro por situação + busca livre.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarX,
  Calendar,
  Search,
  ArrowRight,
  KeyRound,
  Undo2,
  XCircle,
  AlertTriangle,
  CarFront,
  LogIn,
  LogOut,
  ClipboardCheck,
  FileSignature,
} from 'lucide-react';
import { api } from '../api.js';
import { dt, data, hora, brl, telefone } from '../format.js';
import StatusBadge from '../components/StatusBadge.jsx';
import DataTable from '../components/DataTable.jsx';
import VistoriaModal from '../components/VistoriaModal.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Modal.jsx';
import {
  PageHeader,
  Card,
  EmptyState,
  LinkAction,
  Segmented,
  ErrorBanner,
  Input,
  Badge,
  cx,
} from '../components/ui.jsx';

const FILTROS = [
  { value: '', label: 'Todas' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'em_andamento', label: 'Na rua' },
  { value: 'pre_reserva', label: 'Pré-reservas' },
  { value: 'finalizada', label: 'Finalizadas' },
];

/** Indicador compacto do topo da agenda. */
function Indicador({ icon: Icon, label, valor, tom = 'slate' }) {
  const tons = {
    slate: 'bg-sutil text-conteudo-2',
    brand: 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300',
    green: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  };
  return (
    <Card className="p-4 flex items-center gap-3.5" hover>
      <span className={cx('grid place-items-center w-11 h-11 rounded-xl shrink-0', tons[tom])}>
        <Icon size={19} strokeWidth={2.1} />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-conteudo leading-none tabular">{valor}</div>
        <div className="text-[12px] text-suave mt-1 truncate">{label}</div>
      </div>
    </Card>
  );
}

/** Mesmo dia do calendário? */
function ehHoje(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const h = new Date();
  return (
    d.getDate() === h.getDate() && d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear()
  );
}

export default function Agenda() {
  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  // Vistoria aberta: { reserva, tipo, modo }
  const [vistoria, setVistoria] = useState(null);

  const toast = useToast();
  const confirmar = useConfirm();
  const nav = useNavigate();

  // Carrega tudo de uma vez: os filtros ficam instantâneos (sem ida ao servidor).
  // Quando a base crescer, paginamos aqui.
  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setReservas(await api.get('/api/reservations'));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // ------------------------------------------------------------------ dados
  const resumo = useMemo(() => {
    const ativas = reservas.filter((r) =>
      ['confirmada', 'em_andamento', 'em_analise', 'pre_reserva'].includes(r.status)
    );
    return {
      retiradasHoje: ativas.filter((r) => ehHoje(r.pickup_at) && r.status === 'confirmada').length,
      devolucoesHoje: ativas.filter((r) => ehHoje(r.return_at) && r.status === 'em_andamento').length,
      naRua: reservas.filter((r) => r.status === 'em_andamento').length,
      aguardando: reservas.filter((r) => r.status === 'em_analise').length,
    };
  }, [reservas]);

  const contagens = useMemo(() => {
    const c = {};
    for (const r of reservas) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [reservas]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return reservas
      .filter((r) => (filtro ? r.status === filtro : true))
      .filter((r) =>
        t
          ? `${r.customer_name || ''} ${r.customer_phone || ''} ${r.vehicle_model} ${r.vehicle_plate}`
              .toLowerCase()
              .includes(t)
          : true
      );
  }, [reservas, filtro, busca]);

  // ------------------------------------------------------------------ ações
  async function acao(reserva, rota, texto) {
    const ok = await confirmar({
      titulo: texto.titulo,
      mensagem: texto.mensagem,
      confirmar: texto.confirmar,
      tom: texto.tom || 'brand',
    });
    if (!ok) return;
    try {
      await api.post(`/api/reservations/${reserva.id}/${rota}`);
      toast.sucesso(texto.sucesso);
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  /**
   * Retirada e devolução passam pela VISTORIA: o estado do carro é registrado
   * antes de a locação mudar de fase. A troca de status só acontece depois que
   * a vistoria foi salva (é o `onConcluir` da janela).
   */
  async function concluirMovimento(reserva, rota, mensagem) {
    await api.post(`/api/reservations/${reserva.id}/${rota}`);
    toast.sucesso(mensagem);
    carregar();
  }

  const cancelar = (r) =>
    acao(r, 'cancel', {
      titulo: 'Cancelar esta reserva?',
      mensagem: 'O período volta a ficar livre na agenda. O cliente é avisado pelo WhatsApp.',
      confirmar: 'Cancelar reserva',
      tom: 'danger',
      sucesso: 'Reserva cancelada.',
    });

  // ------------------------------------------------------------------ colunas
  const colunas = [
    {
      key: 'veiculo',
      header: 'Veículo',
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-sutil text-suave shrink-0">
            <CarFront size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="font-medium text-conteudo truncate">{r.vehicle_model}</div>
            <div className="text-xs text-suave-2 font-mono">{r.vehicle_plate}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (r) => (
        <div className="min-w-0">
          <div className="text-conteudo-2 truncate">{r.customer_name || '—'}</div>
          <div className="text-xs text-suave-2">{telefone(r.customer_phone)}</div>
        </div>
      ),
    },
    {
      key: 'periodo',
      header: 'Período',
      render: (r) => (
        <div className="flex items-center gap-2 text-conteudo-2">
          <span className={cx(ehHoje(r.pickup_at) && 'font-semibold text-brand-700 dark:text-brand-300')}>
            {data(r.pickup_at)} <span className="text-suave-2">{hora(r.pickup_at)}</span>
          </span>
          <ArrowRight size={13} className="text-suave-2 shrink-0" />
          <span className={cx(ehHoje(r.return_at) && 'font-semibold text-brand-700 dark:text-brand-300')}>
            {data(r.return_at)} <span className="text-suave-2">{hora(r.return_at)}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'dias',
      header: 'Diárias',
      align: 'center',
      render: (r) => <span className="text-suave">{r.days_count}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (r) => <span className="font-semibold text-conteudo">{brl(r.total_amount)}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} />
          {r.late_return_flag && (
            <Badge tone="red" icon={AlertTriangle}>
              atraso
            </Badge>
          )}
        </div>
      ),
    },
  ];

  const acoes = (r) => (
    <>
      {r.status === 'confirmada' && (
        <LinkAction
          icon={KeyRound}
          onClick={() => setVistoria({ reserva: r, tipo: 'retirada', modo: 'nova' })}
        >
          Retirada
        </LinkAction>
      )}
      {r.status === 'em_andamento' && (
        <LinkAction
          icon={Undo2}
          tone="green"
          onClick={() => setVistoria({ reserva: r, tipo: 'devolucao', modo: 'nova' })}
        >
          Devolução
        </LinkAction>
      )}
      {['em_andamento', 'finalizada'].includes(r.status) && (
        <LinkAction
          icon={ClipboardCheck}
          tone="slate"
          onClick={() => setVistoria({ reserva: r, tipo: 'retirada', modo: 'ver' })}
        >
          Vistoria
        </LinkAction>
      )}
      {['confirmada', 'em_andamento', 'finalizada'].includes(r.status) && (
        <LinkAction icon={FileSignature} tone="slate" onClick={() => nav(`/contrato/${r.id}`)}>
          Contrato
        </LinkAction>
      )}
      {['pre_reserva', 'aguardando_documentos', 'em_analise', 'confirmada'].includes(r.status) && (
        <LinkAction icon={XCircle} tone="red" onClick={() => cancelar(r)}>
          Cancelar
        </LinkAction>
      )}
    </>
  );

  return (
    <div>
      <PageHeader
        icon={Calendar}
        title="Agenda de reservas"
        subtitle="Tudo que está reservado, na rua ou esperando decisão."
      />

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {/* Indicadores do dia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Indicador icon={LogOut} label="Retiradas hoje" valor={resumo.retiradasHoje} tom="brand" />
        <Indicador icon={LogIn} label="Devoluções hoje" valor={resumo.devolucoesHoje} tom="green" />
        <Indicador icon={CarFront} label="Veículos na rua" valor={resumo.naRua} />
        <Indicador
          icon={AlertTriangle}
          label="Aguardando análise"
          valor={resumo.aguardando}
          tom="amber"
        />
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suave-2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, telefone, modelo ou placa…"
            className="pl-10"
          />
        </div>
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <Segmented
            value={filtro}
            onChange={setFiltro}
            options={FILTROS.map((f) => ({
              ...f,
              count: f.value ? contagens[f.value] : reservas.length,
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
            busca || filtro ? (
              <EmptyState
                icon={Search}
                title="Nenhuma reserva com esse filtro"
                hint="Tente outra busca ou volte para “Todas”."
              />
            ) : (
              <EmptyState
                icon={CalendarX}
                title="Nenhuma reserva por aqui"
                hint="As reservas aparecem assim que os clientes começarem a conversar pelo WhatsApp."
              />
            )
          }
          renderCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-conteudo truncate">{r.vehicle_model}</div>
                  <div className="text-xs text-suave-2 font-mono">{r.vehicle_plate}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="text-sm text-conteudo-2">{r.customer_name || '—'}</div>
              <div className="text-xs text-suave-2 mb-2.5">{telefone(r.customer_phone)}</div>
              <div className="flex items-center justify-between gap-3 text-[13px] pt-2.5 border-t border-borda">
                <span className="text-suave">
                  {dt(r.pickup_at)} <span className="text-suave-2">→</span> {dt(r.return_at)}
                </span>
                <span className="font-semibold text-conteudo">{brl(r.total_amount)}</span>
              </div>
            </div>
          )}
        />
      </Card>

      {/* Vistoria: abre na retirada, na devolução e na consulta do histórico */}
      <VistoriaModal
        open={!!vistoria}
        onClose={() => setVistoria(null)}
        reserva={vistoria?.reserva}
        tipo={vistoria?.tipo}
        modo={vistoria?.modo}
        onConcluir={
          vistoria?.modo === 'nova'
            ? () =>
                vistoria.tipo === 'retirada'
                  ? concluirMovimento(vistoria.reserva, 'pickup', 'Retirada registrada com vistoria.')
                  : concluirMovimento(
                      vistoria.reserva,
                      'return',
                      'Devolução registrada. Veículo liberado.'
                    )
            : undefined
        }
      />
    </div>
  );
}
