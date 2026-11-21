// ============================================================================
//  Acesso a dados das cobranças (contas a receber).
//
//  Decisão importante: "vencido" NÃO é gravado no banco — é DERIVADO na
//  consulta, comparando due_date com a data de hoje. Assim nenhuma cobrança
//  fica marcada errado só porque um job não rodou.
// ============================================================================
import { query } from '../config/db.js';

// Trecho reaproveitado: transforma pendente + vencida em "vencido" na leitura.
const STATUS_DERIVADO = `
  CASE WHEN p.status = 'pendente' AND p.due_date IS NOT NULL AND p.due_date < CURRENT_DATE
       THEN 'vencido' ELSE p.status::text END AS status`;

const CAMPOS = `
  p.id, p.tenant_id, p.reservation_id, p.customer_id, p.kind,
  p.amount::float AS amount, ${STATUS_DERIVADO}, p.status::text AS status_gravado,
  p.method, p.due_date, p.paid_at, p.description,
  p.provider, p.external_id, p.external_url, p.created_at, p.updated_at,
  c.name AS customer_name, c.phone AS customer_phone,
  v.model AS vehicle_model, v.plate AS vehicle_plate`;

const JOINS = `
  FROM payments p
  LEFT JOIN customers c ON c.id = p.customer_id
  LEFT JOIN reservations r ON r.id = p.reservation_id
  LEFT JOIN vehicles v ON v.id = r.vehicle_id`;

/** Lista cobranças com filtros opcionais. */
export async function listPayments(tenantId, { status, kind, reservationId, from, to } = {}) {
  const params = [tenantId];
  let sql = `SELECT ${CAMPOS} ${JOINS} WHERE p.tenant_id = $1`;

  if (reservationId) {
    params.push(reservationId);
    sql += ` AND p.reservation_id = $${params.length}`;
  }
  if (kind) {
    params.push(kind);
    sql += ` AND p.kind = $${params.length}`;
  }
  if (from && to) {
    params.push(from, to);
    sql += ` AND p.created_at >= $${params.length - 1} AND p.created_at < $${params.length}`;
  }

  sql += ' ORDER BY p.due_date NULLS LAST, p.created_at DESC';
  const { rows } = await query(sql, params);

  // O filtro por status usa o valor derivado, então acontece aqui.
  return status ? rows.filter((r) => r.status === status) : rows;
}

/** Busca uma cobrança por id. */
export async function getPaymentById(tenantId, id) {
  const { rows } = await query(`SELECT ${CAMPOS} ${JOINS} WHERE p.tenant_id = $1 AND p.id = $2`, [
    tenantId,
    id,
  ]);
  return rows[0] || null;
}

/** Cria uma cobrança. */
export async function createPayment(tenantId, d) {
  const { rows } = await query(
    `INSERT INTO payments
       (tenant_id, reservation_id, customer_id, kind, amount, status, method,
        due_date, paid_at, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      tenantId,
      d.reservationId ?? null,
      d.customerId ?? null,
      d.kind ?? 'diarias',
      d.amount,
      d.status ?? 'pendente',
      d.method ?? null,
      d.dueDate ?? null,
      d.paidAt ?? null,
      d.description ?? null,
      d.createdBy ?? null,
    ]
  );
  return getPaymentById(tenantId, rows[0].id);
}

/** Atualiza os campos informados (atualização parcial). */
export async function updatePayment(tenantId, id, campos) {
  const mapa = {
    amount: 'amount',
    status: 'status',
    method: 'method',
    dueDate: 'due_date',
    paidAt: 'paid_at',
    description: 'description',
    provider: 'provider',
    externalId: 'external_id',
    externalUrl: 'external_url',
  };

  const sets = [];
  const params = [tenantId, id];
  for (const [chave, coluna] of Object.entries(mapa)) {
    if (campos[chave] !== undefined) {
      params.push(campos[chave]);
      sets.push(`${coluna} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getPaymentById(tenantId, id);

  const { rowCount } = await query(
    `UPDATE payments SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
    params
  );
  return rowCount ? getPaymentById(tenantId, id) : null;
}

/** Remove uma cobrança. */
export async function deletePayment(tenantId, id) {
  const { rowCount } = await query('DELETE FROM payments WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    id,
  ]);
  return rowCount > 0;
}

/**
 * Resumo financeiro. "Recebido" olha para paid_at (quando o dinheiro entrou);
 * "a receber" e "vencido" olham para o que ainda está pendente — por isso o
 * vencido não depende da janela do período.
 */
export async function resumo(tenantId, from, to) {
  const { rows } = await query(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0)::float FROM payments
         WHERE tenant_id = $1 AND status = 'pago'
           AND paid_at >= $2 AND paid_at < $3)                          AS recebido,
       (SELECT COUNT(*)::int FROM payments
         WHERE tenant_id = $1 AND status = 'pago'
           AND paid_at >= $2 AND paid_at < $3)                          AS qtd_recebido,
       (SELECT COALESCE(SUM(amount), 0)::float FROM payments
         WHERE tenant_id = $1 AND status = 'pendente')                  AS a_receber,
       (SELECT COUNT(*)::int FROM payments
         WHERE tenant_id = $1 AND status = 'pendente')                  AS qtd_a_receber,
       (SELECT COALESCE(SUM(amount), 0)::float FROM payments
         WHERE tenant_id = $1 AND status = 'pendente'
           AND due_date IS NOT NULL AND due_date < CURRENT_DATE)        AS vencido,
       (SELECT COUNT(*)::int FROM payments
         WHERE tenant_id = $1 AND status = 'pendente'
           AND due_date IS NOT NULL AND due_date < CURRENT_DATE)        AS qtd_vencido,
       (SELECT COALESCE(SUM(amount), 0)::float FROM payments
         WHERE tenant_id = $1 AND kind = 'caucao' AND status = 'pago')  AS caucao_em_maos`,
    [tenantId, from, to]
  );
  return rows[0];
}
