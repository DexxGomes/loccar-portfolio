// ============================================================================
//  FROTA
//  Cada veículo é um cartão (funciona igual de bem no celular e no monitor).
//  Cadastro e edição acontecem em uma janela, não em um formulário fixo.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Car,
  Plus,
  Search,
  Pencil,
  Trash2,
  Wallet,
  ShieldCheck,
  Palette,
  CalendarDays,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { api } from '../api.js';
import { brl, data, STATUS_VEICULO } from '../format.js';
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
  Loading,
  cx,
} from '../components/ui.jsx';

// Mesma lista aceita pela API (src/utils/categorias.js).
const CATEGORIAS = ['hatch', 'sedan', 'SUV', 'picape', 'minivan'];

const VAZIO = {
  model: '',
  plate: '',
  category: 'hatch',
  daily_rate: '',
  deposit_amount: '',
  status: 'disponivel',
  year: '',
  color: '',
  notes: '',
  odometer: '',
  next_revision_km: '',
  ipva_due: '',
  licensing_due: '',
  insurance_due: '',
};

const FILTROS = [
  { value: '', label: 'Todos' },
  { value: 'disponivel', label: 'Disponíveis' },
  { value: 'alugado', label: 'Alugados' },
  { value: 'manutencao', label: 'Manutenção' },
];

/** Dias até uma data (negativo = já venceu). */
function diasAte(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

/** Documentos vencidos ou vencendo nos próximos 30 dias. */
function alertasDoc(v) {
  return [
    { label: 'IPVA', dias: diasAte(v.ipva_due) },
    { label: 'Licenciamento', dias: diasAte(v.licensing_due) },
    { label: 'Seguro', dias: diasAte(v.insurance_due) },
  ].filter((d) => d.dias !== null && d.dias <= 30);
}

/** Cartão de um veículo da frota. */
function CartaoVeiculo({ v, onEditar, onRemover, onManutencao }) {
  const alertas = alertasDoc(v);
  const piorDias = alertas.length ? Math.min(...alertas.map((a) => a.dias)) : null;
  const s = STATUS_VEICULO[v.status] || { label: v.status, tone: 'slate' };
  return (
    <Card hover className="p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cx(
              'grid place-items-center w-11 h-11 rounded-xl shrink-0',
              v.status === 'disponivel'
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : v.status === 'alugado'
                ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
                : 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
            )}
          >
            <Car size={20} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-conteudo truncate">{v.model}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono font-medium text-suave bg-sutil px-1.5 py-0.5 rounded">
                {v.plate}
              </span>
              <span className="text-xs text-suave-2 capitalize">{v.category}</span>
            </div>
          </div>
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-xl bg-elevado px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-suave mb-1">
            <Wallet size={12} /> Diária
          </div>
          <div className="text-lg font-bold text-conteudo leading-none tabular">
            {brl(v.daily_rate)}
          </div>
        </div>
        <div className="rounded-xl bg-elevado px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-suave mb-1">
            <ShieldCheck size={12} /> Caução
          </div>
          <div className="text-lg font-bold text-conteudo leading-none tabular">
            {brl(v.deposit_amount)}
          </div>
        </div>
      </div>

      {/* Detalhes opcionais */}
      {(v.year || v.color) && (
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-suave">
          {v.year && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} /> {v.year}
            </span>
          )}
          {v.color && (
            <span className="inline-flex items-center gap-1.5">
              <Palette size={12} /> {v.color}
            </span>
          )}
        </div>
      )}

      {v.notes && (
        <p className="mt-3 text-xs text-suave leading-relaxed line-clamp-2">{v.notes}</p>
      )}

      {/* Alerta de documento — só aparece quando há vencimento próximo ou vencido */}
      {alertas.length > 0 && (
        <div
          className={cx(
            'mt-3 rounded-lg px-2.5 py-1.5 text-[11.5px] flex items-start gap-1.5',
            piorDias < 0
              ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300'
              : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
          )}
        >
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            {alertas.map((a) => `${a.label} ${a.dias < 0 ? 'vencido' : `em ${a.dias}d`}`).join(' · ')}
          </span>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-4">
        <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onEditar(v)}>
          Editar
        </Button>
        <Button variant="secondary" size="sm" icon={Wrench} onClick={() => onManutencao(v)}>
          Manutenção
        </Button>
        <IconButton
          icon={Trash2}
          label="Remover veículo"
          size={16}
          onClick={() => onRemover(v)}
          className="ml-auto hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
        />
      </div>
    </Card>
  );
}

/** Janela de manutenções de um veículo (histórico + adicionar). */
function ModalManutencao({ vehicle, onClose }) {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState({ date: '', type: '', odometer: '', cost: '', notes: '' });
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    if (!vehicle) return;
    setLista(null);
    try {
      setLista(await api.get(`/api/vehicles/${vehicle.id}/manutencoes`));
    } catch {
      setLista([]);
    }
  }

  useEffect(() => {
    if (vehicle) {
      setForm({ date: new Date().toISOString().slice(0, 10), type: '', odometer: '', cost: '', notes: '' });
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle]);

  async function adicionar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const payload = { date: form.date, type: form.type.trim() };
      if (form.odometer) payload.odometer = Number(form.odometer);
      if (form.cost) payload.cost = Number(form.cost);
      if (form.notes.trim()) payload.notes = form.notes.trim();
      await api.post(`/api/vehicles/${vehicle.id}/manutencoes`, payload);
      toast.sucesso('Manutenção registrada.');
      setForm({ ...form, type: '', odometer: '', cost: '', notes: '' });
      carregar();
    } catch (err) {
      toast.erro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(rec) {
    const ok = await confirmar({
      titulo: 'Remover registro?',
      mensagem: 'Essa manutenção sai do histórico.',
      confirmar: 'Remover',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/vehicles/${vehicle.id}/manutencoes/${rec.id}`);
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  return (
    <Modal
      open={!!vehicle}
      onClose={onClose}
      title="Manutenções"
      subtitle={vehicle ? `${vehicle.model} · ${vehicle.plate}` : ''}
      icon={Wrench}
      size="lg"
    >
      {/* Adicionar — cada campo com exemplo */}
      <form onSubmit={adicionar} className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <Field label="Data" required className="col-span-2 sm:col-span-2">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </Field>
        <Field label="Serviço" required className="col-span-2 sm:col-span-4">
          <Input
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            placeholder="Ex.: Revisão dos 40 mil km"
            required
          />
        </Field>
        <Field label="Km" className="col-span-1 sm:col-span-2">
          <Input
            type="number"
            value={form.odometer}
            onChange={(e) => setForm({ ...form, odometer: e.target.value })}
            placeholder="Ex.: 42000"
          />
        </Field>
        <Field label="Custo (R$)" className="col-span-1 sm:col-span-2">
          <Input
            type="number"
            step="0.01"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            placeholder="Ex.: 350,00"
          />
        </Field>
        <div className="col-span-2 sm:col-span-2 flex items-end">
          <Button type="submit" icon={Plus} loading={salvando} block>
            Adicionar
          </Button>
        </div>
        <Field label="Observações" className="col-span-2 sm:col-span-6">
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Opcional — ex.: trocado filtro e óleo"
          />
        </Field>
      </form>

      <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mb-2">Histórico</div>
      {lista === null ? (
        <Loading label="Carregando…" />
      ) : lista.length === 0 ? (
        <p className="text-sm text-suave-2 text-center py-6">Nenhuma manutenção registrada ainda.</p>
      ) : (
        <div className="divide-y divide-borda">
          {lista.map((m) => (
            <div key={m.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-conteudo">{m.type}</div>
                <div className="text-xs text-suave">
                  {data(m.date)}
                  {m.odometer ? ` · ${m.odometer} km` : ''}
                  {m.cost ? ` · ${brl(m.cost)}` : ''}
                </div>
                {m.notes && <div className="text-xs text-suave-2 mt-0.5">{m.notes}</div>}
              </div>
              <IconButton
                icon={Trash2}
                label="Remover"
                size={15}
                onClick={() => remover(m)}
                className="hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function Frota() {
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  // Quais campos a API recusou — usado para marcar cada um em vermelho.
  const [camposComErro, setCamposComErro] = useState({});
  const [manutencao, setManutencao] = useState(null); // veículo com o modal de manutenção aberto

  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setVeiculos(await api.get('/api/vehicles'));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Atalho ⌘K → "Cadastrar veículo" chega com ?novo=1
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
    setCamposComErro({});
    setAberto(true);
  }

  function abrirEdicao(v) {
    setEditId(v.id);
    setForm({
      model: v.model ?? '',
      plate: v.plate ?? '',
      category: v.category ?? 'hatch',
      daily_rate: v.daily_rate ?? '',
      deposit_amount: v.deposit_amount ?? '',
      status: v.status ?? 'disponivel',
      year: v.year ?? '',
      color: v.color ?? '',
      notes: v.notes ?? '',
      odometer: v.odometer ?? '',
      next_revision_km: v.next_revision_km ?? '',
      ipva_due: v.ipva_due ? String(v.ipva_due).slice(0, 10) : '',
      licensing_due: v.licensing_due ? String(v.licensing_due).slice(0, 10) : '',
      insurance_due: v.insurance_due ? String(v.insurance_due).slice(0, 10) : '',
    });
    setErroForm('');
    setCamposComErro({});
    setAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setErroForm('');
    setCamposComErro({});
    setSalvando(true);
    try {
      // Campos vazios não são enviados (evita gravar "" ou 0 sem querer).
      const payload = {
        model: form.model,
        plate: form.plate.toUpperCase(),
        category: form.category,
        daily_rate: Number(form.daily_rate),
        deposit_amount: Number(form.deposit_amount || 0),
        status: form.status,
      };
      if (form.year) payload.year = Number(form.year);
      if (form.color.trim()) payload.color = form.color.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.odometer !== '') payload.odometer = Number(form.odometer);
      if (form.next_revision_km !== '') payload.next_revision_km = Number(form.next_revision_km);
      if (form.ipva_due) payload.ipva_due = form.ipva_due;
      if (form.licensing_due) payload.licensing_due = form.licensing_due;
      if (form.insurance_due) payload.insurance_due = form.insurance_due;

      if (editId) await api.patch(`/api/vehicles/${editId}`, payload);
      else await api.post('/api/vehicles', payload);

      toast.sucesso(editId ? 'Veículo atualizado.' : `${payload.model} entrou na frota.`);
      setAberto(false);
      carregar();
    } catch (err) {
      setErroForm(err.message);
      setCamposComErro(err.campos || {});
    } finally {
      setSalvando(false);
    }
  }

  async function remover(v) {
    const ok = await confirmar({
      titulo: `Remover ${v.model}?`,
      mensagem: `O veículo de placa ${v.plate} sai da frota. Reservas já registradas continuam no histórico.`,
      confirmar: 'Remover',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/vehicles/${v.id}`);
      toast.sucesso('Veículo removido.');
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  // ------------------------------------------------------------------ dados
  const contagens = useMemo(() => {
    const c = {};
    for (const v of veiculos) c[v.status] = (c[v.status] || 0) + 1;
    return c;
  }, [veiculos]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return veiculos
      .filter((v) => (filtro ? v.status === filtro : true))
      .filter((v) =>
        t ? `${v.model} ${v.plate} ${v.category}`.toLowerCase().includes(t) : true
      );
  }, [veiculos, filtro, busca]);

  return (
    <div>
      <PageHeader
        icon={Car}
        title="Frota"
        subtitle="Os veículos que a IA oferece no WhatsApp e seus valores."
      >
        <Button icon={Plus} onClick={abrirNovo}>
          Adicionar veículo
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suave-2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por modelo, placa ou categoria…"
            className="pl-10"
          />
        </div>
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <Segmented
            value={filtro}
            onChange={setFiltro}
            options={FILTROS.map((f) => ({
              ...f,
              count: f.value ? contagens[f.value] : veiculos.length,
            }))}
          />
        </div>
      </div>

      {/* Grade de veículos */}
      {carregando ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-11 h-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          {veiculos.length === 0 ? (
            <EmptyState
              icon={Car}
              title="Sua frota está vazia"
              hint="Cadastre o primeiro veículo para a IA começar a oferecer opções no WhatsApp."
              action={
                <Button icon={Plus} onClick={abrirNovo}>
                  Adicionar veículo
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nenhum veículo encontrado"
              hint="Ajuste a busca ou o filtro de situação."
            />
          )}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {filtrados.map((v) => (
            <CartaoVeiculo
              key={v.id}
              v={v}
              onEditar={abrirEdicao}
              onRemover={remover}
              onManutencao={setManutencao}
            />
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Janela de cadastro/edição                                        */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={editId ? 'Editar veículo' : 'Adicionar veículo'}
        subtitle={editId ? 'Alterações valem para novas reservas.' : 'Ele entra na oferta da IA.'}
        icon={Car}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAberto(false)} type="button">
              Cancelar
            </Button>
            <Button type="submit" form="form-veiculo" loading={salvando}>
              {editId ? 'Salvar alterações' : 'Adicionar à frota'}
            </Button>
          </>
        }
      >
        <form id="form-veiculo" onSubmit={salvar} className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <Field label="Modelo" required error={camposComErro?.model?.[0]} className="col-span-2 sm:col-span-4">
            <Input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Fiat Argo 1.0"
              required
            />
          </Field>
          <Field label="Placa" required error={camposComErro?.plate?.[0]} className="col-span-2">
            <Input
              value={form.plate}
              onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
              placeholder="ABC1D23"
              className="font-mono"
              required
            />
          </Field>

          <Field label="Categoria" required error={camposComErro?.category?.[0]} className="col-span-2">
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Diária (R$)" required error={camposComErro?.daily_rate?.[0]} className="col-span-1 sm:col-span-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.daily_rate}
              onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
              placeholder="160,00"
              required
            />
          </Field>
          <Field
            label="Caução (R$)"
            hint="Cobrada à parte do total."
            className="col-span-1 sm:col-span-2"
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.deposit_amount}
              onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
              placeholder="500,00"
            />
          </Field>

          <Field label="Ano" className="col-span-1 sm:col-span-2">
            <Input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              placeholder="2023"
            />
          </Field>
          <Field label="Cor" className="col-span-1 sm:col-span-2">
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="Prata"
            />
          </Field>
          <Field label="Situação" className="col-span-2">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="disponivel">Disponível</option>
              <option value="alugado">Alugado</option>
              <option value="manutencao">Manutenção</option>
            </Select>
          </Field>

          {/* Documentos e manutenção — tudo opcional, com exemplo em cada campo */}
          <div className="col-span-2 sm:col-span-6 pt-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2">
              Documentos e manutenção{' '}
              <span className="normal-case font-normal">(opcional — te avisamos dos vencimentos)</span>
            </div>
          </div>

          <Field label="Km atual" hint="Odômetro hoje" className="col-span-1 sm:col-span-3">
            <Input
              type="number"
              min="0"
              value={form.odometer}
              onChange={(e) => setForm({ ...form, odometer: e.target.value })}
              placeholder="Ex.: 45000"
            />
          </Field>
          <Field label="Próxima revisão (km)" hint="Em qual km revisar" className="col-span-1 sm:col-span-3">
            <Input
              type="number"
              min="0"
              value={form.next_revision_km}
              onChange={(e) => setForm({ ...form, next_revision_km: e.target.value })}
              placeholder="Ex.: 60000"
            />
          </Field>
          <Field label="IPVA vence em" hint="Data de vencimento" className="col-span-2 sm:col-span-2">
            <Input
              type="date"
              value={form.ipva_due}
              onChange={(e) => setForm({ ...form, ipva_due: e.target.value })}
            />
          </Field>
          <Field label="Licenciamento vence em" className="col-span-1 sm:col-span-2">
            <Input
              type="date"
              value={form.licensing_due}
              onChange={(e) => setForm({ ...form, licensing_due: e.target.value })}
            />
          </Field>
          <Field label="Seguro vence em" className="col-span-1 sm:col-span-2">
            <Input
              type="date"
              value={form.insurance_due}
              onChange={(e) => setForm({ ...form, insurance_due: e.target.value })}
            />
          </Field>

          <Field
            label="Observações internas"
            hint="Só você vê. O cliente nunca recebe esse texto."
            className="col-span-2 sm:col-span-6"
          >
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex.: revisão dos 40 mil km em setembro."
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

      {/* Janela de manutenções */}
      <ModalManutencao vehicle={manutencao} onClose={() => setManutencao(null)} />
    </div>
  );
}
