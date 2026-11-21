// ============================================================================
//  VISTORIA DIGITAL — janela de check-in (retirada) e check-out (devolução)
//
//  O que ela resolve: a discussão "esse risco já estava aí". Registra km,
//  combustível, avarias marcadas no desenho e fotos do carro, dos dois lados
//  da locação, e mostra o comparativo na devolução.
//
//  As fotos são reduzidas no navegador e sobem uma a uma, com progresso —
//  no pátio, com 4G ruim, isso é a diferença entre funcionar e travar.
// ============================================================================
import { useEffect, useState } from 'react';
import {
  Camera,
  Trash2,
  ClipboardCheck,
  Fuel,
  Gauge,
  AlertTriangle,
  ImagePlus,
  ArrowRight,
  Check,
} from 'lucide-react';
import { api } from '../api.js';
import { dt } from '../format.js';
import { reduzirImagem } from '../utils/imagem.js';
import { Modal } from './Modal.jsx';
import { useToast } from './Toast.jsx';
import DiagramaCarro, { COR_GRAVIDADE, ROTULO_GRAVIDADE } from './DiagramaCarro.jsx';
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  Badge,
  Progress,
  Spinner,
  cx,
} from './ui.jsx';

// Fotos pedidas por padrão. "extra" aceita quantas o usuário quiser.
const POSICOES = [
  { id: 'frente', label: 'Frente' },
  { id: 'traseira', label: 'Traseira' },
  { id: 'lateral_esquerda', label: 'Lateral esq.' },
  { id: 'lateral_direita', label: 'Lateral dir.' },
  { id: 'painel', label: 'Painel (km)' },
];

// Marcas do ponteiro de combustível.
const COMBUSTIVEL = [
  { valor: 0, label: 'E' },
  { valor: 1, label: '' },
  { valor: 2, label: '¼' },
  { valor: 3, label: '' },
  { valor: 4, label: '½' },
  { valor: 5, label: '' },
  { valor: 6, label: '¾' },
  { valor: 7, label: '' },
  { valor: 8, label: 'F' },
];

const rotuloCombustivel = (oitavos) =>
  oitavos == null ? '—' : `${oitavos}/8 do tanque`;

export default function VistoriaModal({ open, onClose, reserva, tipo, modo = 'nova', onConcluir }) {
  const ehDevolucao = tipo === 'devolucao';
  const toast = useToast();

  const [carregando, setCarregando] = useState(true);
  const [anteriores, setAnteriores] = useState(null);

  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState(8);
  const [damages, setDamages] = useState([]);
  const [notes, setNotes] = useState('');
  const [signedBy, setSignedBy] = useState('');
  const [fotos, setFotos] = useState({}); // { posicao: dataUrl } + extras: []
  const [extras, setExtras] = useState([]);

  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');

  // ------------------------------------------------------------- carga
  useEffect(() => {
    if (!open || !reserva) return;
    let ativo = true;

    (async () => {
      setCarregando(true);
      setErro('');
      try {
        const dados = await api.get(`/api/inspections?reservationId=${reserva.id}`);
        if (!ativo) return;
        setAnteriores(dados);

        if (modo === 'nova') {
          // Na devolução, a vistoria de retirada já dá o ponto de partida:
          // repetimos as avarias registradas (o carro saiu com elas).
          if (ehDevolucao && dados.retirada) {
            setDamages(dados.retirada.damages || []);
            setOdometer(dados.retirada.odometer ? String(dados.retirada.odometer) : '');
            setFuelLevel(dados.retirada.fuel_level ?? 8);
          } else if (reserva.vehicle_id) {
            // Na retirada, sugerimos o último km conhecido daquele veículo.
            const ultimo = await api
              .get(`/api/inspections/ultimo-odometro/${reserva.vehicle_id}`)
              .catch(() => null);
            if (ativo && ultimo?.odometer) setOdometer(String(ultimo.odometer));
          }
          setSignedBy(reserva.customer_name || '');
        }
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [open, reserva, modo, ehDevolucao]);

  // Limpa ao fechar, para a próxima vistoria não herdar nada.
  useEffect(() => {
    if (!open) {
      setFotos({});
      setExtras([]);
      setNotes('');
      setProgresso(null);
      setErro('');
    }
  }, [open]);

  // ------------------------------------------------------------- fotos
  async function escolherFoto(e, posicao) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    try {
      const dataUrl = await reduzirImagem(arquivo);
      if (posicao === 'extra') setExtras((atuais) => [...atuais, dataUrl]);
      else setFotos((atuais) => ({ ...atuais, [posicao]: dataUrl }));
    } catch (err) {
      toast.erro(`Não consegui ler essa foto: ${err.message}`);
    }
  }

  // ------------------------------------------------------------- avarias
  function adicionarAvaria(ponto) {
    setDamages((atuais) => [...atuais, { ...ponto, gravidade: 'leve', descricao: '' }]);
  }

  function alterarAvaria(i, campo, valor) {
    setDamages((atuais) => atuais.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));
  }

  const removerAvaria = (i) => setDamages((atuais) => atuais.filter((_, idx) => idx !== i));

  // ------------------------------------------------------------- envio
  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const vistoria = await api.post('/api/inspections', {
        reservationId: reserva.id,
        type: tipo,
        odometer: odometer === '' ? undefined : Number(odometer),
        fuelLevel,
        damages: damages.map((a) => ({
          x: a.x,
          y: a.y,
          parte: a.parte || undefined,
          gravidade: a.gravidade || 'leve',
          descricao: a.descricao?.trim() || undefined,
        })),
        notes: notes.trim() || undefined,
        signedBy: signedBy.trim() || undefined,
      });

      // Fotos, uma a uma, com progresso visível.
      const lista = [
        ...Object.entries(fotos).map(([position, dataUrl]) => ({ position, dataUrl })),
        ...extras.map((dataUrl) => ({ position: 'extra', dataUrl })),
      ];

      const falhas = [];
      for (let i = 0; i < lista.length; i++) {
        setProgresso({ atual: i + 1, total: lista.length });
        try {
          await api.post(`/api/inspections/${vistoria.id}/photos`, lista[i]);
        } catch (err) {
          falhas.push(lista[i].position);
          console.warn('Falha ao enviar foto', lista[i].position, err);
        }
      }

      if (falhas.length) {
        toast.aviso(
          `A vistoria foi salva, mas ${falhas.length} foto(s) não subiram. Você pode anexá-las depois.`
        );
      }

      // O pai decide o que fazer em seguida (registrar retirada/devolução).
      await onConcluir?.(vistoria);
      onClose();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
      setProgresso(null);
    }
  }

  // ------------------------------------------------------------- derivados
  const retirada = anteriores?.retirada;
  const kmRodado =
    ehDevolucao && retirada?.odometer != null && odometer !== ''
      ? Number(odometer) - retirada.odometer
      : null;
  const difCombustivel =
    ehDevolucao && retirada?.fuel_level != null ? fuelLevel - retirada.fuel_level : null;

  const titulo =
    modo === 'ver'
      ? 'Vistorias da locação'
      : ehDevolucao
      ? 'Vistoria de devolução'
      : 'Vistoria de retirada';

  return (
    <Modal
      open={open}
      onClose={enviando ? undefined : onClose}
      title={titulo}
      subtitle={reserva ? `${reserva.vehicle_model} · ${reserva.vehicle_plate}` : ''}
      icon={ClipboardCheck}
      size="xl"
      footer={
        modo === 'ver' ? (
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="secondary" type="button" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" form="form-vistoria" loading={enviando} icon={Check}>
              {progresso
                ? `Enviando foto ${progresso.atual}/${progresso.total}…`
                : ehDevolucao
                ? 'Concluir devolução'
                : 'Confirmar retirada'}
            </Button>
          </>
        )
      }
    >
      {carregando ? (
        <div className="flex items-center justify-center gap-3 py-12 text-suave text-sm">
          <Spinner /> Carregando vistoria…
        </div>
      ) : modo === 'ver' ? (
        <VerVistorias dados={anteriores} />
      ) : (
        <form id="form-vistoria" onSubmit={salvar} className="space-y-6">
          {/* Comparativo com a retirada */}
          {ehDevolucao && retirada && (
            <Card className="p-4 bg-elevado/70">
              <div className="text-[12px] font-semibold text-conteudo-2 mb-2.5">
                Na retirada ({dt(retirada.created_at)})
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[11px] text-suave">Odômetro</div>
                  <div className="text-[15px] font-semibold text-conteudo tabular">
                    {retirada.odometer?.toLocaleString('pt-BR') || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-suave">Combustível</div>
                  <div className="text-[15px] font-semibold text-conteudo">
                    {rotuloCombustivel(retirada.fuel_level)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-suave">Avarias</div>
                  <div className="text-[15px] font-semibold text-conteudo">
                    {(retirada.damages || []).length}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Odômetro e combustível */}
          <div className="grid sm:grid-cols-2 gap-5">
            <Field
              label="Quilometragem no painel"
              hint={
                kmRodado != null
                  ? kmRodado >= 0
                    ? `${kmRodado.toLocaleString('pt-BR')} km rodados nesta locação`
                    : 'Menor que a da retirada — confira o número.'
                  : 'Aparece no comparativo da devolução.'
              }
            >
              <div className="relative">
                <Gauge size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suave-2" />
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={odometer}
                  onChange={(ev) => setOdometer(ev.target.value)}
                  placeholder="Ex.: 48250"
                  className="pl-10"
                />
              </div>
            </Field>

            <Field
              label="Combustível"
              hint={
                difCombustivel != null && difCombustivel < 0
                  ? `Voltou com ${Math.abs(difCombustivel)}/8 a menos que na saída.`
                  : rotuloCombustivel(fuelLevel)
              }
            >
              <div className="flex items-center gap-2">
                <Fuel size={16} className="text-suave-2 shrink-0" />
                <div className="flex-1 flex gap-0.5">
                  {COMBUSTIVEL.map((c) => (
                    <button
                      key={c.valor}
                      type="button"
                      onClick={() => setFuelLevel(c.valor)}
                      aria-label={`${c.valor} de 8`}
                      className={cx(
                        'flex-1 h-9 rounded-md text-[10px] font-semibold transition-colors',
                        c.valor <= fuelLevel
                          ? 'bg-brand-600 text-white'
                          : 'bg-sutil text-suave-2 hover:bg-borda'
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>

          {/* Fotos */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-semibold text-conteudo-2">Fotos do veículo</span>
              <span className="text-[11.5px] text-suave-2">
                {Object.keys(fotos).length + extras.length} enviada(s)
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {POSICOES.map((p) => (
                <CaixaFoto
                  key={p.id}
                  label={p.label}
                  dataUrl={fotos[p.id]}
                  onEscolher={(e) => escolherFoto(e, p.id)}
                  onRemover={() =>
                    setFotos((atuais) => {
                      const novo = { ...atuais };
                      delete novo[p.id];
                      return novo;
                    })
                  }
                />
              ))}
              {extras.map((dataUrl, i) => (
                <CaixaFoto
                  key={`extra-${i}`}
                  label={`Extra ${i + 1}`}
                  dataUrl={dataUrl}
                  onRemover={() => setExtras((atuais) => atuais.filter((_, idx) => idx !== i))}
                />
              ))}
              <label
                className="aspect-[4/3] rounded-xl border-2 border-dashed border-borda grid place-items-center
                           cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-500/10 transition-colors"
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => escolherFoto(e, 'extra')}
                />
                <span className="flex flex-col items-center gap-1 text-suave-2">
                  <ImagePlus size={18} />
                  <span className="text-[10.5px]">Outra</span>
                </span>
              </label>
            </div>
          </div>

          {/* Avarias */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-semibold text-conteudo-2">
                Avarias {ehDevolucao && '(as da retirada já vêm marcadas)'}
              </span>
              {damages.length > 0 && <Badge tone="amber">{damages.length} marcada(s)</Badge>}
            </div>

            <div className="grid sm:grid-cols-[220px_1fr] gap-5">
              <div>
                <DiagramaCarro
                  avarias={damages}
                  onAdicionar={adicionarAvaria}
                  onRemover={removerAvaria}
                />
                <p className="text-[11px] text-suave-2 text-center mt-2">
                  Toque no desenho para marcar. Toque na marca para apagar.
                </p>
              </div>

              <div className="space-y-2.5">
                {damages.length === 0 ? (
                  <div className="h-full min-h-[120px] grid place-items-center text-center text-[12.5px] text-suave-2 border border-dashed border-borda rounded-xl p-4">
                    Nenhuma avaria marcada.
                    <br />
                    Um carro sem arranhão nenhum é ótimo — mas registre se houver.
                  </div>
                ) : (
                  damages.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-elevado">
                      <span
                        className="mt-0.5 w-5 h-5 rounded-full text-white text-[10px] font-bold grid place-items-center shrink-0"
                        style={{ backgroundColor: COR_GRAVIDADE[a.gravidade] }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="text-[12px] font-medium text-conteudo-2">{a.parte}</div>
                        <div className="flex gap-2">
                          <Select
                            value={a.gravidade}
                            onChange={(e) => alterarAvaria(i, 'gravidade', e.target.value)}
                            className="py-1.5 text-[12px] w-28"
                          >
                            <option value="leve">Leve</option>
                            <option value="media">Média</option>
                            <option value="grave">Grave</option>
                          </Select>
                          <Input
                            value={a.descricao || ''}
                            onChange={(e) => alterarAvaria(i, 'descricao', e.target.value)}
                            placeholder="Ex.: risco de 10 cm"
                            className="py-1.5 text-[12px]"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerAvaria(i)}
                        aria-label="Remover avaria"
                        className="p-1.5 rounded-lg text-suave-2 hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Observações e conferência */}
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Observações" hint="Fica no histórico da locação.">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: pneu dianteiro direito com desgaste; estepe conferido."
                rows={3}
              />
            </Field>
            <Field
              label="Conferido com"
              hint="Quem acompanhou a vistoria (normalmente o cliente)."
            >
              <Input
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="Nome de quem estava presente"
              />
            </Field>
          </div>

          {progresso && (
            <div>
              <Progress value={(progresso.atual / progresso.total) * 100} />
              <p className="text-[11.5px] text-suave mt-1.5">
                Enviando fotos… {progresso.atual} de {progresso.total}
              </p>
            </div>
          )}

          {erro && (
            <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-3.5 py-2.5">
              {erro}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

/** Quadradinho de foto: vazio vira botão de câmera; cheio mostra a miniatura. */
function CaixaFoto({ label, dataUrl, onEscolher, onRemover }) {
  if (dataUrl) {
    return (
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-borda group">
        <img src={dataUrl} alt={label} className="w-full h-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-ink-950/60 text-white text-[10px] px-1.5 py-1 truncate">
          {label}
        </div>
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover foto ${label}`}
          className="absolute top-1 right-1 p-1 rounded-lg bg-ink-950/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  return (
    <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-borda grid place-items-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-500/10 transition-colors">
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onEscolher} />
      <span className="flex flex-col items-center gap-1 text-suave-2">
        <Camera size={18} />
        <span className="text-[10.5px] text-center px-1">{label}</span>
      </span>
    </label>
  );
}

/** Modo leitura: as duas vistorias lado a lado e o que mudou entre elas. */
function VerVistorias({ dados }) {
  if (!dados?.retirada && !dados?.devolucao) {
    return (
      <p className="text-center text-sm text-suave-2 py-10">
        Nenhuma vistoria registrada nesta locação.
      </p>
    );
  }

  const { retirada, devolucao, comparativo } = dados;

  return (
    <div className="space-y-6">
      {comparativo && (
        <Card className="p-4">
          <div className="text-[12px] font-semibold text-conteudo-2 mb-3">O que mudou</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[11px] text-suave">Rodou</div>
              <div className="text-lg font-bold text-conteudo tabular">
                {comparativo.kmRodado != null
                  ? `${comparativo.kmRodado.toLocaleString('pt-BR')} km`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-suave">Combustível</div>
              <div
                className={cx(
                  'text-lg font-bold tabular',
                  comparativo.combustivelOitavos < 0 ? 'text-red-600 dark:text-red-400' : 'text-conteudo'
                )}
              >
                {comparativo.combustivelOitavos == null
                  ? '—'
                  : `${comparativo.combustivelOitavos > 0 ? '+' : ''}${
                      comparativo.combustivelOitavos
                    }/8`}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-suave">Avarias novas</div>
              <div
                className={cx(
                  'text-lg font-bold tabular',
                  comparativo.avariasNovas > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {comparativo.avariasNovas}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <BlocoVistoria titulo="Retirada" vistoria={retirada} />
        <BlocoVistoria titulo="Devolução" vistoria={devolucao} />
      </div>
    </div>
  );
}

/** Um lado do comparativo. */
function BlocoVistoria({ titulo, vistoria }) {
  if (!vistoria) {
    return (
      <div className="border border-dashed border-borda rounded-xl p-6 text-center">
        <div className="text-[13px] font-semibold text-conteudo-2 mb-1">{titulo}</div>
        <p className="text-[12.5px] text-suave-2">Ainda não registrada.</p>
      </div>
    );
  }

  return (
    <div className="border border-borda rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-elevado border-b border-borda flex items-center justify-between">
        <span className="text-[13px] font-semibold text-conteudo-2">{titulo}</span>
        <span className="text-[11px] text-suave-2">{dt(vistoria.created_at)}</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-4 text-[12.5px]">
          <span className="flex items-center gap-1.5 text-conteudo-2">
            <Gauge size={13} className="text-suave-2" />
            {vistoria.odometer?.toLocaleString('pt-BR') || '—'} km
          </span>
          <span className="flex items-center gap-1.5 text-conteudo-2">
            <Fuel size={13} className="text-suave-2" />
            {rotuloCombustivel(vistoria.fuel_level)}
          </span>
        </div>

        <DiagramaCarro avarias={vistoria.damages || []} somenteLeitura />

        {(vistoria.damages || []).length > 0 && (
          <ul className="space-y-1">
            {vistoria.damages.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px] text-conteudo-2">
                <span
                  className="w-4 h-4 rounded-full text-white text-[9px] font-bold grid place-items-center shrink-0"
                  style={{ backgroundColor: COR_GRAVIDADE[a.gravidade] }}
                >
                  {i + 1}
                </span>
                {a.parte}
                <span className="text-suave-2">
                  · {ROTULO_GRAVIDADE[a.gravidade]}
                  {a.descricao ? ` · ${a.descricao}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        {vistoria.fotos?.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {vistoria.fotos.map((f) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-[4/3] rounded-lg overflow-hidden border border-borda hover:border-brand-400 transition-colors"
              >
                <img src={f.url} alt={f.position} className="w-full h-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        {vistoria.notes && (
          <p className="text-[12px] text-suave bg-elevado rounded-lg p-2.5">{vistoria.notes}</p>
        )}

        {vistoria.signed_by && (
          <p className="text-[11.5px] text-suave-2">Conferido com {vistoria.signed_by}</p>
        )}
      </div>
    </div>
  );
}
