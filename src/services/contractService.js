// ============================================================================
//  Contrato de locação.
//  Monta os dados do contrato de uma reserva (locadora + locatário + veículo +
//  período + valores + cláusulas) para o painel gerar um documento imprimível.
//
//  As cláusulas vêm de tenants.contract_terms; se estiver vazio, usa um MODELO
//  PADRÃO abaixo. O modelo é um ponto de partida — recomende ao cliente revisar
//  com um advogado antes de usar de verdade.
// ============================================================================
import { HttpError } from '../utils/httpError.js';
import { query } from '../config/db.js';
import * as reservationRepo from '../repositories/reservationRepository.js';

// Modelo padrão de cláusulas (editável por locadora em Configurações).
// A cláusula de caução só entra quando a reserva tem caução — assim o mesmo
// contrato serve para "com caução" e "sem caução", sem o dono escolher tipo.
function clausulasPadrao(temCaucao) {
  const clausulas = [
    'OBJETO. A LOCADORA cede em locação ao LOCATÁRIO o veículo identificado neste instrumento, pelo período e valores aqui descritos, para uso lícito e pessoal.',
    'PRAZO E DEVOLUÇÃO. O veículo deve ser devolvido na data e hora previstas, nas mesmas condições em que foi retirado (salvo desgaste natural), com o mesmo nível de combustível. A devolução em atraso sujeita o LOCATÁRIO à cobrança de diária adicional.',
    ...(temCaucao
      ? ['CAUÇÃO. O valor da caução serve como garantia e será devolvido após a vistoria de devolução, descontados eventuais danos, multas, taxas ou débitos.']
      : []),
    'CONDUÇÃO E RESPONSABILIDADES. O LOCATÁRIO declara possuir CNH válida e é o único responsável pela condução do veículo, respondendo por infrações de trânsito, multas, danos a terceiros e ao próprio veículo durante a locação.',
    'MULTAS E INFRAÇÕES. Multas e infrações registradas no período da locação são de responsabilidade do LOCATÁRIO e serão a ele repassadas.',
    'PROIBIÇÕES. É vedado sublocar o veículo, utilizá-lo para fins ilícitos, transporte remunerado não autorizado, competições, ou conduzi-lo sob efeito de álcool ou substâncias proibidas.',
    'SINISTRO. Em caso de acidente, furto ou roubo, o LOCATÁRIO deve comunicar imediatamente a LOCADORA e as autoridades, lavrando o boletim de ocorrência.',
    'RESCISÃO. O descumprimento de qualquer cláusula autoriza a LOCADORA a rescindir o contrato e retomar o veículo.',
    'FORO. Fica eleito o foro da comarca da LOCADORA para dirimir eventuais controvérsias.',
  ];
  return clausulas.map((c, i) => `${i + 1}. ${c}`).join('\n\n');
}

/** CEP em 00000-000 (guardamos só os dígitos). */
function cep(digitos) {
  const d = String(digitos || '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : null;
}

/**
 * Monta o endereço do locatário em uma linha, no formato usual de contrato:
 *   Rua das Flores, 123, Apto 2 — Centro — Uberlândia/MG — CEP 38400-000
 * Partes que faltam simplesmente não aparecem (nada de vírgula solta).
 */
function enderecoEmLinha(r) {
  const logradouro = [r.customer_street, r.customer_street_number, r.customer_complement]
    .filter(Boolean)
    .join(', ');

  const cidadeUf = [r.customer_city, r.customer_state].filter(Boolean).join('/');
  const cepFmt = cep(r.customer_zip_code);

  const partes = [
    logradouro,
    r.customer_district,
    cidadeUf,
    cepFmt ? `CEP ${cepFmt}` : null,
  ].filter(Boolean);

  return partes.length ? partes.join(' — ') : null;
}

/** Formata data/hora no fuso da locadora. */
function fmt(iso, tz) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Monta os dados do contrato de uma reserva. */
export async function getContract(tenant, reservationId) {
  const r = await reservationRepo.getReservationDetailed(tenant.id, reservationId);
  if (!r) throw new HttpError(404, 'Reserva não encontrada.');

  const tz = tenant.timezone || 'America/Sao_Paulo';
  const temCaucao = Number(r.deposit_snapshot) > 0;

  return {
    tem_caucao: temCaucao,
    locadora: {
      nome: tenant.legal_name || tenant.name,
      nome_fantasia: tenant.name,
      cnpj: tenant.cnpj || null,
      endereco: tenant.address || null,
      telefone: tenant.display_phone_number || null,
    },
    locatario: {
      nome: r.customer_name || null,
      cpf: r.customer_cpf || null,
      cnh: r.customer_cnh || null,
      telefone: r.customer_phone || null,
      // Endereço de residência: uma linha pronta para o contrato, e as partes
      // separadas para quem quiser montar de outro jeito.
      endereco: enderecoEmLinha(r),
      endereco_partes: {
        cep: cep(r.customer_zip_code),
        rua: r.customer_street || null,
        numero: r.customer_street_number || null,
        complemento: r.customer_complement || null,
        bairro: r.customer_district || null,
        cidade: r.customer_city || null,
        uf: r.customer_state || null,
      },
    },
    veiculo: {
      modelo: r.vehicle_model,
      placa: r.vehicle_plate,
      categoria: r.vehicle_category,
    },
    periodo: {
      retirada: fmt(r.pickup_at, tz),
      devolucao: fmt(r.return_at, tz),
      diarias: r.days_count,
    },
    valores: {
      diaria: Number(r.daily_rate_snapshot),
      total: Number(r.total_amount),
      caucao: Number(r.deposit_snapshot),
    },
    termos: tenant.contract_terms?.trim() ? tenant.contract_terms : clausulasPadrao(temCaucao),
    status: r.status,
    aceito_em: r.contract_accepted_at,
    gerado_em: new Date().toISOString(),
  };
}

/** Registra que o cliente aceitou o contrato (marca do dono). */
export async function recordAcceptance(tenant, reservationId) {
  const r = await reservationRepo.getReservationById(tenant.id, reservationId);
  if (!r) throw new HttpError(404, 'Reserva não encontrada.');
  const { rows } = await query(
    `UPDATE reservations SET contract_accepted_at = now()
      WHERE tenant_id = $1 AND id = $2 RETURNING contract_accepted_at`,
    [tenant.id, reservationId]
  );
  return { aceito_em: rows[0]?.contract_accepted_at };
}
