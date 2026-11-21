// ============================================================================
//  CONFIGURAÇÕES DA LOCADORA
//  Dados legais (para o contrato), cláusulas do contrato e telefone de aviso.
// ============================================================================
import { useEffect, useState } from 'react';
import { Settings, Building2, FileSignature, Bell, Save, Lock } from 'lucide-react';
import { api } from '../api.js';
import { lerSessao } from '../sessao.js';
import { useToast } from '../components/Toast.jsx';
import WhatsappCompartilhado from '../components/WhatsappCompartilhado.jsx';
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Field,
  Input,
  Textarea,
  Loading,
  ErrorBanner,
} from '../components/ui.jsx';

const VAZIO = {
  name: '',
  legal_name: '',
  cnpj: '',
  address: '',
  contract_terms: '',
  owner_alert_phone: '',
  shared_number: false,
};

export default function Config() {
  const [form, setForm] = useState(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [senha, setSenha] = useState({ atual: '', nova: '', confirmar: '' });
  const [trocando, setTrocando] = useState(false);
  const toast = useToast();

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const t = await api.get('/api/tenant');
      setForm({
        name: t.name ?? '',
        legal_name: t.legal_name ?? '',
        cnpj: t.cnpj ?? '',
        address: t.address ?? '',
        contract_terms: t.contract_terms ?? '',
        owner_alert_phone: t.owner_alert_phone ?? '',
        shared_number: !!t.shared_number,
      });
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const t = await api.patch('/api/tenant', form);
      // Mantém o nome exibido no painel em sincronia (Layout lê do localStorage).
      const tenant = lerSessao('tenant');
      localStorage.setItem('tenant', JSON.stringify({ ...tenant, name: t.name }));
      toast.sucesso('Configurações salvas.');
    } catch (err) {
      toast.erro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha(e) {
    e.preventDefault();
    if (senha.nova !== senha.confirmar) {
      toast.erro('A confirmação não bate com a nova senha.');
      return;
    }
    setTrocando(true);
    try {
      await api.post('/api/auth/change-password', { senhaAtual: senha.atual, novaSenha: senha.nova });
      toast.sucesso('Senha alterada com sucesso.');
      setSenha({ atual: '', nova: '', confirmar: '' });
    } catch (err) {
      toast.erro(err.message);
    } finally {
      setTrocando(false);
    }
  }

  if (carregando) return <Loading label="Carregando configurações…" />;

  return (
    <div>
      <PageHeader
        icon={Settings}
        title="Configurações"
        subtitle="Dados da locadora, contrato e avisos."
      >
        <Button type="submit" form="form-config" icon={Save} loading={salvando}>
          Salvar
        </Button>
      </PageHeader>

      <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>

      <form id="form-config" onSubmit={salvar} className="space-y-5 max-w-3xl">
        {/* Dados da locadora */}
        <Card>
          <CardHeader title="Dados da locadora" subtitle="Usados no contrato e em documentos." icon={Building2} />
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <Field label="Nome (exibição)" required className="sm:col-span-2">
              <Input value={form.name} onChange={set('name')} placeholder="LocCar" required />
            </Field>
            <Field label="Razão social" hint="Nome jurídico, se houver.">
              <Input value={form.legal_name} onChange={set('legal_name')} placeholder="LocCar Locação de Veículos LTDA" />
            </Field>
            <Field label="CNPJ">
              <Input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" />
            </Field>
            <Field label="Endereço completo" className="sm:col-span-2">
              <Input value={form.address} onChange={set('address')} placeholder="Rua Exemplo, 123 — Bairro, Cidade/UF, CEP" />
            </Field>
          </div>
        </Card>

        {/* Contrato */}
        <Card>
          <CardHeader
            title="Cláusulas do contrato"
            subtitle="Se deixar em branco, o sistema usa um modelo padrão."
            icon={FileSignature}
          />
          <div className="p-5">
            <Field
              label="Cláusulas"
              hint="Modelo base. Recomendamos revisar com um advogado antes de usar de verdade."
            >
              <Textarea
                value={form.contract_terms}
                onChange={set('contract_terms')}
                rows={10}
                placeholder="Deixe em branco para usar o modelo padrão do LocCar, ou cole aqui as suas cláusulas."
                className="font-mono text-[12.5px]"
              />
            </Field>
          </div>
        </Card>

        {/* Avisos */}
        <Card>
          <CardHeader
            title="Aviso ao dono"
            subtitle="Receba um WhatsApp quando uma conversa precisar de você."
            icon={Bell}
          />
          <div className="p-5">
            <Field
              label="Seu WhatsApp (para avisos)"
              hint="Precisa do template aprovado + OWNER_ALERT_TEMPLATE configurado no servidor."
            >
              <Input
                value={form.owner_alert_phone}
                onChange={set('owner_alert_phone')}
                placeholder="(34) 99999-9999"
              />
            </Field>
          </div>
        </Card>
      </form>

      {/* WhatsApp compartilhado — form próprio, salva na hora */}
      <WhatsappCompartilhado
        ligado={form.shared_number}
        onMudar={async (valor) => {
          setForm((f) => ({ ...f, shared_number: valor }));
          try {
            await api.patch('/api/tenant', { shared_number: valor });
            toast.sucesso(
              valor
                ? 'Pronto. Agora só mensagem sobre aluguel aciona o atendimento automático.'
                : 'Voltou ao normal: todo mundo que escrever é atendido.'
            );
          } catch (err) {
            setForm((f) => ({ ...f, shared_number: !valor })); // desfaz na tela
            toast.erro(err.message);
          }
        }}
      />

      {/* Trocar senha — form próprio, separado das configurações */}
      <Card className="mt-5 max-w-3xl">
        <CardHeader title="Trocar senha" subtitle="Recomendado logo após o primeiro acesso." icon={Lock} />
        <form onSubmit={trocarSenha} className="p-5 grid sm:grid-cols-3 gap-4">
          <Field label="Senha atual" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={senha.atual}
              onChange={(e) => setSenha({ ...senha, atual: e.target.value })}
              required
            />
          </Field>
          <Field label="Nova senha" hint="Mínimo 6 caracteres" required>
            <Input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={senha.nova}
              onChange={(e) => setSenha({ ...senha, nova: e.target.value })}
              required
            />
          </Field>
          <Field label="Confirmar nova senha" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={senha.confirmar}
              onChange={(e) => setSenha({ ...senha, confirmar: e.target.value })}
              required
            />
          </Field>
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit" icon={Lock} loading={trocando}>
              Trocar senha
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
