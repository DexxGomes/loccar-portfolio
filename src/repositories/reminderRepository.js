// ============================================================================
//  Acesso a dados da tabela "reminders" (lembretes de retirada e devolução).
// ============================================================================
import { query } from '../config/db.js';

/**
 * Cria um lembrete. Idempotente: se já existe (mesma reserva e tipo), não duplica.
 */
export async function createReminder(tenantId, { reservationId, type, scheduledFor }) {
  const { rows } = await query(
    `INSERT INTO reminders (tenant_id, reservation_id, type, scheduled_for)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reservation_id, type) DO NOTHING
     RETURNING *`,
    [tenantId, reservationId, type, scheduledFor]
  );
  return rows[0] || null;
}

/**
 * Lista lembretes pendentes já vencidos, com todos os dados necessários para
 * o envio (credenciais do tenant, dados do cliente, veículo e período).
 * Só inclui reservas ainda ativas (confirmada / em andamento).
 */
export async function listDue(limit = 50) {
  const { rows } = await query(
    `SELECT rem.id, rem.type, rem.reservation_id,
            r.pickup_at, r.return_at,
            v.model AS vehicle_model,
            c.name AS customer_name, c.phone AS customer_phone,
            t.id AS tenant_id, t.name AS tenant_name,
            t.whatsapp_token, t.phone_number_id, t.timezone
       FROM reminders rem
       JOIN reservations r ON r.id = rem.reservation_id
       JOIN vehicles v ON v.id = r.vehicle_id
       JOIN customers c ON c.id = r.customer_id
       JOIN tenants t ON t.id = rem.tenant_id
      WHERE rem.status = 'pendente'
        AND rem.scheduled_for <= now()
        AND r.status IN ('confirmada', 'em_andamento')
      ORDER BY rem.scheduled_for ASC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

/** Marca um lembrete como enviado. */
export async function markSent(id) {
  await query(
    "UPDATE reminders SET status = 'enviado', sent_at = now(), error = NULL WHERE id = $1",
    [id]
  );
}

/** Marca um lembrete como falho, guardando o erro. */
export async function markFailed(id, error) {
  await query("UPDATE reminders SET status = 'falhou', error = $2 WHERE id = $1", [
    id,
    error?.slice?.(0, 500) ?? String(error),
  ]);
}

/** Cancela os lembretes pendentes de uma reserva (ex: reserva cancelada). */
export async function cancelByReservation(tenantId, reservationId) {
  await query(
    `UPDATE reminders SET status = 'cancelado'
      WHERE tenant_id = $1 AND reservation_id = $2 AND status = 'pendente'`,
    [tenantId, reservationId]
  );
}
