// ============================================================================
//  CLIENTES
//  Lista/busca de clientes com resumo, e um detalhe com histórico de reservas,
//  situação na blocklist e exclusão de dados (LGPD).
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Phone,
  IdCard,
  Ban,
  ShieldCheck,
  Trash2,
  CalendarClock,
  MapPin,
  Pencil,
} from 'lucide-react';
import { api } from '../api.js';
import { telefone, cpf as fmtCpf, dt, data, brl, relativo } from '../format.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import { Modal, useConfirm } from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import {
  PageHeader,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  Field,
  Badge,
  Button,
  Avatar,
  Loading,
  cx,
} from '../components/ui.jsx';

/** Endereço em uma linha, do mesmo jeito que sai no contrato. */
function enderecoEmLinha(c) {
  const logradouro = [c.street, c.street_number, c.complement].filter(Boolean).join(', ');
  const cidadeUf = [c.city, c.state].filter(Boolean).join('/');
  const cep = c.zip_code?.length === 8 ? `CEP ${c.zip_code.slice(0, 5)}-${c.zip_code.slice(5)}` : null;
  const partes = [logradouro, c.district, cidadeUf, cep].filter(Boolean);
  return partes.length ? partes.join(' — ') : null;
}

/** Cartão de um cliente na lista. */
function CartaoCliente({ c, onAbrir }) {
  return (
    <button
      onClick={() => onAbrir(c)}
      className="text-left w-full bg-superficie border border-borda rounded-2xl p-4 shadow-card dark:shadow-none hover:border-borda-forte hover:shadow-card-hover transition-all"
    >
      <div className="flex items-center gap-3">
        <Avatar name={c.name || 'Cliente'} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-conteudo truncate">{c.name || 'Sem nome'}</div>
          <div className="text-xs text-suave">{telefone(c.phone)}</div>
        </div>
      </div>
      <div className="flex items-center flex-wrap gap-2 mt-3">
        <Badge tone="slate">{c.total_reservas} reserva(s)</Badge>
        {c.finalizadas > 0 && <Badge tone="green">{c.finalizadas} finalizada(s)</Badge>}
        {c.ultima_atividade && (
          <span className="text-[11px] text-suave-2 inline-flex items-center gap-1">
            <CalendarClock size={11} /> {relativo(c.ultima_atividade)}
          </span>
        )}
      </div>
    </button>
  );
}

/** Detalhe do cliente: dados, blocklist, histórico e LGPD. */
function ModalCliente({ cliente, onClose, onMudou }) {
  const [detalhe, setDetalhe] = useState(null);
  const [reservas, setReservas] = useState(null);
  const [editando, setEditando] = useState(false);
  const toast = useToast();
  const confirmar = useConfirm();

  useEffect(() => {
    if (!cliente) return;
    setDetalhe(null);
    setReservas(null);
    setEditando(false);
    api.get(`/api/customers/${cliente.id}`).then(setDetalhe).catch(() => setDetalhe(false));
    api.get(`/api/customers/${cliente.id}/reservations`).then(setReservas).catch(() => setReservas([]));
  }, [cliente]);

  async function excluirLgpd() {
    const ok = await confirmar({
      titulo: 'Excluir dados do cliente?',
      mensagem:
        'Apaga TODOS os dados e documentos deste cliente (direito ao esquecimento — LGPD). Não pode ser desfeito.',
      confirmar: 'Excluir tudo',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/customers/${cliente.id}/data`);
      toast.sucesso('Dados do cliente excluídos.');
      onClose();
      onMudou();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  const bloqueado = detalhe && detalhe.blocklist;

  return (
    <Modal
      open={!!cliente}
      onClose={onClose}
      title={cliente?.name || 'Cliente'}
      subtitle={cliente ? telefone(cliente.phone) : ''}
      icon={Users}
      size="lg"
    >
      {detalhe === null ? (
        <Loading label="Carregando…" />
      ) : detalhe === false ? (
        <p className="text-sm text-suave-2 text-center py-6">Não foi possível carregar o cliente.</p>
      ) : editando ? (
        <FormularioCliente
          cliente={detalhe}
          onCancelar={() => setEditando(false)}
          onSalvo={(atualizado) => {
            setDetalhe((d) => ({ ...d, ...atualizado }));
            setEditando(false);
            onMudou();
          }}
        />
      ) : (
        <>
          {/* Situação */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {bloqueado ? (
              <Badge tone="red" icon={Ban}>
                Na blocklist
              </Badge>
            ) : (
              <Badge tone="green" icon={ShieldCheck}>
                Liberado
              </Badge>
            )}
            {detalhe.lgpd_consent_at && <Badge tone="brand">Consentiu LGPD</Badge>}
          </div>

          {/* Dados */}
          <div className="rounded-xl border border-borda p-4 mb-5">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              <Dado icon={Phone} rotulo="Telefone" valor={telefone(detalhe.phone)} />
              <Dado icon={IdCard} rotulo="CPF" valor={detalhe.cpf ? fmtCpf(detalhe.cpf) : '—'} />
              <Dado icon={IdCard} rotulo="CNH" valor={detalhe.cnh_number || '—'} />
              <Dado
                icon={CalendarClock}
                rotulo="Cliente desde"
                valor={detalhe.created_at ? data(detalhe.created_at) : '—'}
              />
            </div>

            {/* Endereço: é o que falta no contrato quando está vazio. */}
            <div className="mt-2 pt-2 border-t border-borda flex items-start gap-2 py-1">
              <MapPin size={14} className="text-suave-2 shrink-0 mt-0.5" />
              <span className="text-xs text-suave shrink-0">Endereço:</span>
              {enderecoEmLinha(detalhe) ? (
                <span className="text-[13px] font-medium text-conteudo">
                  {enderecoEmLinha(detalhe)}
                </span>
              ) : (
                <span className="text-[13px] text-amber-700 dark:text-amber-400">
                  Não cadastrado — o contrato sai incompleto
                </span>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-borda flex justify-end">
              <Button variant="secondary" icon={Pencil} onClick={() => setEditando(true)}>
                Editar cadastro
              </Button>
            </div>
          </div>

          {bloqueado && (
            <div className="mb-5 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 p-3.5 text-[12.5px] text-red-700 dark:text-red-300">
              <b>Bloqueado.</b> {detalhe.blocklist.reason || 'Sem motivo registrado.'}
            </div>
          )}

          {/* Histórico */}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mb-2">
            Histórico de reservas
          </div>
          {reservas === null ? (
            <Loading label="Carregando…" />
          ) : reservas.length === 0 ? (
            <p className="text-sm text-suave-2 py-4">Nenhuma reserva ainda.</p>
          ) : (
            <div className="divide-y divide-borda">
              {reservas.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-conteudo truncate">
                      {r.vehicle_model} <span className="text-suave-2 font-mono text-xs">{r.vehicle_plate}</span>
                    </div>
                    <div className="text-xs text-suave">
                      {dt(r.pickup_at)} → {dt(r.return_at)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={r.status} />
                    <div className="text-xs font-semibold text-conteudo mt-1 tabular">{brl(r.total_amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LGPD */}
          <div className="mt-6 pt-4 border-t border-borda flex justify-end">
            <Button variant="danger-soft" icon={Trash2} onClick={excluirLgpd}>
              Excluir dados (LGPD)
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

/**
 * Cadastro do cliente (dados + endereço que vai no contrato).
 * O caminho curto é digitar o CEP: rua, bairro, cidade e UF vêm sozinhos, e
 * só sobra o número da casa para digitar.
 */
function FormularioCliente({ cliente, onSalvo, onCancelar }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: cliente.name || '',
    cpf: cliente.cpf || '',
    cnh_number: cliente.cnh_number || '',
    zip_code: cliente.zip_code || '',
    street: cliente.street || '',
    street_number: cliente.street_number || '',
    complement: cliente.complement || '',
    district: cliente.district || '',
    city: cliente.city || '',
    state: cliente.state || '',
  });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const set = (campo) => (e) => setF((v) => ({ ...v, [campo]: e.target.value }));

  /** Busca o endereço no CEP assim que os 8 dígitos estão completos. */
  async function digitarCep(e) {
    const d = e.target.value.replace(/\D/g, '').slice(0, 8);
    setF((v) => ({ ...v, zip_code: d }));
    if (d.length !== 8) return;

    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await res.json();
      if (j.erro) {
        toast.aviso('CEP não encontrado. Pode preencher à mão.');
        return;
      }
      setF((v) => ({
        ...v,
        street: j.logradouro || v.street,
        district: j.bairro || v.district,
        city: j.localidade || v.city,
        state: j.uf || v.state,
      }));
      toast.sucesso('Endereço preenchido pelo CEP.');
    } catch {
      toast.aviso('Não deu para buscar o CEP agora. Pode preencher à mão.');
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const atualizado = await api.patch(`/api/customers/${cliente.id}`, f);
      toast.sucesso('Cadastro salvo.');
      onSalvo(atualizado);
    } catch (err) {
      toast.erro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  const cepFmt =
    f.zip_code.length > 5 ? `${f.zip_code.slice(0, 5)}-${f.zip_code.slice(5)}` : f.zip_code;

  return (
    <form onSubmit={salvar}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome">
          <Input value={f.name} onChange={set('name')} placeholder="Maria Souza" />
        </Field>
        <Field label="CPF" hint="Só números">
          <Input
            value={f.cpf}
            onChange={(e) => setF((v) => ({ ...v, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
            inputMode="numeric"
            placeholder="00000000000"
          />
        </Field>
        <Field label="CNH" className="sm:col-span-2">
          <Input value={f.cnh_number} onChange={set('cnh_number')} placeholder="Número da habilitação" />
        </Field>
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mt-6 mb-2">
        Endereço (sai no contrato)
      </div>

      <div className="grid sm:grid-cols-6 gap-4">
        <Field
          label="CEP"
          className="sm:col-span-2"
          hint={buscandoCep ? 'Buscando…' : 'Preenche o resto sozinho'}
        >
          <Input
            value={cepFmt}
            onChange={digitarCep}
            inputMode="numeric"
            maxLength={9}
            placeholder="38400-000"
          />
        </Field>
        <Field label="Rua / Alameda" className="sm:col-span-4">
          <Input value={f.street} onChange={set('street')} placeholder="Rua das Flores" />
        </Field>

        <Field label="Número" className="sm:col-span-2">
          <Input
            value={f.street_number}
            onChange={set('street_number')}
            inputMode="numeric"
            placeholder="123"
          />
        </Field>
        <Field label="Complemento" className="sm:col-span-4" hint="Apto, bloco… (opcional)">
          <Input value={f.complement} onChange={set('complement')} placeholder="Apto 202" />
        </Field>

        <Field label="Bairro" className="sm:col-span-3">
          <Input value={f.district} onChange={set('district')} placeholder="Centro" />
        </Field>
        <Field label="Cidade" className="sm:col-span-2">
          <Input value={f.city} onChange={set('city')} placeholder="Uberlândia" />
        </Field>
        <Field label="UF" className="sm:col-span-1">
          <Input
            value={f.state}
            onChange={(e) => setF((v) => ({ ...v, state: e.target.value.toUpperCase().slice(0, 2) }))}
            maxLength={2}
            placeholder="MG"
          />
        </Field>
      </div>

      <div className="mt-6 pt-4 border-t border-borda flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" loading={salvando}>
          Salvar cadastro
        </Button>
      </div>
    </form>
  );
}

function Dado({ icon: Icon, rotulo, valor }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={14} className="text-suave-2 shrink-0" />
      <span className="text-xs text-suave">{rotulo}:</span>
      <span className="text-[13px] font-medium text-conteudo truncate">{valor}</span>
    </div>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setClientes(await api.get('/api/customers'));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Busca local (a lista já vem completa). Simples e instantâneo.
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter((c) =>
      `${c.name || ''} ${c.phone || ''} ${c.cpf || ''}`.toLowerCase().includes(t)
    );
  }, [clientes, busca]);

  return (
    <div>
      <PageHeader icon={Users} title="Clientes" subtitle="Todos os seus clientes e o histórico de cada um.">
        {clientes.length > 0 && <Badge tone="slate">{clientes.length}</Badge>}
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      <div className="relative flex-1 max-w-md mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suave-2" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou CPF…"
          className="pl-10"
        />
      </div>

      {carregando ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={busca ? Search : Users}
            title={busca ? 'Nenhum cliente encontrado' : 'Ainda sem clientes'}
            hint={
              busca
                ? 'Tente outra busca.'
                : 'Os clientes aparecem aqui automaticamente quando conversam pelo WhatsApp.'
            }
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {filtrados.map((c) => (
            <CartaoCliente key={c.id} c={c} onAbrir={setAberto} />
          ))}
        </div>
      )}

      <ModalCliente cliente={aberto} onClose={() => setAberto(null)} onMudou={carregar} />
    </div>
  );
}
