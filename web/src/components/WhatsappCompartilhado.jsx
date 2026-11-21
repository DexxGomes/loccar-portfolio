// ============================================================================
//  WHATSAPP COMPARTILHADO
//
//  Para a locadora que atende no MESMO número que usa com a família — o caso
//  mais comum de quem trabalha sozinho e tem o número na mão há anos.
//
//  Duas coisas nesta tela:
//    1. o interruptor que liga a triagem (só mensagem sobre aluguel aciona
//       a resposta automática);
//    2. a lista de números pessoais, que o sistema nunca atende nem guarda.
// ============================================================================
import { useEffect, useState } from 'react';
import { MessageSquare, Plus, Trash2, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../api.js';
import { telefone as fmtTelefone } from '../format.js';
import { useToast } from './Toast.jsx';
import { useConfirm } from './Modal.jsx';
import { Card, CardHeader, Button, Field, Input, EmptyState, Loading, cx } from './ui.jsx';

export default function WhatsappCompartilhado({ ligado, onMudar }) {
  const [contatos, setContatos] = useState(null);
  const [form, setForm] = useState({ label: '', phone: '' });
  const [salvando, setSalvando] = useState(false);

  const toast = useToast();
  const confirmar = useConfirm();

  async function carregar() {
    try {
      setContatos(await api.get('/api/particulares'));
    } catch {
      setContatos([]);
    }
  }

  useEffect(() => {
    if (ligado) carregar();
  }, [ligado]);

  async function adicionar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post('/api/particulares', {
        phone: form.phone,
        label: form.label.trim() || undefined,
      });
      toast.sucesso(`${form.label.trim() || 'Número'} não será mais atendido pelo sistema.`);
      setForm({ label: '', phone: '' });
      carregar();
    } catch (err) {
      toast.erro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(c) {
    const ok = await confirmar({
      titulo: 'Tirar da lista?',
      mensagem: `${c.label || fmtTelefone(c.phone)} volta a ser atendido pelo sistema como cliente.`,
      confirmar: 'Tirar',
      tom: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/api/particulares/${c.id}`);
      setContatos((atual) => atual.filter((x) => x.id !== c.id));
    } catch (e) {
      toast.erro(e.message);
    }
  }

  return (
    <Card className="mt-5 max-w-3xl">
      <CardHeader
        title="Meu WhatsApp é o mesmo da família"
        subtitle="Para quem atende cliente no número pessoal e não quer trocar de chip."
        icon={MessageSquare}
      />

      <div className="p-5">
        {/* Interruptor */}
        <button
          type="button"
          onClick={() => onMudar(!ligado)}
          className={cx(
            'w-full flex items-start gap-3.5 px-4 py-3.5 rounded-xl border text-left transition-all',
            ligado
              ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-300 dark:border-brand-500/40'
              : 'border-borda hover:border-borda-forte hover:bg-elevado'
          )}
        >
          <span
            className={cx(
              'mt-0.5 shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors',
              ligado ? 'bg-brand-600' : 'bg-borda-forte'
            )}
          >
            <span
              className={cx(
                'block w-5 h-5 rounded-full bg-superficie shadow-sm transition-transform',
                ligado && 'translate-x-5'
              )}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-medium text-conteudo">
              Sim, é o mesmo número
            </span>
            <span className="block text-[12.5px] text-suave mt-1 leading-relaxed">
              Ligando isto, o atendimento automático só entra quando a mensagem fala de
              aluguel, carro, data ou preço. Qualquer outra conversa fica esperando você,
              na tela Conversas — nada é respondido por engano.
            </span>
          </span>
        </button>

        {!ligado ? (
          <p className="mt-4 flex items-start gap-2 text-[12.5px] text-suave">
            <ShieldCheck size={15} className="shrink-0 mt-0.5 text-emerald-500" />
            Desligado: todo mundo que escrever para o número da locadora é atendido na
            hora. É o certo quando o WhatsApp é só da empresa.
          </p>
        ) : (
          <>
            {/* Lista de números pessoais */}
            <div className="mt-6 pt-5 border-t border-borda">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mb-1.5">
                Números pessoais
              </div>
              <p className="text-[12.5px] text-suave mb-4 leading-relaxed">
                Cadastre família e amigos. Mensagem vinda desses números é{' '}
                <b>descartada na entrada</b>: o sistema não responde, não guarda no
                histórico e não gasta nada. São poucos números e você só faz isso uma vez.
              </p>

              <form onSubmit={adicionar} className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-5">
                <Field label="Quem é" className="sm:col-span-5">
                  <Input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="Ex.: Mãe"
                  />
                </Field>
                <Field label="WhatsApp" required className="sm:col-span-5">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    inputMode="numeric"
                    placeholder="(34) 99999-9999"
                    required
                  />
                </Field>
                <div className="sm:col-span-2 flex items-end">
                  <Button type="submit" icon={Plus} loading={salvando} block>
                    Add
                  </Button>
                </div>
              </form>

              {contatos === null ? (
                <Loading label="Carregando…" />
              ) : contatos.length === 0 ? (
                <EmptyState
                  icon={UserRound}
                  title="Nenhum número pessoal cadastrado"
                  hint="Enquanto a lista estiver vazia, toda mensagem sobre aluguel é atendida — inclusive de quem for da família."
                />
              ) : (
                <div className="divide-y divide-borda">
                  {contatos.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-conteudo">
                          {c.label || 'Sem nome'}
                        </div>
                        <div className="text-xs text-suave">{fmtTelefone(c.phone)}</div>
                      </div>
                      <Button
                        variant="danger-soft"
                        size="sm"
                        icon={Trash2}
                        onClick={() => remover(c)}
                      >
                        Tirar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
