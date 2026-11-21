// ============================================================================
//  ANÁLISE DE PRÉ-RESERVAS
//  Aqui o dono decide. A tela junta tudo que ele precisa olhar antes de
//  aprovar: dados do cliente, período, valores, documentos e alertas.
//
//  Regra de ouro do produto: a IA nunca confirma sozinha.
// ============================================================================
import { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  FileImage,
  FileText,
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  CircleAlert,
} from 'lucide-react';
import { api } from '../api.js';
import { dt, data, brl, telefone, cpf as fmtCpf } from '../format.js';
import { SkeletonCards } from '../components/Skeleton.jsx';
import { Modal, useConfirm } from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import Comemoracao from '../components/Comemoracao.jsx';
import {
  PageHeader,
  Card,
  Button,
  EmptyState,
  Badge,
  Textarea,
  Field,
  Avatar,
  ErrorBanner,
  cx,
} from '../components/ui.jsx';

const TIPO_DOC = {
  cnh_frente: 'CNH (frente)',
  cnh_verso: 'CNH (verso)',
  comprovante_residencia: 'Comprovante de residência',
  selfie_cnh: 'Selfie com a CNH',
};

/**
 * O que SÓ o olho humano resolve.
 *
 * Antes eram 4 marcações, e duas delas o sistema já sabe responder sozinho
 * (validade da CNH, documentos entregues, CPF no cadastro) — isso agora vem
 * pronto do motor de risco. Aqui ficam apenas as duas perguntas que dependem
 * de alguém OLHAR a foto.
 */
const OLHO_HUMANO = [
  {
    id: 'selfie',
    pergunta: 'A pessoa da selfie é a mesma da foto da CNH?',
    ajuda: 'Compare o rosto da selfie com o rosto impresso na habilitação.',
  },
  {
    id: 'comprovante',
    pergunta: 'O comprovante de residência está legível e no nome do cliente?',
    ajuda: 'Conta de luz, água ou internet dos últimos meses serve.',
  },
];

/** Linha de dado no bloco de informações. */
function Info({ rotulo, valor, alerta }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-borda last:border-0">
      <span className="text-[13px] text-suave shrink-0">{rotulo}</span>
      <span
        className={cx(
          'text-[13px] text-right font-medium',
          alerta ? 'text-red-600 dark:text-red-400' : 'text-conteudo'
        )}
      >
        {valor || '—'}
      </span>
    </div>
  );
}

// Aparência de cada nível geral de risco.
const RISCO_CFG = {
  alto: { label: 'Risco alto', tone: 'red', icon: ShieldAlert, box: 'border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10' },
  medio: { label: 'Atenção', tone: 'amber', icon: ShieldAlert, box: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10' },
  baixo: { label: 'Baixo risco', tone: 'slate', icon: ShieldCheck, box: 'border-borda bg-elevado/60' },
  ok: { label: 'Sem alertas', tone: 'green', icon: ShieldCheck, box: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10' },
};

/** Marcador de cada sinal (bolinha colorida, ou check verde para o positivo). */
function MarcadorSinal({ nivel }) {
  if (nivel === 'positivo')
    return <Check size={13} strokeWidth={3} className="text-emerald-500 mt-0.5 shrink-0" />;
  const cor =
    { alto: 'bg-red-500', medio: 'bg-amber-500', baixo: 'bg-slate-400', info: 'bg-suave-2' }[nivel] ||
    'bg-suave-2';
  return <span className={cx('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', cor)} />;
}

/**
 * O que o SISTEMA já conferiu sozinho.
 *
 * Abre mostrando só o que exige atenção (alto/médio). O que está em ordem
 * fica somado em uma linha e só abre se a pessoa quiser ver — assim a tela
 * não empurra 8 itens para quem só quer decidir.
 */
function JaConferido({ risco }) {
  const [verTudo, setVerTudo] = useState(false);
  if (!risco) return <div className="mt-4 h-24 rounded-xl bg-elevado animate-pulse" />;

  const cfg = RISCO_CFG[risco.nivel] || RISCO_CFG.baixo;
  const Icone = cfg.icon;

  const atencao = risco.sinais.filter((s) => s.nivel === 'alto' || s.nivel === 'medio');
  const resto = risco.sinais.filter((s) => s.nivel !== 'alto' && s.nivel !== 'medio');
  const mostrar = verTudo ? risco.sinais : atencao;

  return (
    <div className={cx('rounded-xl border p-3.5', cfg.box)}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icone size={15} className="text-conteudo-2 shrink-0" />
        <span className="text-[13px] font-semibold text-conteudo">O sistema já conferiu</span>
        <Badge tone={cfg.tone} className="ml-auto">
          {cfg.label}
        </Badge>
      </div>
      <p className="text-[12px] text-suave mb-2.5">{risco.resumo}</p>

      {mostrar.length > 0 && (
        <ul className="space-y-2">
          {mostrar.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <MarcadorSinal nivel={s.nivel} />
              <span className="min-w-0">
                <span className="text-[12.5px] font-medium text-conteudo">{s.titulo}</span>
                {s.detalhe && (
                  <span className="block text-[11.5px] text-suave leading-snug">{s.detalhe}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {resto.length > 0 && (
        <button
          type="button"
          onClick={() => setVerTudo((v) => !v)}
          className="mt-2.5 text-[12px] font-medium text-brand-700 dark:text-brand-400 hover:underline"
        >
          {verTudo
            ? 'Esconder o que está em ordem'
            : `Ver as outras ${resto.length} verificações (em ordem)`}
        </button>
      )}

      <p className="mt-3 pt-2.5 border-t border-borda/70 text-[11px] text-suave-2 leading-snug">
        Decida por critério objetivo (documento, restrição, histórico) — nunca por aparência. A decisão é sempre sua.
      </p>
    </div>
  );
}

/** Cartão de uma pré-reserva aguardando decisão. */
function CartaoAnalise({ reserva: base, onDecisao }) {
  const [reserva, setReserva] = useState(base);
  const [docs, setDocs] = useState(null);
  const [risco, setRisco] = useState(null);
  const [check, setCheck] = useState({});
  const [processando, setProcessando] = useState(false);
  const [motivoAberto, setMotivoAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  // Bloquear é ESCOLHA, não consequência automática da recusa.
  const [bloquearCliente, setBloquearCliente] = useState(false);
  const [lightbox, setLightbox] = useState(null); // índice do documento aberto
  const [comemorar, setComemorar] = useState(false);

  const toast = useToast();
  const confirmar = useConfirm();

  useEffect(() => {
    api.get(`/api/reservations/${base.id}`).then(setReserva).catch(() => {});
    api
      .get(`/api/reservations/${base.id}/documents`)
      .then(setDocs)
      .catch(() => setDocs([]));
    api
      .get(`/api/reservations/${base.id}/risco`)
      .then(setRisco)
      .catch(() => setRisco(null));
  }, [base.id]);

  const conferidos = OLHO_HUMANO.filter((i) => check[i.id]).length;

  // -------------------------------------------------------------- ações
  async function aprovar() {
    if (conferidos < OLHO_HUMANO.length) {
      const falta = OLHO_HUMANO.filter((i) => !check[i.id]);
      const ok = await confirmar({
        titulo: 'Você ainda não conferiu tudo',
        mensagem:
          falta.length === 1
            ? `Falta responder: "${falta[0].pergunta}" Aprovar mesmo assim?`
            : 'Faltam as duas conferências de foto. Aprovar mesmo assim?',
        confirmar: 'Aprovar assim mesmo',
        tom: 'brand',
      });
      if (!ok) return;
    }
    setProcessando(true);
    try {
      await api.post(`/api/reservations/${reserva.id}/approve`);
      setComemorar(true); // decisão tomada: vale a festinha
      toast.sucesso('Reserva confirmada. O cliente já foi avisado no WhatsApp.', {
        titulo: 'Aprovada ✅',
      });
      onDecisao();
    } catch (e) {
      toast.erro(e.message);
      setProcessando(false);
    }
  }

  async function recusar(e) {
    e.preventDefault();
    setProcessando(true);
    try {
      await api.post(`/api/reservations/${reserva.id}/reject`, {
        internalReason: motivo,
        bloquearCliente,
      });
      // A mensagem precisa dizer o que REALMENTE aconteceu: bloquear virou
      // escolha, e avisar "entrou na blocklist" quando não entrou faz o dono
      // acreditar que queimou um cliente que segue liberado.
      toast.aviso(
        bloquearCliente
          ? 'Reserva recusada e cliente bloqueado. Ele recebeu apenas a mensagem padrão.'
          : 'Reserva recusada. O cliente segue liberado e recebeu apenas a mensagem padrão.'
      );
      setMotivoAberto(false);
      onDecisao();
    } catch (err) {
      toast.erro(err.message);
      setProcessando(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho do cliente */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-borda bg-elevado/50">
        <Avatar name={reserva.customer_name || 'Cliente'} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-conteudo truncate">
            {reserva.customer_name || 'Cliente sem nome'}
          </h3>
          <p className="text-[13px] text-suave">{telefone(reserva.customer_phone)}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-conteudo tabular">{brl(reserva.total_amount)}</div>
          <div className="text-[11px] text-suave">
            {reserva.days_count} diária(s) + {brl(reserva.deposit_snapshot)} caução
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* O que o sistema já verificou — vem primeiro porque é o que decide. */}
        <JaConferido risco={risco} />

        {/* ------------------------------ Só falta o seu olho */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-semibold text-conteudo-2">Só falta você olhar</span>
            <span className="text-[11px] text-suave-2 tabular">
              {conferidos}/{OLHO_HUMANO.length}
            </span>
          </div>

          <div className="space-y-2">
            {OLHO_HUMANO.map((item) => {
              const marcado = !!check[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCheck({ ...check, [item.id]: !marcado })}
                  className={cx(
                    'w-full flex items-start gap-3 px-3.5 py-3 rounded-xl text-left border transition-all active:scale-[0.995]',
                    marcado
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40'
                      : 'border-borda hover:border-borda-forte hover:bg-elevado'
                  )}
                >
                  <span
                    className={cx(
                      'grid place-items-center w-6 h-6 rounded-lg border-2 shrink-0 transition-all mt-0.5',
                      marcado
                        ? 'bg-emerald-500 border-emerald-500 scale-110'
                        : 'border-borda-forte'
                    )}
                  >
                    {marcado && <Check size={14} className="text-white animate-scale-in" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cx(
                        'block text-[13.5px] font-medium',
                        marcado ? 'text-emerald-800 dark:text-emerald-300' : 'text-conteudo'
                      )}
                    >
                      {item.pergunta}
                    </span>
                    <span className="block text-[12px] text-suave mt-0.5 leading-snug">
                      {item.ajuda}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------ Dados completos (recolhidos) */}
        <details className="group rounded-xl border border-borda">
          <summary className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer text-[13px] font-medium text-conteudo-2 hover:bg-elevado rounded-xl transition-colors list-none">
            <ChevronRight
              size={15}
              className="shrink-0 transition-transform group-open:rotate-90"
            />
            Ver os dados completos da reserva
          </summary>
          <div className="px-3.5 pb-3.5 pt-1">
            <Info rotulo="Veículo" valor={`${reserva.vehicle_model} · ${reserva.vehicle_plate}`} />
            <Info rotulo="Retirada" valor={dt(reserva.pickup_at)} />
            <Info rotulo="Devolução" valor={dt(reserva.return_at)} />
            <Info rotulo="CPF" valor={reserva.customer_cpf ? fmtCpf(reserva.customer_cpf) : null} />
            <Info rotulo="CNH" valor={reserva.customer_cnh} />
            <Info
              rotulo="Validade da CNH"
              valor={
                reserva.customer_cnh_valid_until ? data(reserva.customer_cnh_valid_until) : null
              }
            />
            <Info
              rotulo="Consentimento LGPD"
              valor={reserva.customer_lgpd_consent_at ? 'Concedido' : 'Pendente'}
              alerta={!reserva.customer_lgpd_consent_at}
            />
          </div>
        </details>
      </div>

      {/* ------------------------------ Documentos */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[13px] font-semibold text-conteudo-2">Documentos enviados</span>
          {docs && docs.length > 0 && (
            <Badge tone="brand">
              {docs.length} arquivo{docs.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {docs === null ? (
          <div className="h-32 rounded-xl bg-elevado animate-pulse" />
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 text-sm text-suave-2 border border-dashed border-borda rounded-xl px-4 py-8">
            <FileImage size={20} className="text-suave-2" />
            Nenhum documento enviado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {docs.map((d, i) => {
              const pdf = (d.mime_type || '').includes('pdf');
              const rotulo = TIPO_DOC[d.type] || d.type;
              if (pdf) {
                return (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block rounded-xl overflow-hidden border border-borda hover:border-brand-400 transition-all text-left"
                  >
                    <div className="w-full h-28 grid place-content-center justify-items-center gap-1 bg-elevado">
                      <FileText size={26} className="text-red-500" />
                      <span className="text-[10px] font-semibold text-suave">PDF · abrir</span>
                    </div>
                    <div className="px-2 py-1.5 text-[11px] text-conteudo-2 truncate bg-superficie">
                      {rotulo}
                    </div>
                  </a>
                );
              }
              return (
                <button
                  key={d.id}
                  onClick={() => setLightbox(i)}
                  className="group relative rounded-xl overflow-hidden border border-borda hover:border-brand-400 transition-all text-left"
                >
                  <img
                    src={d.url}
                    alt={rotulo}
                    className="w-full h-28 object-cover bg-sutil"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/30 transition-colors grid place-items-center">
                    <Maximize2
                      size={18}
                      className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <div className="px-2 py-1.5 text-[11px] text-conteudo-2 truncate bg-superficie">
                    {rotulo}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------ Decisão */}
      <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 border-t border-borda bg-elevado/50">
        <Button icon={BadgeCheck} onClick={aprovar} loading={processando} className="sm:flex-none">
          Aprovar reserva
        </Button>
        <Button
          variant="danger-soft"
          icon={X}
          // Sempre começa em branco: o motivo e a marcação de bloqueio da
          // recusa anterior não podem reaparecer na próxima.
          onClick={() => {
            setMotivo('');
            setBloquearCliente(false);
            setMotivoAberto(true);
          }}
          disabled={processando}
        >
          Recusar
        </Button>
        <span className="hidden sm:flex items-center text-[11.5px] text-suave-2 ml-auto">
          A aprovação é sempre sua — a IA nunca confirma sozinha.
        </span>
      </div>

      {/* Janela: motivo da recusa */}
      <Modal
        open={motivoAberto}
        onClose={() => setMotivoAberto(false)}
        title="Recusar pré-reserva"
        subtitle="O motivo é interno e nunca é enviado ao cliente."
        icon={CircleAlert}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setMotivoAberto(false)}>
              Voltar
            </Button>
            <Button variant="danger" type="submit" form="form-recusa" loading={processando}>
              Confirmar recusa
            </Button>
          </>
        }
      >
        <form id="form-recusa" onSubmit={recusar}>
          <Field
            label="Motivo interno"
            hint="Fica registrado no seu histórico para consulta futura."
            required
          >
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: selfie não confere com a foto da CNH."
              required
              autoFocus
            />
          </Field>
          {/* Bloquear é escolha: recusar por documento ilegível ou porque o
              carro quebrou não deveria queimar o cliente para sempre. */}
          <button
            type="button"
            onClick={() => setBloquearCliente((v) => !v)}
            className={cx(
              'mt-4 w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border text-left transition-all',
              bloquearCliente
                ? 'bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/40'
                : 'border-borda hover:border-borda-forte hover:bg-elevado'
            )}
          >
            <span
              className={cx(
                'grid place-items-center w-6 h-6 rounded-lg border-2 shrink-0 transition-all mt-0.5',
                bloquearCliente ? 'bg-red-500 border-red-500' : 'border-borda-forte'
              )}
            >
              {bloquearCliente && <Check size={14} className="text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-conteudo">
                Bloquear este cliente para sempre
              </span>
              <span className="block text-[12px] text-suave mt-0.5 leading-snug">
                Marque só se ele não deve mais alugar com você. CPF e telefone entram na
                blocklist. Recusa por documento ilegível ou carro indisponível não precisa disso.
              </span>
            </span>
          </button>

          <div className="mt-3 flex gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 p-3.5">
            <ShieldAlert size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-amber-800 dark:text-amber-300 leading-relaxed">
              O cliente recebe apenas uma mensagem padrão, <b>sem o motivo</b>. O que você
              escreveu acima fica só no seu histórico.
            </p>
          </div>
        </form>
      </Modal>

      {/* Visualizador de documentos */}
      {lightbox !== null && docs?.[lightbox] && (
        <div
          className="fixed inset-0 z-[95] bg-ink-950/90 backdrop-blur-sm flex flex-col animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <div className="flex items-center justify-between px-5 py-4 text-white shrink-0">
            <span className="text-sm font-medium">
              {TIPO_DOC[docs[lightbox].type] || docs[lightbox].type}
              <span className="text-white/50 ml-2">
                {lightbox + 1}/{docs.length}
              </span>
            </span>
            <button
              onClick={() => setLightbox(null)}
              aria-label="Fechar"
              className="p-2 rounded-lg hover:bg-superficie/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div
            className="flex-1 flex items-center justify-center gap-3 px-3 pb-6 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox((i) => (i - 1 + docs.length) % docs.length)}
              className="p-3 rounded-full bg-superficie/10 text-white hover:bg-superficie/20 transition-colors shrink-0"
              aria-label="Documento anterior"
            >
              <ChevronLeft size={20} />
            </button>
            {(docs[lightbox].mime_type || '').includes('pdf') ? (
              <a
                href={docs[lightbox].url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col items-center gap-3 text-white"
              >
                <FileText size={64} />
                <span className="text-sm font-medium underline">Abrir PDF em nova aba</span>
              </a>
            ) : (
              <img
                src={docs[lightbox].url}
                alt=""
                className="max-h-full max-w-full object-contain rounded-xl"
              />
            )}
            <button
              onClick={() => setLightbox((i) => (i + 1) % docs.length)}
              className="p-3 rounded-full bg-superficie/10 text-white hover:bg-superficie/20 transition-colors shrink-0"
              aria-label="Próximo documento"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Festinha ao aprovar — some sozinha em ~1,5s. */}
      <Comemoracao ativo={comemorar} aoTerminar={() => setComemorar(false)} />
    </Card>
  );
}

export default function Analise() {
  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setReservas(await api.get('/api/reservations?status=em_analise'));
    } catch (e) {
      // Sem isto, uma falha da API deixava a tela dizendo "nada aguardando
      // análise" — que é a pior mentira possível aqui: parece que não há
      // ninguém esperando decisão quando na verdade a lista nem carregou.
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div>
      <PageHeader
        icon={ClipboardCheck}
        title="Análise de pré-reservas"
        subtitle="Confira os documentos e decida: aprovar libera a reserva e avisa o cliente."
      >
        {reservas.length > 0 && (
          <Badge tone="amber">
            {reservas.length} aguardando você
          </Badge>
        )}
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {carregando ? (
        <SkeletonCards count={2} />
      ) : erro ? null : reservas.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="Nada aguardando análise"
            hint="Quando um cliente enviar os documentos pelo WhatsApp, a pré-reserva aparece aqui para você aprovar ou recusar."
          />
        </Card>
      ) : (
        <div className="space-y-5 stagger">
          {reservas.map((r) => (
            <CartaoAnalise key={r.id} reserva={r} onDecisao={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
