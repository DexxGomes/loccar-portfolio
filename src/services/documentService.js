// ============================================================================
//  Fluxo de documentos.
//    - attachIncomingDocument: anexa uma imagem recebida à reserva do cliente,
//      classificando pelo tipo esperado (ordem) e, quando o conjunto está
//      completo, move a reserva para "em_analise" (fila do dono).
//    - listForReservation: devolve os documentos com URLs assinadas temporárias
//      (o painel nunca acessa o arquivo por URL pública).
// ============================================================================
import { HttpError } from '../utils/httpError.js';
import * as documentRepo from '../repositories/documentRepository.js';
import * as reservationRepo from '../repositories/reservationRepository.js';
import { getReservationById } from '../repositories/reservationRepository.js';
import { getSignedUrl } from './storage.js';

// Ordem em que os documentos são pedidos (a IA solicita um de cada vez).
// O tipo do arquivo recebido é inferido pela posição na sequência.
const ORDEM = ['cnh_frente', 'cnh_verso', 'comprovante_residencia', 'selfie_cnh'];

// Status em que a reserva ainda aceita documentos.
const STATUS_COLETA = ['pre_reserva', 'aguardando_documentos', 'em_analise'];

/**
 * Anexa uma imagem (já salva no storage) como documento da reserva ativa.
 * @returns {Promise<object|null>} o documento criado, ou null se não havia reserva.
 */
export async function attachIncomingDocument({ tenant, customer, storagePath, mimeType, mediaId }) {
  // Encontra a reserva ativa do cliente que ainda coleta documentos.
  const reserva = await reservationRepo.findActiveReservationForCustomer(
    tenant.id,
    customer.id,
    STATUS_COLETA
  );
  if (!reserva) return null;

  // Tipo esperado pela posição (1ª imagem = CNH frente, e assim por diante).
  const jaEnviados = await documentRepo.countByReservation(tenant.id, reserva.id);
  const tipo = ORDEM[jaEnviados] || 'selfie_cnh';

  const doc = await documentRepo.createDocument(tenant.id, {
    reservation_id: reserva.id,
    customer_id: customer.id,
    type: tipo,
    storage_path: storagePath,
    mime_type: mimeType,
    whatsapp_media_id: mediaId,
  });

  // Se completou o conjunto e a reserva aguardava documentos, vai para análise.
  const total = jaEnviados + 1;
  if (total >= ORDEM.length && reserva.status === 'aguardando_documentos') {
    await reservationRepo.updateReservationStatus(tenant.id, reserva.id, 'em_analise');
  }

  return doc;
}

/**
 * Lista os documentos de uma reserva, cada um com uma URL assinada temporária.
 */
export async function listForReservation(tenant, reservationId) {
  const reserva = await getReservationById(tenant.id, reservationId);
  if (!reserva) throw new HttpError(404, 'Reserva não encontrada.');

  const docs = await documentRepo.listByReservation(tenant.id, reservationId);
  // Gera as URLs assinadas em paralelo (validade curta).
  return Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      type: d.type,
      mime_type: d.mime_type,
      uploaded_at: d.uploaded_at,
      url: await getSignedUrl(d.storage_path, 300),
    }))
  );
}
