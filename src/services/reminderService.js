// ============================================================================
//  Serviço de lembretes.
//    - scheduleForReservation: agenda os lembretes de retirada e devolução
//      (24h antes de cada), chamado quando a reserva é confirmada.
//    - sendDue: envia os lembretes vencidos via TEMPLATE do WhatsApp.
//    - cancelForReservation: cancela os lembretes de uma reserva.
//
//  Os lembretes usam mensagens de TEMPLATE (aprovadas na Meta) porque podem
//  cair fora da janela de 24h. Os nomes dos templates vêm do .env.
// ============================================================================
import { env } from '../config/env.js';
import * as reminderRepo from '../repositories/reminderRepository.js';
import { sendTemplateMessage } from './whatsapp.js';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Agenda os dois lembretes (retirada e devolução) de uma reserva. */
export async function scheduleForReservation(tenant, reservation) {
  const agora = Date.now();
  const retirada = new Date(reservation.pickup_at).getTime() - UM_DIA_MS;
  const devolucao = new Date(reservation.return_at).getTime() - UM_DIA_MS;

  // Se o horário de lembrete já passou (ex: retirada em menos de 24h), envia já.
  await reminderRepo.createReminder(tenant.id, {
    reservationId: reservation.id,
    type: 'retirada',
    scheduledFor: new Date(Math.max(retirada, agora)),
  });
  await reminderRepo.createReminder(tenant.id, {
    reservationId: reservation.id,
    type: 'devolucao',
    scheduledFor: new Date(Math.max(devolucao, agora)),
  });
}

/** Cancela os lembretes pendentes de uma reserva. */
export async function cancelForReservation(tenant, reservationId) {
  await reminderRepo.cancelByReservation(tenant.id, reservationId);
}

/** Formata uma data no fuso do tenant, ex: "15/08 às 09:00". */
function formatarQuando(iso, timezone) {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { timeZone: timezone, day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

/**
 * Envia os lembretes vencidos. Retorna quantos foram processados.
 * Chamado pelo job agendado.
 */
export async function sendDue() {
  const pendentes = await reminderRepo.listDue(50);

  for (const rem of pendentes) {
    const tenant = {
      id: rem.tenant_id,
      name: rem.tenant_name,
      whatsapp_token: rem.whatsapp_token,
      phone_number_id: rem.phone_number_id,
      timezone: rem.timezone,
    };

    const primeiroNome = rem.customer_name ? rem.customer_name.split(' ')[0] : 'cliente';
    const quando = rem.type === 'retirada' ? rem.pickup_at : rem.return_at;
    const horaTexto = formatarQuando(quando, rem.timezone);

    const templateName =
      rem.type === 'retirada' ? env.REMINDER_PICKUP_TEMPLATE : env.REMINDER_RETURN_TEMPLATE;

    // Corpo do template com 3 variáveis: {{1}} nome, {{2}} veículo, {{3}} data/hora.
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: primeiroNome },
          { type: 'text', text: rem.vehicle_model },
          { type: 'text', text: horaTexto },
        ],
      },
    ];

    try {
      await sendTemplateMessage(tenant, rem.customer_phone, templateName, env.REMINDER_TEMPLATE_LANG, components);
      await reminderRepo.markSent(rem.id);
    } catch (err) {
      console.error(`Falha ao enviar lembrete ${rem.id}:`, err.message);
      await reminderRepo.markFailed(rem.id, err.message);
    }
  }

  return pendentes.length;
}
