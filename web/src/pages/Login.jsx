// ============================================================================
//  LOGIN
//  Entrada por CPF (ou e-mail) + senha. No primeiro acesso, o sistema obriga
//  a troca da senha inicial antes de entrar.
//  Fundo preto, campos só com contorno — a identidade da porta de entrada.
// ============================================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { lerSessao } from '../sessao.js';
import Logo from '../components/Logo.jsx';

const INPUT =
  'w-full bg-transparent border border-slate-700 text-white rounded-xl px-3.5 py-3 outline-none ' +
  'transition-all placeholder:text-slate-600 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

/** Vai pondo os pontos e o traço do CPF conforme a pessoa digita. */
function mascararCpf(valor) {
  const d = String(valor).replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default function Login() {
  // CPF é a porta principal; o e-mail fica como alternativa. São dois modos, e
  // não um campo que adivinha, porque no celular cada um pede um teclado
  // diferente: teclado numérico para o CPF, teclado com @ para o e-mail.
  const [modo, setModo] = useState('cpf');
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Passo de troca obrigatória (primeiro acesso).
  const [precisaTrocar, setPrecisaTrocar] = useState(false);
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const nav = useNavigate();
  const porCpf = modo === 'cpf';

  function guardarSessao(r) {
    localStorage.setItem('token', r.token);
    localStorage.setItem('tenant', JSON.stringify(r.tenant));
    localStorage.setItem('user', JSON.stringify(r.user));
  }

  function trocarModo() {
    setModo(porCpf ? 'email' : 'cpf');
    setIdentificador('');
    setErro('');
  }

  function digitarIdentificador(e) {
    const v = e.target.value;
    setIdentificador(porCpf ? mascararCpf(v) : v);
  }

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const r = await api.login(identificador, senha);
      guardarSessao(r); // guarda o token para poder trocar a senha se preciso
      if (r.user?.mustChangePassword) {
        setPrecisaTrocar(true);
      } else {
        nav('/hoje');
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function trocarObrigatorio(e) {
    e.preventDefault();
    setErro('');
    if (nova !== confirmar) {
      setErro('A confirmação não bate com a nova senha.');
      return;
    }
    if (nova === senha) {
      setErro('A nova senha precisa ser diferente da senha inicial.');
      return;
    }
    setCarregando(true);
    try {
      // A "senha atual" é a inicial que ele acabou de usar para entrar.
      await api.post('/api/auth/change-password', { senhaAtual: senha, novaSenha: nova });
      // A marca já caiu no banco; atualiza a sessão guardada para combinar.
      const u = lerSessao('user');
      localStorage.setItem('user', JSON.stringify({ ...u, mustChangePassword: false }));
      nav('/hoje');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black px-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[560px] h-[420px] opacity-70 glow-brand"
      />

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Marca */}
        <div className="flex items-center justify-center gap-3">
          <Logo size={40} className="text-brand-600" />
          <div className="text-4xl font-extrabold tracking-tight">
            <span className="text-white">Loc</span>
            <span className="text-brand-600">Car</span>
          </div>
        </div>
        <p className="text-sm text-slate-400 text-center mt-2 mb-9">Reservas no WhatsApp</p>

        {erro && (
          <div className="mb-5 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/40 border border-red-900/80 rounded-xl px-3.5 py-3 animate-fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {!precisaTrocar ? (
          <form onSubmit={entrar}>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="identificador" className="block text-sm font-medium text-slate-300">
                {porCpf ? 'CPF' : 'E-mail'}
              </label>
              <button
                type="button"
                onClick={trocarModo}
                // py/-my dão área de toque de dedo sem empurrar o layout.
                className="text-[12px] text-slate-400 hover:text-brand-400 transition-colors
                           underline underline-offset-2 py-2 -my-2 px-1 -mx-1 rounded"
              >
                {porCpf ? 'Entrar com e-mail' : 'Entrar com CPF'}
              </button>
            </div>
            <input
              id="identificador"
              type={porCpf ? 'text' : 'email'}
              // No celular isso decide o teclado que sobe: só números para o
              // CPF, e o teclado com @ para o e-mail.
              inputMode={porCpf ? 'numeric' : 'email'}
              autoComplete={porCpf ? 'username' : 'email'}
              maxLength={porCpf ? 14 : undefined}
              value={identificador}
              onChange={digitarIdentificador}
              className={INPUT + ' mb-5'}
              placeholder={porCpf ? '000.000.000-00' : 'voce@sualocadora.com.br'}
              required
            />

            <label htmlFor="senha" className="block text-sm font-medium text-slate-300 mb-1.5">
              Senha
            </label>
            <div className="relative mb-7">
              <input
                id="senha"
                type={verSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={INPUT + ' pr-11'}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="group w-full flex items-center justify-center gap-2 bg-brand-700 text-white font-medium py-3 rounded-xl
                         transition-all hover:bg-brand-600 hover:shadow-brand-glow active:scale-[0.99]
                         disabled:opacity-60 disabled:pointer-events-none"
            >
              {carregando ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={trocarObrigatorio}>
            <div className="mb-5 flex items-start gap-2.5 text-sm text-brand-200 bg-brand-950/40 border border-brand-900/80 rounded-xl px-3.5 py-3">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <span>Primeiro acesso: defina uma senha só sua para continuar.</span>
            </div>

            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nova senha</label>
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              className={INPUT + ' mb-1.5'}
              placeholder="Mínimo 6 caracteres"
              required
            />
            <p className="text-[11px] text-slate-500 mb-5">Use letras, números e um símbolo (ex.: #A456654m).</p>

            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar nova senha</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className={INPUT + ' mb-7'}
              placeholder="••••••••"
              required
            />

            <button
              type="submit"
              disabled={carregando}
              className="group w-full flex items-center justify-center gap-2 bg-brand-700 text-white font-medium py-3 rounded-xl
                         transition-all hover:bg-brand-600 hover:shadow-brand-glow active:scale-[0.99]
                         disabled:opacity-60 disabled:pointer-events-none"
            >
              {carregando ? 'Salvando…' : 'Salvar e entrar'}
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-slate-600 mt-8">LocCar · painel da locadora</p>
      </div>
    </div>
  );
}
