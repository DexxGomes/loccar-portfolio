// ============================================================================
//  ESTRUTURA DO PAINEL (v2)
//  Menu grafite fixo no computador, gaveta deslizante no celular, barra
//  superior com busca por comandos (⌘K), sino de pendências e menu do usuário.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { lerSessao } from '../sessao.js';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Car,
  ClipboardCheck,
  MessageSquare,
  Ban,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
  CircleUser,
  LayoutDashboard,
  CalendarRange,
  Wallet,
  Sun,
  Moon,
  Users,
  UserRound,
  FileText,
  CalendarClock,
  ArrowUpRight,
  Settings,
  Gavel,
  Receipt,
  Sunrise,
  PiggyBank,
} from 'lucide-react';
import Logo from './Logo.jsx';
import CommandPalette from './CommandPalette.jsx';
import usePendencias from '../hooks/usePendencias.js';
import { useTema } from '../hooks/useTema.jsx';
import { Avatar, Kbd, cx } from './ui.jsx';
import { hora } from '../format.js';

// ----------------------------------------------------------------------------
//  NAVEGAÇÃO
//  O menu lateral tem POUCOS itens (um por assunto). As telas irmãs de cada
//  assunto viram ABAS na barra de cima — assim ninguém precisa decorar 14
//  nomes para achar uma coisa.
//
//  `abas` é a lista de telas do assunto; a primeira é para onde o menu leva.
// ----------------------------------------------------------------------------
const SECOES = [
  {
    id: 'hoje',
    label: 'Hoje',
    icon: Sunrise,
    to: '/hoje',
    abas: [
      { to: '/hoje', label: 'O que fazer hoje', icon: Sunrise, chaves: ['hoje', 'tarefas', 'início', 'agora'] },
      { to: '/painel', label: 'Números', icon: LayoutDashboard, chaves: ['dashboard', 'painel', 'receita', 'indicadores', 'gráficos'] },
    ],
  },
  {
    id: 'locacoes',
    label: 'Locações',
    icon: Calendar,
    to: '/agenda',
    selo: 'analise',
    abas: [
      { to: '/agenda', label: 'Agenda', icon: Calendar, chaves: ['reservas', 'locações', 'retirada', 'devolução', 'vistoria'] },
      { to: '/timeline', label: 'Linha do tempo', icon: CalendarRange, chaves: ['gantt', 'calendário', 'disponibilidade', 'manutenção', 'bloqueio'] },
      { to: '/analise', label: 'Análise', icon: ClipboardCheck, selo: 'analise', chaves: ['documentos', 'aprovar', 'recusar', 'risco'] },
    ],
  },
  {
    id: 'frota',
    label: 'Frota',
    icon: Car,
    to: '/frota',
    abas: [
      { to: '/frota', label: 'Veículos', icon: Car, chaves: ['veículos', 'carros', 'diária', 'manutenção', 'ipva', 'km'] },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: UserRound,
    to: '/clientes',
    abas: [
      { to: '/clientes', label: 'Clientes', icon: UserRound, chaves: ['locatários', 'histórico', 'cpf', 'lgpd', 'endereço'] },
      { to: '/leads', label: 'Leads', icon: Users, chaves: ['funil', 'kanban', 'prospecção', 'contatos'] },
      { to: '/blocklist', label: 'Bloqueados', icon: Ban, chaves: ['blocklist', 'bloqueados', 'cpf'] },
    ],
  },
  {
    id: 'dinheiro',
    label: 'Dinheiro',
    icon: Wallet,
    to: '/dinheiro',
    abas: [
      { to: '/dinheiro', label: 'Resumo', icon: PiggyBank, chaves: ['dinheiro', 'resumo', 'saldo', 'sobrou', 'entrou', 'gastei', 'caixa'] },
      { to: '/financeiro', label: 'A receber', icon: Wallet, chaves: ['pagamentos', 'cobranca', 'pix', 'receber', 'caucao', 'financeiro'] },
      { to: '/despesas', label: 'Despesas & caixa', icon: Receipt, chaves: ['despesa', 'fluxo de caixa', 'saldo', 'custo'] },
      { to: '/multas', label: 'Multas', icon: Gavel, chaves: ['infração', 'trânsito', 'repasse'] },
      { to: '/relatorio', label: 'Relatórios', icon: FileText, chaves: ['relatório', 'mensal', 'pdf', 'imprimir', 'fechamento'] },
    ],
  },
  {
    id: 'conversas',
    label: 'Conversas',
    icon: MessageSquare,
    to: '/conversas',
    selo: 'conversas',
    abas: [
      { to: '/conversas', label: 'WhatsApp', icon: MessageSquare, selo: 'conversas', chaves: ['whatsapp', 'atendimento', 'mensagens'] },
    ],
  },
];

// Configurações sai do menu principal: é raro e já está no menu do usuário.
const CONFIG = {
  to: '/configuracoes',
  label: 'Configurações',
  icon: Settings,
  chaves: ['config', 'contrato', 'cnpj', 'dados', 'ajustes', 'cláusulas', 'senha'],
};

// Todas as telas em uma lista só — alimenta a busca ⌘K.
const TODAS_AS_TELAS = [...SECOES.flatMap((s) => s.abas), CONFIG];

/** Descobre em que seção está a tela aberta (para marcar o menu e as abas). */
function secaoDaRota(pathname) {
  return SECOES.find((s) => s.abas.some((a) => pathname.startsWith(a.to)));
}

/** Fecha um painel flutuante quando o clique acontece fora dele. */
function useClickFora(ref, aoFechar) {
  useEffect(() => {
    function aoClicar(e) {
      if (ref.current && !ref.current.contains(e.target)) aoFechar();
    }
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [ref, aoFechar]);
}

/** Item do menu lateral (uma seção). */
function ItemMenu({ secao, ativo, contagem, onIr }) {
  const { to, label, icon: Icon } = secao;
  return (
    <NavLink
      to={to}
      onClick={onIr}
      className={cx(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
        ativo
          ? 'bg-brand-600 text-white font-medium shadow-brand-glow'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {/* Marcador vertical do item ativo */}
      <span
        className={cx(
          'absolute -left-4 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-brand-400 transition-all duration-300',
          ativo ? 'h-6 opacity-100' : 'h-0 opacity-0'
        )}
      />
      <Icon size={17} strokeWidth={2.1} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {contagem > 0 && (
        <span
          className={cx(
            'px-1.5 min-w-[20px] h-5 grid place-items-center rounded-full text-[11px] font-bold',
            ativo ? 'bg-white/25 text-white' : 'bg-brand-600 text-white'
          )}
        >
          {contagem}
        </span>
      )}
    </NavLink>
  );
}

/**
 * Abas da seção aberta. Só aparecem quando a seção tem mais de uma tela.
 * No celular rolam de lado (sem barra de rolagem visível).
 */
function AbasDaSecao({ secao, pathname, contagem }) {
  if (!secao || secao.abas.length < 2) return null;

  return (
    <div className="border-b border-borda bg-superficie/60 print:hidden">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mb-px">
          {secao.abas.map((aba) => {
            const ativa = pathname.startsWith(aba.to);
            const n = contagem(aba.selo);
            return (
              <NavLink
                key={aba.to}
                to={aba.to}
                className={cx(
                  'shrink-0 flex items-center gap-2 px-3.5 py-3 text-[13.5px] border-b-2 transition-colors whitespace-nowrap',
                  ativa
                    ? 'border-brand-600 text-brand-700 dark:text-brand-400 font-semibold'
                    : 'border-transparent text-suave hover:text-conteudo hover:border-borda-forte'
                )}
              >
                <aba.icon size={15} strokeWidth={2.1} />
                {aba.label}
                {n > 0 && (
                  <span className="px-1.5 min-w-[19px] h-[19px] grid place-items-center rounded-full bg-brand-600 text-white text-[10.5px] font-bold">
                    {n}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const pendencias = usePendencias();
  const { escuro, alternar } = useTema();

  const [gaveta, setGaveta] = useState(false); // menu no celular
  const [paleta, setPaleta] = useState(false); // ⌘K
  const [sino, setSino] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);

  const refSino = useRef(null);
  const refUsuario = useRef(null);
  useClickFora(refSino, () => setSino(false));
  useClickFora(refUsuario, () => setMenuUsuario(false));

  const tenant = lerSessao('tenant');
  const usuario = lerSessao('user');

  function sair() {
    localStorage.clear();
    nav('/login');
  }

  // Atalho ⌘K / Ctrl+K abre a busca de comandos.
  useEffect(() => {
    function aoTeclar(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta((v) => !v);
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  // Trocar de tela fecha a gaveta do celular.
  useEffect(() => setGaveta(false), [pathname]);

  const secaoAtual = secaoDaRota(pathname);

  // A busca ⌘K continua enxergando TODAS as telas, mesmo as que agora vivem
  // dentro de abas — quem já sabe o nome chega direto.
  const comandos = [
    ...TODAS_AS_TELAS.map((l) => ({
      id: l.to,
      label: l.label,
      grupo: 'Ir para',
      icon: l.icon,
      to: l.to,
      chaves: l.chaves,
    })),
    { id: 'sair', label: 'Sair da conta', grupo: 'Conta', icon: LogOut, acao: sair },
  ];

  const contagem = (chave) => (chave ? pendencias[chave] : 0);

  // ---------------------------------------------------------------- menu
  const conteudoMenu = (
    <>
      {/* Marca */}
      <div className="px-2">
        <div className="flex items-center gap-2.5">
          <Logo size={30} className="text-brand-500 shrink-0" />
          <div className="text-[26px] font-extrabold tracking-tight leading-none">
            <span className="text-white">Loc</span>
            <span className="text-brand-500">Car</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 mt-2 tracking-wide">Reservas no WhatsApp</div>
      </div>

      {/* Locadora conectada */}
      {tenant.name && (
        <div className="mt-6 mx-1 px-3 py-2.5 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.06]">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">Locadora</div>
          <div className="text-[13px] font-medium text-slate-200 truncate">{tenant.name}</div>
        </div>
      )}

      {/* Navegação — um item por assunto; o resto vira aba lá em cima. */}
      <nav className="flex flex-col gap-1 mt-7 flex-1 overflow-y-auto px-1 -mx-1">
        {SECOES.map((s) => (
          <ItemMenu
            key={s.id}
            secao={s}
            ativo={secaoAtual?.id === s.id}
            contagem={contagem(s.selo)}
          />
        ))}

        <div className="mt-auto pt-3">
          <ItemMenu
            secao={CONFIG}
            ativo={pathname.startsWith(CONFIG.to)}
            contagem={0}
          />
        </div>
      </nav>

      {/* Usuário */}
      <div className="mt-4 pt-4 border-t border-white/[0.07]">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar name={usuario.name || 'Usuário'} size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-slate-200 truncate">
              {usuario.name || 'Usuário'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{usuario.email}</div>
          </div>
          <button
            onClick={sair}
            aria-label="Sair"
            title="Sair"
            className="p-2 rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-fundo text-conteudo-2">
      {/* ----------------- Menu fixo (computador) ----------------- */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-ink-900 text-slate-100 p-4 flex-col z-40 print:hidden">
        {conteudoMenu}
      </aside>

      {/* ----------------- Gaveta (celular) ----------------- */}
      {gaveta && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setGaveta(false)} />
          <aside className="relative w-[270px] bg-ink-900 text-slate-100 p-4 flex flex-col animate-slide-in-left">
            <button
              onClick={() => setGaveta(false)}
              aria-label="Fechar menu"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
            >
              <X size={18} />
            </button>
            {conteudoMenu}
          </aside>
        </div>
      )}

      {/* ----------------- Coluna de conteúdo ----------------- */}
      <div className="lg:pl-64 print:!pl-0">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 glass border-b border-borda print:hidden">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-6 lg:px-8">
            {/* Celular: abrir menu + marca */}
            <button
              onClick={() => setGaveta(true)}
              aria-label="Abrir menu"
              className="lg:hidden p-2 -ml-2 rounded-xl text-conteudo-2 hover:bg-sutil"
            >
              <Menu size={20} />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <Logo size={22} className="text-brand-600" />
              <span className="text-lg font-extrabold tracking-tight">
                <span className="text-conteudo">Loc</span>
                <span className="text-brand-600">Car</span>
              </span>
            </div>

            {/* Busca por comandos */}
            <button
              onClick={() => setPaleta(true)}
              className="hidden sm:flex items-center gap-2.5 w-full max-w-xs px-3.5 py-2 rounded-xl bg-superficie border border-borda text-suave-2 text-sm hover:border-borda-forte hover:text-suave transition-colors shadow-sm"
            >
              <Search size={16} />
              <span className="flex-1 text-left">Buscar telas e ações…</span>
              <Kbd>⌘K</Kbd>
            </button>

            <div className="flex-1" />

            {/* Tema: claro ou escuro. Fica ao lado do sino, então aparece
                igual no computador e no celular. */}
            <button
              onClick={alternar}
              aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
              title={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
              className="relative grid place-items-center w-10 h-10 rounded-xl text-suave hover:bg-sutil hover:text-conteudo transition-colors"
            >
              {/* Os dois ícones ficam sobrepostos e trocam girando: sem pulo
                  de layout e sem trocar o ícone no meio do clique. */}
              <Sun
                size={19}
                className={cx(
                  'absolute transition-all duration-300',
                  escuro ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
                )}
              />
              <Moon
                size={18}
                className={cx(
                  'absolute transition-all duration-300',
                  escuro ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
                )}
              />
            </button>

            {/* Sino de pendências */}
            <div className="relative" ref={refSino}>
              <button
                onClick={() => setSino((v) => !v)}
                aria-label="Pendências"
                className="relative grid place-items-center w-10 h-10 rounded-xl text-suave hover:bg-sutil hover:text-conteudo transition-colors"
              >
                <Bell size={19} />
                {pendencias.total > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-superficie animate-pulse-ring">
                    {pendencias.total}
                  </span>
                )}
              </button>

              {sino && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-[21rem] bg-superficie rounded-2xl shadow-pop ring-1 ring-borda overflow-hidden animate-scale-in origin-top-right">
                  <div className="px-4 py-3 border-b border-borda">
                    <div className="text-sm font-semibold text-conteudo">Lembretes de hoje</div>
                    <div className="text-xs text-suave mt-0.5">
                      {new Date().toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                      })}
                    </div>
                  </div>

                  {pendencias.total === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-suave-2">
                      Nada pra hoje e nada pendente. Dia tranquilo. ✨
                    </p>
                  ) : (
                    <div className="max-h-[70vh] overflow-y-auto">
                      {/* ---------------- Agenda do dia ---------------- */}
                      {pendencias.hoje.resumo.total > 0 && (
                        <div className="py-1">
                          <div className="px-4 pt-2 pb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-suave-2">
                            <CalendarClock size={13} /> Agenda do dia
                          </div>
                          {pendencias.hoje.eventos.slice(0, 6).map((ev) => {
                            const tom = ev.atrasada
                              ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                              : ev.tipo === 'retirada'
                              ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
                              : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
                            return (
                              <button
                                key={`${ev.tipo}-${ev.id}`}
                                onClick={() => {
                                  setSino(false);
                                  nav('/agenda');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-elevado text-left transition-colors"
                              >
                                <span className={cx('grid place-items-center w-9 h-9 rounded-xl shrink-0', tom)}>
                                  {ev.tipo === 'retirada' ? <ArrowUpRight size={17} /> : <CalendarClock size={17} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5 text-sm text-conteudo font-medium">
                                    {ev.tipo === 'retirada' ? 'Retirada' : 'Devolução'}
                                    {ev.atrasada && (
                                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 px-1.5 py-0.5 rounded">
                                        atrasada
                                      </span>
                                    )}
                                    <span className="ml-auto text-xs text-suave tabular">{hora(ev.quando)}</span>
                                  </span>
                                  <span className="block text-xs text-suave truncate">
                                    {ev.customer_name || 'Cliente'} · {ev.vehicle_model}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                          {pendencias.hoje.eventos.length > 6 && (
                            <button
                              onClick={() => {
                                setSino(false);
                                nav('/agenda');
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-elevado text-left transition-colors"
                            >
                              Ver todos os {pendencias.hoje.eventos.length} na agenda →
                            </button>
                          )}
                        </div>
                      )}

                      {/* ---------------- Precisa de você ---------------- */}
                      {(pendencias.analise > 0 || pendencias.conversas > 0) && (
                        <div className="py-1 border-t border-borda">
                          <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-suave-2">
                            Precisa de você
                          </div>
                          {pendencias.analise > 0 && (
                            <button
                              onClick={() => {
                                setSino(false);
                                nav('/analise');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-elevado text-left transition-colors"
                            >
                              <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                                <ClipboardCheck size={17} />
                              </span>
                              <span className="text-sm text-conteudo-2">
                                <b className="text-conteudo">{pendencias.analise}</b> pré-reserva(s)
                                aguardando sua análise
                              </span>
                            </button>
                          )}
                          {pendencias.conversas > 0 && (
                            <button
                              onClick={() => {
                                setSino(false);
                                nav('/conversas');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-elevado text-left transition-colors"
                            >
                              <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shrink-0">
                                <MessageSquare size={17} />
                              </span>
                              <span className="text-sm text-conteudo-2">
                                <b className="text-conteudo">{pendencias.conversas}</b> conversa(s)
                                precisam de um humano
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Menu do usuário */}
            <div className="relative" ref={refUsuario}>
              <button
                onClick={() => setMenuUsuario((v) => !v)}
                className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-sutil transition-colors"
              >
                <Avatar name={usuario.name || 'Usuário'} size={32} />
                <ChevronDown size={15} className="text-suave-2 hidden sm:block" />
              </button>

              {menuUsuario && (
                <div className="absolute right-0 mt-2 w-64 bg-superficie rounded-2xl shadow-pop ring-1 ring-borda overflow-hidden animate-scale-in origin-top-right">
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-borda">
                    <Avatar name={usuario.name || 'Usuário'} size={38} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-conteudo truncate">
                        {usuario.name || 'Usuário'}
                      </div>
                      <div className="text-xs text-suave truncate">{usuario.email}</div>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 text-[11px] text-suave-2 flex items-center gap-2">
                    <CircleUser size={13} />
                    {tenant.name || 'Locadora'}
                  </div>
                  <button
                    onClick={sair}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors border-t border-borda"
                  >
                    <LogOut size={16} />
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Abas do assunto aberto (Locações, Clientes, Dinheiro…) */}
          <AbasDaSecao secao={secaoAtual} pathname={pathname} contagem={contagem} />
        </header>

        {/* Conteúdo da tela */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 print:!p-0">
          <div className="mx-auto max-w-[1400px] animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paleta} onClose={() => setPaleta(false)} comandos={comandos} />
    </div>
  );
}
