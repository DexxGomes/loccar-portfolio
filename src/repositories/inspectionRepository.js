// ============================================================================
//  Acesso a dados das vistorias (retirada e devolução) e suas fotos.
// ============================================================================
import { query } from '../config/db.js';

/** Cria a vistoria. As avarias vão como JSONB. */
export async function createInspection(tenantId, data) {
  const { rows } = await query(
    `INSERT INTO inspections
       (tenant_id, reservation_id, vehicle_id, type, odometer, fuel_level,
        damages, notes, signed_by, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING *`,
    [
      tenantId,
      data.reservationId,
      data.vehicleId,
      data.type,
      data.odometer ?? null,
      data.fuelLevel ?? null,
      JSON.stringify(data.damages ?? []),
      data.notes ?? null,
      data.signedBy ?? null,
      data.createdBy ?? null,
    ]
  );
  return rows[0];
}

/** Busca uma vistoria por id (dentro do tenant). */
export async function getInspectionById(tenantId, id) {
  const { rows } = await query('SELECT * FROM inspections WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    id,
  ]);
  return rows[0] || null;
}

/** Vistorias de uma reserva (retirada e devolução). */
export async function listByReservation(tenantId, reservationId) {
  const { rows } = await query(
    `SELECT i.*, v.model AS vehicle_model, v.plate AS vehicle_plate
       FROM inspections i
       JOIN vehicles v ON v.id = i.vehicle_id
      WHERE i.tenant_id = $1 AND i.reservation_id = $2
      ORDER BY i.created_at ASC`,
    [tenantId, reservationId]
  );
  return rows;
}

/** Última vistoria registrada de um veículo (para saber o km atual). */
export async function ultimaDoVeiculo(tenantId, vehicleId) {
  const { rows } = await query(
    `SELECT * FROM inspections
      WHERE tenant_id = $1 AND vehicle_id = $2 AND odometer IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId, vehicleId]
  );
  return rows[0] || null;
}

/** Anexa uma foto já enviada ao storage. */
export async function addPhoto(tenantId, { inspectionId, position, storagePath, mimeType }) {
  const { rows } = await query(
    `INSERT INTO inspection_photos (tenant_id, inspection_id, position, storage_path, mime_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, inspectionId, position, storagePath, mimeType ?? null]
  );
  return rows[0];
}

/** Fotos de uma vistoria. */
export async function listPhotos(inspectionId) {
  const { rows } = await query(
    'SELECT * FROM inspection_photos WHERE inspection_id = $1 ORDER BY created_at ASC',
    [inspectionId]
  );
  return rows;
}

/** Remove a vistoria (as fotos caem por CASCADE no banco). */
export async function deleteInspection(tenantId, id) {
  const { rowCount } = await query('DELETE FROM inspections WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    id,
  ]);
  return rowCount > 0;
}
