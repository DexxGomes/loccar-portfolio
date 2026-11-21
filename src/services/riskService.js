// ============================================================================
//  Análise de risco de uma pré-reserva.
//
//  Reúne SINAIS OBJETIVOS (nunca aparência do cliente) para ajudar o dono a
//  decidir: blocklist, situação da CNH, documentos, consentimento e histórico
//  do cliente na locadora. Cada sinal tem um nível; o nível geral é o pior deles.
//
//  Importante: isto NÃO decide nada — só organiza fatos. A aprovação é sempre
//  do dono. E a recusa deve se apoiar em critério objetivo (defensável na lei),
//  não em "cara" do cliente.
// ============================================================================
import { HttpError } from '../utils/httpError.js';
import * as reservationRepo from '../repositories/reservationRepository.js';
import * as documentRepo from '../repositories/documentRepository.js';
import { isBlocked } from '../repositories/blocklistRepository.js';

const DOCS_ESPERADOS = ['cnh_frente', 'cnh_verso', 'comprovante_residencia', 'selfie_cnh'];
const ROTULO_DOC = {
  cnh_frente: 'CNH (frente)',
  cnh_verso: 'CNH (verso)',
  comprovante_residencia: 'comprovante de residência',
  selfie_cnh: 'selfie com a CNH',
};

const fmtData = (d) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Peso de cada nível para calcular o pior (nível geral). */
const PESO = { alto: 3, medio: 2, baixo: 1, ok: 0, positivo: 0, info: 0 };

/**
 * Avalia o risco objetivo de uma pré-reserva.
 * @returns {{nivel, resumo, exposicao, historico, sinais}}
 */
export async function assessReservation(tenant, reservationId) {
  const r = await reservationRepo.getReservationDetailed(tenant.id, reservationId);
  if (!r) throw new HttpError(404, 'Reserva não encontrada.');

  const [docs, bloqueio, historicoBruto] = await Promise.all([
    documentRepo.listByReservation(tenant.id, reservationId),
    isBlocked(tenant.id, { phone: r.customer_phone, cpf: r.customer_cpf }),
    reservationRepo.listByCustomer(tenant.id, r.customer_id, 50),
  ]);

  const sinais = [];
  const add = (nivel, titulo, detalhe) => sinais.push({ nivel, titulo, detalhe });

  // ---- Blocklist ----
  if (bloqueio) {
    add('alto', 'Cliente na blocklist', bloqueio.reason ? `Motivo registrado: ${bloqueio.reason}` : 'CPF/telefone bloqueado nesta locadora.');
  }

  // ---- CNH ----
  const agora = new Date();
  if (r.customer_cnh_valid_until) {
    const val = new Date(r.customer_cnh_valid_until);
    if (val < agora) add('alto', 'CNH vencida', `Venceu em ${fmtData(val)}.`);
    else if (val < new Date(r.return_at)) add('medio', 'CNH vence durante a locação', `Validade ${fmtData(val)} — antes da devolução.`);
  } else {
    add('medio', 'CNH não informada', 'Cliente ainda não passou número/validade da CNH.');
  }

  // ---- CPF ----
  if (!r.customer_cpf) add('medio', 'CPF não informado', 'Sem CPF não dá para checar identidade nem restrições.');

  // ---- Documentos ----
  const tipos = new Set(docs.map((d) => d.type));
  const faltando = DOCS_ESPERADOS.filter((t) => !tipos.has(t));
  if (faltando.length) {
    add(
      faltando.length >= 3 ? 'alto' : 'medio',
      'Documentação incompleta',
      `Faltam: ${faltando.map((t) => ROTULO_DOC[t]).join(', ')}.`
    );
  }

  // ---- LGPD ----
  if (!r.customer_lgpd_consent_at) {
    add('medio', 'Sem consentimento LGPD', 'O cliente não registrou o aceite do uso dos documentos.');
  }

  // ---- Histórico do cliente (exclui a própria reserva) ----
  const hist = historicoBruto.filter((h) => h.id !== reservationId);
  const historico = { finalizada: 0, cancelada: 0, recusada: 0, atrasos: 0, total: hist.length };
  for (const h of hist) {
    if (h.status === 'finalizada') historico.finalizada += 1;
    if (h.status === 'cancelada') historico.cancelada += 1;
    if (h.status === 'recusada') historico.recusada += 1;
    if (h.late_return_flag) historico.atrasos += 1;
  }
  if (historico.recusada > 0) add('alto', 'Já foi recusado antes', `${historico.recusada} reserva(s) recusada(s) no histórico.`);
  if (historico.atrasos > 0) add('medio', 'Já devolveu com atraso', `${historico.atrasos} devolução(ões) atrasada(s) no histórico.`);
  if (historico.cancelada >= 2) add('baixo', 'Cancela com frequência', `${historico.cancelada} reserva(s) cancelada(s) no histórico.`);
  if (historico.finalizada > 0 && historico.recusada === 0) {
    add('positivo', 'Cliente recorrente', `${historico.finalizada} locação(ões) já finalizada(s), sem recusa.`);
  }
  if (historico.total === 0) add('info', 'Cliente novo', 'Primeira reserva deste cliente — ainda sem histórico.');

  // ---- Verificação externa (preparado para o futuro) ----
  add('info', 'Sem consulta externa de CPF/CNH', 'A verificação automática (ex.: Serpro/restrições) ainda não está ativada.');

  // ---- Nível geral = o pior sinal ----
  const pior = sinais.reduce((max, s) => Math.max(max, PESO[s.nivel] ?? 0), 0);
  const nivel = pior >= 3 ? 'alto' : pior === 2 ? 'medio' : pior === 1 ? 'baixo' : 'ok';

  const nAlto = sinais.filter((s) => s.nivel === 'alto').length;
  const nMedio = sinais.filter((s) => s.nivel === 'medio').length;
  const resumo =
    nivel === 'alto'
      ? `Risco alto — ${nAlto} ponto(s) crítico(s) para conferir antes de aprovar.`
      : nivel === 'medio'
      ? `Atenção — ${nMedio} ponto(s) a conferir.`
      : nivel === 'baixo'
      ? 'Baixo risco — pequenos pontos de atenção.'
      : 'Sem sinais objetivos de risco.';

  return {
    nivel,
    resumo,
    exposicao: Number(r.total_amount) + Number(r.deposit_snapshot),
    historico,
    sinais,
  };
}
