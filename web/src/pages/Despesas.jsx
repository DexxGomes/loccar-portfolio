// ============================================================================
//  DESPESAS + FLUXO DE CAIXA
//  Registra as saídas da locadora e mostra, por mês: receita x despesa = saldo.
//  A receita vem do painel (reservas que valem dinheiro no período).
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  CarFront,
  CalendarDays,
} from 'lucide-react';
import { api } from '../api.js';
import { brl, data as fmtData } from '../format.js';
import { useToast } from '../components/Toast.jsx';
import { Modal, useConfirm } from '../components/Modal.jsx';
import {
  PageHeader,
  Card,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  ErrorBanner,
  IconButton,
  Loading,
  cx,
} from '../components/ui.jsx';

const CATEGORIAS = [
  'Manutenção',
  'Combustível',
  'Seguro',
  'IPVA / Licenciamento',
  'Salários',
  'Aluguel',
  'Marketing',
  'Impostos',
  'Outros',
];
const VAZIO = { category: 'Manutenção', description: '', amount: '', date: '', vehicle_id: '', notes: '' };

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function deslocarMes(mes, delta) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Despesas() {
  const [mes, setMes] = useState(mesAtual());
  const [despesas, setDespesas] = useState([]);
  const [receita, setReceita] = useState(0);
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const toast = useToast();
  const confirmar = useConfirm();

  const intervalo = useMemo(() => {
    const [a, m] = mes.split('-').map(Number);
    const inicio = new Date(a, m - 1, 1);
    const fim = new Date(a, m, 0); // último dia do mês
    const iso = (d) => d.toISOString();
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      from: ymd(inicio),
      to: ymd(fim),
      fromISO: iso(inicio),
      toISO: iso(new Date(a, m, 1)),
      rotulo: inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    };
  }, [mes]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const q = new URLSearchParams({ from: intervalo.from, to: intervalo.to });
      const qd = new URLSearchParams({ from: intervalo.fromISO, to: intervalo.toISO });
      const [d, dash, v] = await Promise.all([
        api.get(`/api/expenses?${q.toString()}`),
        api.get(`/api/dashboard?${qd.toString()}`).catch(() => null),
        api.get('/api/vehicles').catch(() => []),
      ]);
      setDespesas(d);
      setReceita(dash?.indicadores?.receita?.valor || 0);
      setVeiculos(v);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [intervalo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalDespesas = useMemo(
    () => despesas.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [despesas]
  );
  const saldo = receita - totalDespesas;

  async function salvar(e) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      const payload = {
        category: form.category,
        amount: Number(form.amount || 0),
        date: form.date || intervalo.from,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.vehicle_id) payload.vehicle_id = form.vehicle_id;
      if (form.notes.trim()) payload.notes = form.notes.trim();
      await api.post('/api/expenses', payload);
      toast.sucesso('Despesa registrada.');
      setAberto(false);
      setForm(VAZIO);
      carregar();
    } catch (err) {
      setErroForm(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(d) {
    const ok = await confirmar({
      titulo: 'Remover despesa?',
      mensagem: 'A despesa sai do fluxo de caixa.',
      confirmar: 'Remover',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/expenses/${d.id}`);
      setDespesas((atual) => atual.filter((x) => x.id !== d.id));
    } catch (e) {
      toast.erro(e.message);
    }
  }

  const ehMesAtual = mes >= mesAtual();

  return (
    <div>
      <PageHeader icon={Receipt} title="Despesas & caixa" subtitle="O que entra e o que sai, mês a mês.">
        <Button
          icon={Plus}
          onClick={() => {
            setForm({ ...VAZIO, date: intervalo.from });
            setErroForm('');
            setAberto(true);
          }}
        >
          Nova despesa
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {/* Navegação de mês */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setMes((m) => deslocarMes(m, -1))}
          className="grid place-items-center w-9 h-9 rounded-xl border border-borda text-suave hover:text-conteudo hover:bg-sutil transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={17} />
        </button>
        <span className="text-sm font-semibold text-conteudo capitalize min-w-[9rem] text-center">
          {intervalo.rotulo}
        </span>
        <button
          onClick={() => setMes((m) => deslocarMes(m, +1))}
          disabled={ehMesAtual}
          className="grid place-items-center w-9 h-9 rounded-xl border border-borda text-suave hover:text-conteudo hover:bg-sutil transition-colors disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Próximo mês"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {/* Fluxo de caixa do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[12px] text-suave mb-1">
            <TrendingUp size={14} className="text-emerald-500" /> Receita
          </div>
          <div className="text-2xl font-bold text-conteudo tabular leading-none">{brl(receita)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[12px] text-suave mb-1">
            <TrendingDown size={14} className="text-red-500" /> Despesas
          </div>
          <div className="text-2xl font-bold text-conteudo tabular leading-none">{brl(totalDespesas)}</div>
        </Card>
        <Card className={cx('p-4', saldo >= 0 ? 'ring-1 ring-inset ring-emerald-200 dark:ring-emerald-500/30' : 'ring-1 ring-inset ring-red-200 dark:ring-red-500/30')}>
          <div className="flex items-center gap-1.5 text-[12px] text-suave mb-1">
            <Wallet size={14} /> Saldo do mês
          </div>
          <div
            className={cx(
              'text-2xl font-bold tabular leading-none',
              saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            {brl(saldo)}
          </div>
        </Card>
      </div>

      {/* Lista de despesas */}
      {carregando ? (
        <Loading label="Carregando o mês…" />
      ) : despesas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="Sem despesas neste mês"
            hint="Registre as saídas (manutenção, combustível, seguro…) para acompanhar o saldo."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-borda">
          {despesas.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-conteudo">{d.category}</span>
                  {d.description && <span className="text-xs text-suave truncate">· {d.description}</span>}
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-suave-2 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={11} /> {fmtData(d.date)}
                  </span>
                  {d.vehicle_model && (
                    <span className="inline-flex items-center gap-1">
                      <CarFront size={11} /> {d.vehicle_model} · {d.vehicle_plate}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold text-conteudo tabular shrink-0">{brl(d.amount)}</div>
              <IconButton
                icon={Trash2}
                label="Remover"
                size={15}
                onClick={() => remover(d)}
                className="shrink-0 hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
              />
            </div>
          ))}
        </Card>
      )}

      {/* Nova despesa */}
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Nova despesa"
        icon={Receipt}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-despesa" loading={salvando}>
              Registrar
            </Button>
          </>
        }
      >
        <form id="form-despesa" onSubmit={salvar} className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <Field label="Categoria" required className="col-span-2 sm:col-span-3">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor (R$)" required className="col-span-1 sm:col-span-3">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Ex.: 350,00"
              required
            />
          </Field>
          <Field label="Data" required className="col-span-1 sm:col-span-2">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </Field>
          <Field label="Veículo" hint="Se a despesa é de um carro (opcional)" className="col-span-2 sm:col-span-4">
            <Select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">— nenhum —</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.model} · {v.plate}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição" className="col-span-2 sm:col-span-6">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: troca de pastilhas de freio"
            />
          </Field>
          <Field label="Observações" className="col-span-2 sm:col-span-6">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Opcional"
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
    </div>
  );
}
