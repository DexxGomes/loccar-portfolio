// ============================================================================
//  BLOCKLIST
//  Clientes que a IA deve recusar automaticamente (por CPF e/ou telefone).
//  Quem é recusado na Análise entra aqui sozinho, com o motivo interno.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { Ban, ShieldCheck, Plus, Trash2, Search, ShieldAlert } from 'lucide-react';
import { api } from '../api.js';
import { dt, telefone, cpf as fmtCpf } from '../format.js';
import DataTable from '../components/DataTable.jsx';
import { Modal, useConfirm } from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import {
  PageHeader,
  Card,
  Button,
  EmptyState,
  Field,
  Input,
  LinkAction,
  ErrorBanner,
  Badge,
} from '../components/ui.jsx';

const VAZIO = { cpf: '', phone: '', reason: '' };

export default function Blocklist() {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setItens(await api.get('/api/blocklist'));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionar(e) {
    e.preventDefault();
    setErroForm('');
    if (!form.cpf.trim() && !form.phone.trim()) {
      setErroForm('Informe pelo menos o CPF ou o telefone.');
      return;
    }
    setSalvando(true);
    try {
      await api.post('/api/blocklist', {
        cpf: form.cpf.replace(/\D/g, '') || undefined,
        phone: form.phone.replace(/\D/g, '') || undefined,
        reason: form.reason.trim() || undefined,
      });
      toast.sucesso('Cliente bloqueado. A IA vai recusar novas reservas dele.');
      setForm(VAZIO);
      setAberto(false);
      carregar();
    } catch (err) {
      setErroForm(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item) {
    const ok = await confirmar({
      titulo: 'Desbloquear este cliente?',
      mensagem: 'Ele volta a conseguir fazer pré-reservas pelo WhatsApp normalmente.',
      confirmar: 'Desbloquear',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/blocklist/${item.id}`);
      toast.sucesso('Cliente desbloqueado.');
      carregar();
    } catch (e) {
      toast.erro(e.message);
    }
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return itens;
    return itens.filter((b) =>
      `${b.cpf || ''} ${b.phone || ''} ${b.reason || ''}`.toLowerCase().includes(t)
    );
  }, [itens, busca]);

  const colunas = [
    {
      key: 'cpf',
      header: 'CPF',
      render: (b) => (
        <span className="font-mono text-[13px] text-conteudo-2">
          {b.cpf ? fmtCpf(b.cpf) : '—'}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (b) => <span className="text-conteudo-2">{b.phone ? telefone(b.phone) : '—'}</span>,
    },
    {
      key: 'reason',
      header: 'Motivo interno',
      render: (b) => (
        <span className="text-conteudo-2 text-[13px]">{b.reason || 'Sem motivo registrado'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Bloqueado em',
      render: (b) => <span className="text-suave text-[13px]">{dt(b.created_at)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        icon={Ban}
        title="Blocklist"
        subtitle="Bloqueios por CPF ou telefone. O motivo é interno e nunca chega ao cliente."
      >
        <Button
          icon={Plus}
          // Limpa antes de abrir: sem isto, a janela reabre com o que foi
          // digitado na tentativa anterior e com o erro antigo em vermelho.
          onClick={() => {
            setForm(VAZIO);
            setErroForm('');
            setAberto(true);
          }}
        >
          Bloquear cliente
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suave-2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por CPF, telefone ou motivo…"
            className="pl-10"
          />
        </div>
        {itens.length > 0 && (
          <Badge tone="red">
            {itens.length} bloqueio{itens.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        <DataTable
          columns={colunas}
          rows={filtrados}
          loading={carregando}
          actions={(b) => (
            <LinkAction icon={Trash2} tone="red" onClick={() => remover(b)}>
              Desbloquear
            </LinkAction>
          )}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title={busca ? 'Nenhum bloqueio encontrado' : 'Blocklist vazia'}
              hint={
                busca
                  ? 'Tente outra busca.'
                  : 'Clientes recusados na análise entram aqui automaticamente, com o motivo registrado.'
              }
            />
          }
        />
      </Card>

      {/* Janela de bloqueio manual */}
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Bloquear cliente"
        subtitle="A IA passa a recusar reservas deste CPF/telefone."
        icon={ShieldAlert}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button variant="danger" type="submit" form="form-block" loading={salvando}>
              Bloquear
            </Button>
          </>
        }
      >
        <form id="form-block" onSubmit={adicionar} className="space-y-4">
          <Field label="CPF" hint="Somente números.">
            <Input
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              placeholder="12345678900"
              inputMode="numeric"
            />
          </Field>
          <Field label="Telefone" hint="Formato do WhatsApp, com DDI e DDD.">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="5534999999999"
              inputMode="numeric"
            />
          </Field>
          <Field label="Motivo (interno)" hint="Só você vê. Ajuda a lembrar o porquê depois.">
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex.: devolveu o carro com avaria e não pagou."
            />
          </Field>

          {erroForm && (
            <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-3.5 py-2.5">
              {erroForm}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
