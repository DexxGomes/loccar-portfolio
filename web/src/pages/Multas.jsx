// ============================================================================
//  MULTAS / INFRAÇÕES
//  Registra multas por veículo e controla o repasse ao locatário.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { Gavel, Plus, Trash2, CarFront, UserRound, CalendarDays } from 'lucide-react';
import { api } from '../api.js';
import { brl, data as fmtData, telefone } from '../format.js';
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
  Segmented,
  ErrorBanner,
  IconButton,
  cx,
} from '../components/ui.jsx';

const STATUS = {
  pendente: { label: 'Pendente', tone: 'amber' },
  repassada: { label: 'Repassada', tone: 'brand' },
  paga: { label: 'Paga', tone: 'green' },
};
const FILTROS = [
  { value: '', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'repassada', label: 'Repassadas' },
  { value: 'paga', label: 'Pagas' },
];
const VAZIO = { vehicle_id: '', customer_id: '', description: '', amount: '', date: '', status: 'pendente', notes: '' };

export default function Multas() {
  const [multas, setMultas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [m, v, c] = await Promise.all([
        api.get('/api/fines'),
        api.get('/api/vehicles'),
        api.get('/api/customers').catch(() => []),
      ]);
      setMultas(m);
      setVeiculos(v);
      setClientes(c);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      const payload = { description: form.description.trim(), status: form.status };
      if (form.vehicle_id) payload.vehicle_id = form.vehicle_id;
      if (form.customer_id) payload.customer_id = form.customer_id;
      if (form.amount !== '') payload.amount = Number(form.amount);
      if (form.date) payload.date = form.date;
      if (form.notes.trim()) payload.notes = form.notes.trim();
      await api.post('/api/fines', payload);
      toast.sucesso('Multa registrada.');
      setAberto(false);
      setForm(VAZIO);
      carregar();
    } catch (err) {
      setErroForm(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(m, status) {
    setMultas((atual) => atual.map((x) => (x.id === m.id ? { ...x, status } : x)));
    try {
      await api.patch(`/api/fines/${m.id}`, { status });
    } catch (e) {
      toast.erro(e.message);
      carregar();
    }
  }

  async function remover(m) {
    const ok = await confirmar({
      titulo: 'Remover multa?',
      mensagem: 'A multa sai do controle. Não pode ser desfeito.',
      confirmar: 'Remover',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/fines/${m.id}`);
      setMultas((atual) => atual.filter((x) => x.id !== m.id));
    } catch (e) {
      toast.erro(e.message);
    }
  }

  const filtradas = useMemo(
    () => (filtro ? multas.filter((m) => m.status === filtro) : multas),
    [multas, filtro]
  );
  const totalPendente = useMemo(
    () =>
      multas
        .filter((m) => m.status !== 'paga')
        .reduce((s, m) => s + (Number(m.amount) || 0), 0),
    [multas]
  );

  return (
    <div>
      <PageHeader icon={Gavel} title="Multas" subtitle="Infrações por veículo e o repasse ao locatário.">
        <Button icon={Plus} onClick={() => { setForm(VAZIO); setErroForm(''); setAberto(true); }}>
          Registrar multa
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {/* Resumo + filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <Card className="p-3.5 flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <Gavel size={18} />
          </span>
          <div>
            <div className="text-lg font-bold text-conteudo leading-none tabular">{brl(totalPendente)}</div>
            <div className="text-[11px] text-suave mt-1">a receber (não pagas)</div>
          </div>
        </Card>
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <Segmented value={filtro} onChange={setFiltro} options={FILTROS} />
        </div>
      </div>

      {carregando ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gavel}
            title="Nenhuma multa por aqui"
            hint="Registre uma multa para controlar o repasse ao cliente."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 stagger">
          {filtradas.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-conteudo leading-snug">{m.description}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-suave">
                    {m.vehicle_model && (
                      <span className="inline-flex items-center gap-1">
                        <CarFront size={12} /> {m.vehicle_model} · {m.vehicle_plate}
                      </span>
                    )}
                    {m.customer_name && (
                      <span className="inline-flex items-center gap-1">
                        <UserRound size={12} /> {m.customer_name}
                      </span>
                    )}
                    {m.date && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} /> {fmtData(m.date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-lg font-bold text-conteudo tabular shrink-0">{brl(m.amount)}</div>
              </div>

              {m.notes && <p className="text-xs text-suave mt-2 leading-relaxed">{m.notes}</p>}

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-borda">
                <Select
                  value={m.status}
                  onChange={(e) => mudarStatus(m, e.target.value)}
                  className="!py-1.5 !text-[13px] max-w-[10rem]"
                >
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
                <Badge tone={STATUS[m.status]?.tone || 'slate'}>{STATUS[m.status]?.label}</Badge>
                <IconButton
                  icon={Trash2}
                  label="Remover"
                  size={15}
                  onClick={() => remover(m)}
                  className="ml-auto hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Registrar multa */}
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Registrar multa"
        icon={Gavel}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-multa" loading={salvando}>
              Registrar
            </Button>
          </>
        }
      >
        <form id="form-multa" onSubmit={salvar} className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <Field label="Descrição" required className="col-span-2 sm:col-span-6">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: Excesso de velocidade — Av. Brasil"
              required
            />
          </Field>
          <Field label="Veículo" hint="Qual carro tomou a multa" className="col-span-2 sm:col-span-3">
            <Select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">— selecione —</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.model} · {v.plate}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cliente" hint="Quem estava com o carro (opcional)" className="col-span-2 sm:col-span-3">
            <Select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">— nenhum —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || telefone(c.phone)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor (R$)" className="col-span-1 sm:col-span-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Ex.: 195,23"
            />
          </Field>
          <Field label="Data da infração" className="col-span-1 sm:col-span-2">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Situação" className="col-span-2 sm:col-span-2">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observações" className="col-span-2 sm:col-span-6">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Opcional — ex.: número do AIT, órgão autuador…"
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
