// ============================================================================
//  Consultas de indicadores do painel (dashboard).
//
//  Convenções destas consultas:
//   - "Receita" considera apenas reservas que valem dinheiro de verdade:
//     confirmada, em_andamento e finalizada. Pré-reserva não é receita.
//   - O período é sempre [from, to) e usa pickup_at (quando a locação começa).
//   - Somas em dinheiro voltam como número (::float) já arredondado, para o
//     painel não precisar converter texto.
// ============================================================================
import { query } from '../config/db.js';

// Reservas que representam receita/ocupação real.
const STATUS_VALENDO = ['confirmada', 'em_andamento', 'finalizada'];

/** Totais do período: receita, nº de reservas, ticket médio e diárias. */
export async function resumoPeriodo(tenantId, from, to) {
  const { rows } = await query(
    `SELECT COUNT(*)::int                                   AS reservas,
            ROUND(COALESCE(SUM(total_amount), 0), 2)::float AS receita,
            ROUND(COALESCE(AVG(total_amount), 0), 2)::float AS ticket_medio,
            COALESCE(SUM(days_count), 0)::int               AS diarias
       FROM reservations
      WHERE tenant_id = $1
        AND pickup_at >= $2 AND pickup_at < $3
        AND status = ANY($4)`,
    [tenantId, from, to, STATUS_VALENDO]
  );
  return rows[0];
}

/**
 * Receita por dia dentro do período (sem buracos: dias sem reserva voltam 0).
 * O agrupamento respeita o fuso da locadora.
 */
export async function serieDiaria(tenantId, from, to, timezone) {
  const { rows } = await query(
    `WITH dias AS (
       SELECT generate_series(
                ($2::timestamptz AT TIME ZONE $5)::date,
                ($3::timestamptz AT TIME ZONE $5)::date,
                interval '1 day'
              )::date AS dia
     )
     SELECT to_char(d.dia, 'YYYY-MM-DD')                      AS dia,
            ROUND(COALESCE(SUM(r.total_amount), 0), 2)::float AS receita,
            COUNT(r.id)::int                                  AS reservas
       FROM dias d
       LEFT JOIN reservations r
              ON r.tenant_id = $1
             AND r.status = ANY($4)
             AND (r.pickup_at AT TIME ZONE $5)::date = d.dia
      GROUP BY d.dia
      ORDER BY d.dia`,
    [tenantId, from, to, STATUS_VALENDO, timezone]
  );
  return rows;
}

/** Composição da frota por situação. */
export async function frota(tenantId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int                                            AS total,
            COUNT(*) FILTER (WHERE status = 'disponivel')::int       AS disponiveis,
            COUNT(*) FILTER (WHERE status = 'alugado')::int          AS alugados,
            COUNT(*) FILTER (WHERE status = 'manutencao')::int       AS manutencao,
            ROUND(COALESCE(AVG(daily_rate), 0), 2)::float            AS diaria_media
       FROM vehicles
      WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0];
}

/**
 * Dias-veículo ocupados no período. Conta só a parte da reserva que cai
 * dentro da janela (uma locação que atravessa o mês não conta em dobro).
 */
export async function diasOcupados(tenantId, from, to) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(
              EXTRACT(EPOCH FROM (LEAST(return_at, $3::timestamptz)
                                - GREATEST(pickup_at, $2::timestamptz)))
            ), 0)::float / 86400.0 AS dias
       FROM reservations
      WHERE tenant_id = $1
        AND status = ANY($4)
        AND tstzrange(pickup_at, return_at) && tstzrange($2, $3)`,
    [tenantId, from, to, STATUS_VALENDO]
  );
  return rows[0]?.dias || 0;
}

/** Quantas reservas nasceram em cada situação no período (funil/rosca). */
export async function porStatus(tenantId, from, to) {
  const { rows } = await query(
    `SELECT status, COUNT(*)::int AS total
       FROM reservations
      WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3
      GROUP BY status`,
    [tenantId, from, to]
  );
  return rows;
}

/** Veículos que mais faturaram no período. */
export async function topVeiculos(tenantId, from, to, limite = 5) {
  const { rows } = await query(
    `SELECT v.id,
            v.model,
            v.plate,
            v.category,
            COUNT(r.id)::int                                  AS reservas,
            ROUND(COALESCE(SUM(r.total_amount), 0), 2)::float AS receita,
            -- O FILTER é obrigatório: LEAST/GREATEST ignoram NULL, então sem
            -- ele um veículo SEM reservas somaria o período inteiro como
            -- "alugado" (o LEFT JOIN traz uma linha com r.* nulo).
            COALESCE(SUM(
              EXTRACT(EPOCH FROM (LEAST(r.return_at, $3::timestamptz)
                                - GREATEST(r.pickup_at, $2::timestamptz)))
            ) FILTER (WHERE r.id IS NOT NULL), 0)::float / 86400.0 AS dias_alugado
       FROM vehicles v
       LEFT JOIN reservations r
              ON r.vehicle_id = v.id
             AND r.status = ANY($4)
             AND tstzrange(r.pickup_at, r.return_at) && tstzrange($2, $3)
      WHERE v.tenant_id = $1
      GROUP BY v.id, v.model, v.plate, v.category
      ORDER BY receita DESC, reservas DESC
      LIMIT $5`,
    [tenantId, from, to, STATUS_VALENDO, limite]
  );
  return rows;
}

/**
 * Receita já contratada que ainda não começou: reservas confirmadas com
 * retirada no futuro. É o "que está por vir" da locadora.
 */
export async function receitaPrevista(tenantId) {
  const { rows } = await query(
    `SELECT ROUND(COALESCE(SUM(total_amount), 0), 2)::float AS valor,
            COUNT(*)::int                                   AS reservas
       FROM reservations
      WHERE tenant_id = $1
        AND status = 'confirmada'
        AND pickup_at >= now()`,
    [tenantId]
  );
  return rows[0];
}

/** Quantas conversas novas o WhatsApp trouxe no período (topo do funil). */
export async function conversasNoPeriodo(tenantId, from, to) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM conversations
      WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3`,
    [tenantId, from, to]
  );
  return rows[0]?.total || 0;
}

/** O que espera decisão humana agora (independe do período). */
export async function pendencias(tenantId) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM reservations
         WHERE tenant_id = $1 AND status = 'em_analise')::int         AS em_analise,
       (SELECT COUNT(*) FROM conversations
         WHERE tenant_id = $1 AND needs_human = TRUE)::int            AS conversas,
       (SELECT COUNT(*) FROM reservations
         WHERE tenant_id = $1
           AND status IN ('pre_reserva', 'aguardando_documentos'))::int AS aguardando_docs,
       (SELECT COUNT(*) FROM reservations
         WHERE tenant_id = $1 AND status = 'em_andamento'
           AND return_at < now())::int                                AS atrasadas`,
    [tenantId]
  );
  return rows[0];
}

/**
 * Retiradas e devoluções de HOJE (no fuso da locadora), mais as devoluções
 * atrasadas — é o que alimenta o sino de lembretes do dia.
 *   - retirada: reserva confirmada que sai hoje
 *   - devolucao: reserva em andamento que volta hoje
 *   - atrasada: reserva em andamento cuja devolução já passou
 */
export async function agendaDoDia(tenantId, timezone) {
  const { rows } = await query(
    `SELECT tipo, id, quando, status, atrasada,
            vehicle_model, vehicle_plate, customer_name, customer_phone
       FROM (
         SELECT 'retirada' AS tipo, r.id, r.pickup_at AS quando, r.status,
                FALSE AS atrasada,
                v.model AS vehicle_model, v.plate AS vehicle_plate,
                c.name AS customer_name, c.phone AS customer_phone
           FROM reservations r
           JOIN vehicles v  ON v.id = r.vehicle_id
           JOIN customers c ON c.id = r.customer_id
          WHERE r.tenant_id = $1
            AND r.status = 'confirmada'
            AND (r.pickup_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
         UNION ALL
         SELECT 'devolucao' AS tipo, r.id, r.return_at AS quando, r.status,
                (r.return_at < now()) AS atrasada,
                v.model, v.plate, c.name, c.phone
           FROM reservations r
           JOIN vehicles v  ON v.id = r.vehicle_id
           JOIN customers c ON c.id = r.customer_id
          WHERE r.tenant_id = $1
            AND r.status = 'em_andamento'
            AND (
                 (r.return_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
                 OR r.return_at < now()
                )
       ) eventos
      ORDER BY atrasada DESC, quando ASC`,
    [tenantId, timezone]
  );
  return rows;
}

/** Retiradas e devoluções agendadas para os próximos dias. */
export async function proximosEventos(tenantId, dias = 7, limite = 12) {
  const { rows } = await query(
    `SELECT * FROM (
       SELECT 'retirada' AS tipo, r.id, r.pickup_at AS quando, r.status,
              v.model AS vehicle_model, v.plate AS vehicle_plate,
              c.name AS customer_name, c.phone AS customer_phone
         FROM reservations r
         JOIN vehicles v  ON v.id = r.vehicle_id
         JOIN customers c ON c.id = r.customer_id
        WHERE r.tenant_id = $1
          AND r.status = 'confirmada'
          AND r.pickup_at BETWEEN now() AND now() + ($2 || ' days')::interval
       UNION ALL
       SELECT 'devolucao' AS tipo, r.id, r.return_at AS quando, r.status,
              v.model, v.plate, c.name, c.phone
         FROM reservations r
         JOIN vehicles v  ON v.id = r.vehicle_id
         JOIN customers c ON c.id = r.customer_id
        WHERE r.tenant_id = $1
          AND r.status = 'em_andamento'
          AND r.return_at BETWEEN now() - interval '2 days'
                              AND now() + ($2 || ' days')::interval
     ) eventos
     ORDER BY quando ASC
     LIMIT $3`,
    [tenantId, String(dias), limite]
  );
  return rows;
}
