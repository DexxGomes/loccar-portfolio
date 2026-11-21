// ============================================================================
//  Retrato do dinheiro da locadora em uma consulta só.
//
//  Junta o que hoje mora em três telas (a receber, despesas e multas) para a
//  pergunta que o dono realmente faz: "como está o meu dinheiro este mês?".
//
//  Regras que valem aqui:
//   - "entrou" e "gastos" são do PERÍODO pedido.
//   - "a receber", "vencido", "caução" e "multas" são SALDOS de agora (não
//     dependem do período) — é o que está em aberto neste momento.
//   - "vencido" é derivado na leitura (due_date < hoje), nunca gravado.
// ============================================================================
import { query } from '../config/db.js';

export async function retrato(tenantId, from, to) {
  const { rows } = await query(
    `SELECT
       -- Entrou no período. A CAUÇÃO FICA DE FORA de propósito: é dinheiro do
       -- cliente que está só depositado e volta na entrega — se entrasse aqui,
       -- o "sobrou" mostraria um lucro que não existe.
       (SELECT COALESCE(SUM(amount), 0)::float FROM payments
         WHERE tenant_id = $1 AND status = 'pago' AND kind <> 'caucao'
           AND paid_at >= $2 AND paid_at < $3)                          AS entrou,
       (SELECT COUNT(*)::int FROM payments
         WHERE tenant_id = $1 AND status = 'pago' AND kind <> 'caucao'
           AND paid_at >= $2 AND paid_at < $3)                          AS qtd_entrou,

       -- Saiu no período
       (SELECT COALESCE(SUM(amount), 0)::float FROM expenses
         WHERE tenant_id = $1 AND date >= $2::date AND date < $3::date)  AS gastos,
       (SELECT COUNT(*)::int FROM expenses
         WHERE tenant_id = $1 AND date >= $2::date AND date < $3::date)  AS qtd_gastos,

       -- Em aberto agora
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

       -- Dinheiro de terceiros que está com você
       (SELECT COALESCE(SUM(amount), 0)::float FROM payments
         WHERE tenant_id = $1 AND kind = 'caucao' AND status = 'pago')  AS caucao_em_maos,

       -- Multas ainda não repassadas ao locatário
       (SELECT COALESCE(SUM(amount), 0)::float FROM fines
         WHERE tenant_id = $1 AND status = 'pendente')                  AS multas_a_repassar,
       (SELECT COUNT(*)::int FROM fines
         WHERE tenant_id = $1 AND status = 'pendente')                  AS qtd_multas`,
    [tenantId, from, to]
  );
  return rows[0];
}

/** Maiores gastos do período, agrupados por categoria (para explicar o saldo). */
export async function gastosPorCategoria(tenantId, from, to, limite = 5) {
  const { rows } = await query(
    `SELECT category AS categoria, COALESCE(SUM(amount), 0)::float AS total, COUNT(*)::int AS qtd
       FROM expenses
      WHERE tenant_id = $1 AND date >= $2::date AND date < $3::date
      GROUP BY category
      ORDER BY total DESC
      LIMIT $4`,
    [tenantId, from, to, limite]
  );
  return rows;
}
