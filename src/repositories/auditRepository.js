// ============================================================================
//  Registro de auditoria (LGPD art. 37) — ver db/migrations/014_auditoria.sql
// ============================================================================
import { query } from '../config/db.js';

/** Grava um acesso. Chamado em segundo plano; nunca deve derrubar a resposta. */
export async function registrarAcesso({ tenantId, userId, userEmail, acao, recurso, recursoId, ip }) {
  await query(
    `INSERT INTO audit_log (tenant_id, user_id, user_email, acao, recurso, recurso_id, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [tenantId, userId, userEmail, acao, recurso, recursoId, ip || null]
  );
}

/**
 * Lê o registro da locadora, do mais recente para o mais antigo.
 * Aceita filtrar por um registro específico ("quem viu a ficha deste cliente").
 */
export async function listarAcessos(tenantId, { recurso, recursoId, limite = 200 } = {}) {
  const params = [tenantId];
  let filtro = '';
  if (recurso && recursoId) {
    params.push(recurso, recursoId);
    filtro = ' AND recurso = $2 AND recurso_id = $3';
  }
  params.push(Math.min(Number(limite) || 200, 500));

  const { rows } = await query(
    `SELECT id, user_email, acao, recurso, recurso_id, ip, created_at
       FROM audit_log
      WHERE tenant_id = $1${filtro}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}
