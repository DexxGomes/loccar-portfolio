// ============================================================================
//  Acesso a dados da tabela "documents".
// ============================================================================
import { query } from '../config/db.js';

/** Cria um registro de documento (o arquivo já está no storage privado). */
export async function createDocument(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO documents
       (tenant_id, reservation_id, customer_id, type, storage_path, mime_type, whatsapp_media_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId,
      data.reservation_id,
      data.customer_id,
      data.type,
      data.storage_path,
      data.mime_type ?? null,
      data.whatsapp_media_id ?? null,
    ]
  );
  return rows[0];
}

/** Lista os documentos de uma reserva. */
export async function listByReservation(tenantId, reservationId) {
  const { rows } = await query(
    `SELECT * FROM documents
      WHERE tenant_id = $1 AND reservation_id = $2
      ORDER BY uploaded_at ASC`,
    [tenantId, reservationId]
  );
  return rows;
}

/** Conta os documentos de uma reserva. */
export async function countByReservation(tenantId, reservationId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS total FROM documents WHERE tenant_id = $1 AND reservation_id = $2',
    [tenantId, reservationId]
  );
  return rows[0].total;
}

/**
 * Documentos cujo prazo de guarda venceu — a varredura da retenção.
 *
 * "Venceu" conta a partir do FIM da locação (devolução prevista), não do envio:
 * enquanto o carro está na rua o documento precisa existir. Só entram locações
 * já encerradas (finalizada/cancelada/expirada) — uma reserva ainda viva nunca
 * perde o documento, por mais antiga que seja.
 */
export async function listDocumentsToPurge(retentionDays, limit = 200) {
  const { rows } = await query(
    `SELECT d.id, d.tenant_id, d.storage_path
       FROM documents d
       JOIN reservations r ON r.id = d.reservation_id
      WHERE d.storage_path IS NOT NULL
        AND r.status IN ('finalizada', 'cancelada', 'recusada', 'expirada')
        AND COALESCE(r.return_at, r.updated_at, r.created_at) < now() - ($1 || ' days')::interval
      ORDER BY r.return_at ASC
      LIMIT $2`,
    [String(retentionDays), limit]
  );
  return rows;
}

/** Marca o documento como descartado (o arquivo já saiu do bucket). */
export async function markDocumentPurged(id) {
  await query(
    'UPDATE documents SET storage_path = NULL, purged_at = now() WHERE id = $1',
    [id]
  );
}

/** Lista todos os caminhos de storage de um cliente (para exclusão LGPD). */
/**
 * TODOS os arquivos de um cliente que estão no bucket — usado pela exclusão
 * LGPD, que promete apagar tudo.
 *
 * São três origens, e esquecer qualquer uma deixa foto do cliente no
 * armazenamento depois de ele pedir a exclusão:
 *   1. documents          — CNH, comprovante, selfie enviados para a reserva;
 *   2. messages           — imagens que ele mandou na conversa do WhatsApp;
 *   3. inspection_photos  — fotos das vistorias das locações dele.
 *
 * As linhas do banco somem por cascata, mas ARQUIVO no bucket não tem
 * cascata: some só se alguém mandar apagar. Por isso a lista vem daqui.
 */
export async function listStoragePathsByCustomer(tenantId, customerId) {
  const { rows } = await query(
    `SELECT storage_path FROM documents
      WHERE tenant_id = $1 AND customer_id = $2 AND storage_path IS NOT NULL

     UNION

     SELECT m.media_storage_path AS storage_path
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
      WHERE c.tenant_id = $1 AND c.customer_id = $2
        AND m.media_storage_path IS NOT NULL

     UNION

     SELECT f.storage_path
       FROM inspection_photos f
       JOIN inspections i   ON i.id = f.inspection_id
       JOIN reservations r  ON r.id = i.reservation_id
      WHERE f.tenant_id = $1 AND r.customer_id = $2
        AND f.storage_path IS NOT NULL`,
    [tenantId, customerId]
  );
  return rows.map((r) => r.storage_path);
}
