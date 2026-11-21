// ============================================================================
//  CONVERSAS
//  Caixa de entrada do WhatsApp: à esquerda os atendimentos, à direita o fio
//  de mensagens. No celular, abrir uma conversa ocupa a tela inteira.
//
//  Observação: mídias recebidas aparecem como marcador — as fotos de documento
//  são vistas na tela de Análise, com URL assinada e temporária.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  MessagesSquare,
  ArrowLeft,
  CheckCheck,
  Image as ImageIcon,
  Bot,
  User,
  Search,
  Inbox,
} from 'lucide-react';
import { api } from '../api.js';
import { dt, hora, relativo, telefone } from '../format.js';
import { Skeleton } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Modal.jsx';
import {
  PageHeader,
  Card,
  Button,
  EmptyState,
  Avatar,
  Badge,
  Segmented,
  Input,
  cx,
} from '../components/ui.jsx';

const FILTROS = [
  { value: 'humano', label: 'Precisam de você' },
  { value: 'todas', label: 'Todas' },
];

/** Bolha de uma mensagem no fio. */
function Bolha({ m }) {
  const entrada = m.direction === 'inbound';
  const sistema = m.type === 'system';

  if (sistema) {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 rounded-full bg-sutil text-[11px] text-suave">
          {m.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cx('flex', entrada ? 'justify-start' : 'justify-end')}>
      <div
        className={cx(
          'max-w-[78%] sm:max-w-[68%] px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm',
          entrada
            ? 'bg-superficie text-conteudo-2 rounded-2xl rounded-tl-md border border-borda'
            : 'bg-brand-600 text-white rounded-2xl rounded-tr-md'
        )}
      >
        {m.type === 'image' ? (
          <span
            className={cx(
              'flex items-center gap-2 italic',
              entrada ? 'text-suave' : 'text-brand-50'
            )}
          >
            <ImageIcon size={15} /> Imagem recebida
          </span>
        ) : (
          <span className="whitespace-pre-wrap break-words">{m.content}</span>
        )}
        <div
          className={cx(
            'text-[10px] mt-1 flex items-center gap-1',
            entrada ? 'text-suave-2' : 'text-brand-100/80 justify-end'
          )}
        >
          {m.type === 'template' && <Badge tone="slate">lembrete</Badge>}
          {hora(m.created_at)}
        </div>
      </div>
    </div>
  );
}

export default function Conversas() {
  const [conversas, setConversas] = useState([]);
  const [ativa, setAtiva] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoFio, setCarregandoFio] = useState(false);
  const [filtro, setFiltro] = useState('humano');
  const [busca, setBusca] = useState('');

  const fimDoFio = useRef(null);
  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    setCarregando(true);
    try {
      const q = filtro === 'humano' ? '?needs_human=true' : '';
      setConversas(await api.get(`/api/conversations${q}`));
    } catch (e) {
      toast.erro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    setAtiva(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  // Rola para a última mensagem sempre que o fio muda.
  useEffect(() => {
    fimDoFio.current?.scrollIntoView({ block: 'end' });
  }, [mensagens]);

  async function abrir(conv) {
    setAtiva(conv);
    setCarregandoFio(true);
    try {
      setMensagens(await api.get(`/api/conversations/${conv.id}/messages`));
    } catch (e) {
      toast.erro(e.message);
    } finally {
      setCarregandoFio(false);
    }
  }

  async function resolver(conv) {
    const ok = await confirmar({
      titulo: 'Devolver o atendimento para a IA?',
      mensagem:
        'A conversa sai da sua lista e a IA volta a responder automaticamente as próximas mensagens deste cliente.',
      confirmar: 'Marcar como resolvido',
      tom: 'brand',
    });
    if (!ok) return;
    try {
      await api.post(`/api/conversations/${conv.id}/resolve`);
      toast.sucesso('Atendimento resolvido. A IA reassumiu a conversa.');
      setAtiva(null);
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return conversas;
    return conversas.filter((c) =>
      `${c.customer_name || ''} ${c.phone}`.toLowerCase().includes(t)
    );
  }, [conversas, busca]);

  const precisamHumano = conversas.filter((c) => c.needs_human).length;

  return (
    <div>
      <PageHeader
        icon={MessageSquare}
        title="Conversas"
        subtitle="Atendimentos do WhatsApp. A IA cuida do resto — aqui ficam os que chamaram por você."
      >
        <Segmented
          value={filtro}
          onChange={setFiltro}
          options={FILTROS.map((f) => ({
            ...f,
            count: f.value === 'humano' ? precisamHumano || undefined : undefined,
          }))}
        />
      </PageHeader>

      <div className="flex gap-5 lg:h-[calc(100vh-230px)] lg:min-h-[460px]">
        {/* ------------------------------------------------ Lista */}
        <Card
          className={cx(
            'w-full lg:w-[340px] shrink-0 flex flex-col overflow-hidden',
            ativa && 'hidden lg:flex'
          )}
        >
          <div className="p-3 border-b border-borda">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave-2" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar contato…"
                className="pl-9 py-2 text-[13px]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtradas.length === 0 ? (
              <EmptyState
                icon={filtro === 'humano' ? MessagesSquare : Inbox}
                title={filtro === 'humano' ? 'Tudo em dia' : 'Nenhuma conversa ainda'}
                hint={
                  filtro === 'humano'
                    ? 'Nenhuma conversa precisa de você agora.'
                    : 'As conversas aparecem assim que os clientes chamarem no WhatsApp.'
                }
              />
            ) : (
              filtradas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => abrir(c)}
                  className={cx(
                    'w-full flex items-start gap-3 px-4 py-3.5 border-b border-borda text-left transition-colors',
                    ativa?.id === c.id ? 'bg-brand-50/70 dark:bg-brand-500/10' : 'hover:bg-elevado'
                  )}
                >
                  <Avatar name={c.customer_name || 'Cliente'} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-[13.5px] text-conteudo truncate">
                        {c.customer_name || telefone(c.phone)}
                      </span>
                      <span className="text-[10.5px] text-suave-2 shrink-0">
                        {relativo(c.last_message_at)}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-suave-2">{telefone(c.phone)}</div>
                    {c.needs_human && c.needs_human_reason && (
                      <div className="mt-1.5 text-[11.5px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 rounded-lg px-2 py-1 line-clamp-2">
                        {c.needs_human_reason}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ Fio de mensagens */}
        <Card className={cx('flex-1 flex flex-col overflow-hidden', !ativa && 'hidden lg:flex')}>
          {!ativa ? (
            <EmptyState
              icon={MessageSquare}
              title="Selecione uma conversa"
              hint="Escolha um atendimento na lista ao lado para ver o histórico completo."
              className="m-auto"
            />
          ) : (
            <>
              {/* Cabeçalho do fio */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-borda shrink-0">
                <button
                  onClick={() => setAtiva(null)}
                  className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-suave hover:bg-sutil"
                  aria-label="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <Avatar name={ativa.customer_name || 'Cliente'} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-conteudo text-[14px] truncate">
                    {ativa.customer_name || 'Cliente'}
                  </div>
                  <div className="text-[11.5px] text-suave-2">{telefone(ativa.phone)}</div>
                </div>
                {ativa.needs_human && (
                  <Button size="sm" icon={CheckCheck} onClick={() => resolver(ativa)}>
                    <span className="hidden sm:inline">Marcar como resolvido</span>
                    <span className="sm:hidden">Resolver</span>
                  </Button>
                )}
              </div>

              {/* Motivo da transferência */}
              {ativa.needs_human && ativa.needs_human_reason && (
                <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-500/15 border-b border-amber-100 dark:border-amber-500/25 text-[12.5px] text-amber-800 dark:text-amber-300 flex items-center gap-2 shrink-0">
                  <User size={14} className="shrink-0" />
                  Transferido para humano: {ativa.needs_human_reason}
                </div>
              )}

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-elevado/60 min-h-[280px]">
                {carregandoFio ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-2/3 rounded-2xl" />
                    <Skeleton className="h-12 w-1/2 rounded-2xl ml-auto" />
                    <Skeleton className="h-16 w-3/5 rounded-2xl" />
                  </div>
                ) : mensagens.length === 0 ? (
                  <p className="text-center text-sm text-suave-2 py-10">
                    Nenhuma mensagem registrada nesta conversa.
                  </p>
                ) : (
                  <>
                    <div className="text-center">
                      <span className="text-[11px] text-suave-2 bg-superficie px-2.5 py-1 rounded-full border border-borda">
                        {dt(mensagens[0]?.created_at)}
                      </span>
                    </div>
                    {mensagens.map((m) => (
                      <Bolha key={m.id} m={m} />
                    ))}
                    <div ref={fimDoFio} />
                  </>
                )}
              </div>

              {/* Rodapé explicativo */}
              <div className="px-4 py-2.5 border-t border-borda text-[11.5px] text-suave-2 flex items-center gap-2 shrink-0">
                <Bot size={14} />
                Para responder, use o WhatsApp da locadora no celular. Ao resolver, a IA reassume.
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
