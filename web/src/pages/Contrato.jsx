// ============================================================================
//  CONTRATO DE LOCAÇÃO (imprimível / Salvar PDF)
//  Monta o contrato de uma reserva com dados da locadora, do locatário, do
//  veículo, período, valores e as cláusulas (editáveis em Configurações).
//  O botão "Imprimir" usa a impressão do navegador — o menu some (print:hidden).
// ============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileSignature, Printer, ArrowLeft, BadgeCheck, CircleAlert } from 'lucide-react';
import { api } from '../api.js';
import { brl, cpf as fmtCpf, telefone } from '../format.js';
import { useToast } from '../components/Toast.jsx';
import { Button, Loading, ErrorBanner, cx } from '../components/ui.jsx';

/** Linha "rótulo: valor" das partes/veículo. */
function Campo({ rotulo, valor }) {
  return (
    <div className="flex gap-2 text-[13px] leading-relaxed">
      <span className="text-suave shrink-0">{rotulo}:</span>
      <span className="text-conteudo font-medium">{valor || '—'}</span>
    </div>
  );
}

export default function Contrato() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [c, setC] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aceitando, setAceitando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setC(await api.get(`/api/reservations/${id}/contrato`));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrarAceite() {
    setAceitando(true);
    try {
      const r = await api.post(`/api/reservations/${id}/contrato/aceite`);
      setC((atual) => ({ ...atual, aceito_em: r.aceito_em }));
      toast.sucesso('Aceite do contrato registrado.');
    } catch (e) {
      toast.erro(e.message);
    } finally {
      setAceitando(false);
    }
  }

  if (carregando) return <Loading label="Montando o contrato…" />;
  if (erro) return <ErrorBanner onRetry={carregar}>{erro}</ErrorBanner>;
  if (!c) return null;

  const semDadosLegais = !c.locadora.cnpj && !c.locadora.endereco;

  return (
    <div>
      {/* Barra de controle (não sai na impressão) */}
      <div data-no-print className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          onClick={() => nav(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-suave hover:text-conteudo transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {c.aceito_em ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
              <BadgeCheck size={16} /> Aceito pelo cliente
            </span>
          ) : (
            <Button variant="secondary" icon={BadgeCheck} onClick={registrarAceite} loading={aceitando}>
              Registrar aceite
            </Button>
          )}
          <Button icon={Printer} onClick={() => window.print()}>
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {semDadosLegais && (
        <div
          data-no-print
          className="mb-6 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 p-3.5"
        >
          <CircleAlert size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-amber-800 dark:text-amber-300 leading-relaxed">
            Faltam os dados legais da locadora (CNPJ, endereço, razão social). Preencha em{' '}
            <b>Configurações</b> para o contrato ficar completo.
          </p>
        </div>
      )}

      {/* -------- Folha do contrato -------- */}
      <div className="max-w-3xl mx-auto">
        <div className="text-center pb-5 mb-6 border-b border-borda">
          <div className="text-lg font-extrabold tracking-tight text-conteudo">{c.locadora.nome}</div>
          {c.locadora.cnpj && <div className="text-xs text-suave mt-0.5">CNPJ: {c.locadora.cnpj}</div>}
          {c.locadora.endereco && <div className="text-xs text-suave">{c.locadora.endereco}</div>}
          <h1 className="text-base font-bold text-conteudo uppercase tracking-wide mt-4">
            Contrato de Locação de Veículo
          </h1>
        </div>

        {/* Partes */}
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mb-1.5">
              Locadora
            </div>
            <Campo rotulo="Nome" valor={c.locadora.nome} />
            {c.locadora.cnpj && <Campo rotulo="CNPJ" valor={c.locadora.cnpj} />}
            {c.locadora.telefone && <Campo rotulo="Telefone" valor={c.locadora.telefone} />}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mb-1.5">
              Locatário
            </div>
            <Campo rotulo="Nome" valor={c.locatario.nome} />
            <Campo rotulo="CPF" valor={c.locatario.cpf ? fmtCpf(c.locatario.cpf) : null} />
            <Campo rotulo="CNH" valor={c.locatario.cnh} />
            <Campo rotulo="Telefone" valor={telefone(c.locatario.telefone)} />
            {/* Endereço de residência do locatário (qualificação das partes). */}
            <Campo rotulo="Endereço" valor={c.locatario.endereco} />
          </div>
        </div>

        {/* Sem endereço o contrato não qualifica o locatário — avisa o dono na
            tela, mas não aparece na impressão. */}
        {!c.locatario.endereco && (
          <div className="print:hidden mb-5 flex items-start gap-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-3 text-[13px] text-amber-900 dark:text-amber-200">
            <span aria-hidden="true">⚠️</span>
            <span>
              Este cliente ainda está sem endereço. Cadastre em{' '}
              <b>Clientes → abrir o cliente → Editar cadastro</b> para o contrato sair completo.
            </span>
          </div>
        )}

        {/* Veículo + período + valores */}
        <div className="rounded-xl border border-borda p-4 mb-5 grid sm:grid-cols-2 gap-y-2 gap-x-5">
          <Campo rotulo="Veículo" valor={`${c.veiculo.modelo} (${c.veiculo.categoria})`} />
          <Campo rotulo="Placa" valor={c.veiculo.placa} />
          <Campo rotulo="Retirada" valor={c.periodo.retirada} />
          <Campo rotulo="Devolução" valor={c.periodo.devolucao} />
          <Campo rotulo="Diárias" valor={`${c.periodo.diarias} × ${brl(c.valores.diaria)}`} />
          <Campo rotulo="Total" valor={brl(c.valores.total)} />
          {c.tem_caucao ? (
            <Campo rotulo="Caução" valor={brl(c.valores.caucao)} />
          ) : (
            <Campo rotulo="Caução" valor="Não se aplica" />
          )}
        </div>

        {/* Cláusulas */}
        <div className="text-[11px] font-semibold uppercase tracking-wider text-suave-2 mb-2">
          Cláusulas
        </div>
        <div className="text-[12.5px] text-conteudo-2 leading-relaxed whitespace-pre-line mb-8">
          {c.termos}
        </div>

        {/* Assinaturas */}
        <div className="grid sm:grid-cols-2 gap-8 pt-10">
          {['Locadora', 'Locatário'].map((papel) => (
            <div key={papel} className="text-center">
              <div className="border-t border-conteudo/60 pt-1.5 text-[12px] text-suave">{papel}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] text-suave-2 mt-8">
          {c.aceito_em
            ? `Aceito eletronicamente pelo cliente.`
            : `Documento gerado pelo LocCar.`}
        </p>
      </div>
    </div>
  );
}
