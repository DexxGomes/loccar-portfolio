// ============================================================================
//  Vistoria digital (check-in / check-out).
//
//  A vistoria é a prova do estado do carro na entrega e na devolução. Por isso:
//   - as fotos vão para o bucket PRIVADO (mesma regra dos documentos: só URL
//     assinada temporária, nunca link público);
//   - o comparativo entre as duas vistorias é calculado aqui, no servidor, para
//     a tela não "interpretar" número de km ou combustível por conta própria.
// ============================================================================
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import * as repo from '../repositories/inspectionRepository.js';
import { getReservationDetailed } from '../repositories/reservationRepository.js';
import { uploadBuffer, getSignedUrl, removeFile } from './storage.js';

// Tipos de imagem aceitos e teto de tamanho já decodificado (o painel envia a
// foto reduzida; isto aqui é só a última barreira).
const MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

const POSICOES = [
  'frente',
  'traseira',
  'lateral_esquerda',
  'lateral_direita',
  'painel',
  'extra',
];

const avariaSchema = z.object({
  // Percentuais sobre a figura do carro (a marca acompanha qualquer tela).
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  parte: z.string().trim().max(40).optional(),
  gravidade: z.enum(['leve', 'media', 'grave']).default('leve'),
  descricao: z.string().trim().max(200).optional(),
});

const criarSchema = z.object({
  reservationId: z.string().uuid('Reserva inválida.'),
  type: z.enum(['retirada', 'devolucao']),
  odometer: z.coerce.number().int().min(0).max(9_999_999).optional(),
  fuelLevel: z.coerce.number().int().min(0).max(8).optional(),
  damages: z.array(avariaSchema).max(40).default([]),
  notes: z.string().trim().max(2000).optional(),
  signedBy: z.string().trim().max(120).optional(),
});

const fotoSchema = z.object({
  position: z.enum(POSICOES),
  dataUrl: z.string().min(32, 'Imagem vazia.'),
});

/** Converte "data:image/jpeg;base64,AAA..." em { buffer, mimeType }. */
function lerDataUrl(dataUrl) {
  const casa = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!casa) throw new HttpError(400, 'Formato de imagem inválido.');

  const [, mimeType, base64] = casa;
  if (!MIMES.includes(mimeType))
    throw new HttpError(400, 'Envie a foto em JPEG, PNG ou WebP.');

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new HttpError(400, 'Imagem vazia.');
  if (buffer.length > MAX_BYTES)
    throw new HttpError(413, 'Foto muito grande. Tente novamente com uma imagem menor.');

  return { buffer, mimeType };
}

/** Cria a vistoria de uma reserva. */
export async function create(tenant, body, usuarioId = null) {
  const dados = criarSchema.parse(body);

  const reserva = await getReservationDetailed(tenant.id, dados.reservationId);
  if (!reserva) throw new HttpError(404, 'Reserva não encontrada.');

  try {
    return await repo.createInspection(tenant.id, {
      ...dados,
      vehicleId: reserva.vehicle_id,
      createdBy: usuarioId,
    });
  } catch (err) {
    // UNIQUE (reservation_id, type)
    if (err.code === '23505')
      throw new HttpError(
        409,
        `Esta reserva já tem uma vistoria de ${dados.type === 'retirada' ? 'retirada' : 'devolução'}.`
      );
    throw err;
  }
}

/** Anexa uma foto à vistoria (uma por requisição, para o envio não estourar). */
export async function addPhoto(tenant, inspectionId, body) {
  const { position, dataUrl } = fotoSchema.parse(body);

  const vistoria = await repo.getInspectionById(tenant.id, inspectionId);
  if (!vistoria) throw new HttpError(404, 'Vistoria não encontrada.');

  const { buffer, mimeType } = lerDataUrl(dataUrl);

  const storagePath = await uploadBuffer(buffer, {
    tenantId: tenant.id,
    prefix: `vistorias/${vistoria.reservation_id}/${vistoria.type}`,
    mimeType,
  });

  return repo.addPhoto(tenant.id, { inspectionId, position, storagePath, mimeType });
}

/** Uma vistoria com as fotos já assinadas (validade curta). */
async function comFotos(vistoria) {
  const fotos = await repo.listPhotos(vistoria.id);
  return {
    ...vistoria,
    fotos: await Promise.all(
      fotos.map(async (f) => ({
        id: f.id,
        position: f.position,
        created_at: f.created_at,
        url: await getSignedUrl(f.storage_path, 600),
      }))
    ),
  };
}

/**
 * Vistorias de uma reserva + comparativo entre elas.
 * O comparativo sai daqui pronto: km rodado, combustível devolvido a menos e
 * avarias que apareceram só na devolução.
 */
export async function listForReservation(tenant, reservationId) {
  const vistorias = await repo.listByReservation(tenant.id, reservationId);
  const completas = await Promise.all(vistorias.map(comFotos));

  const retirada = completas.find((v) => v.type === 'retirada') || null;
  const devolucao = completas.find((v) => v.type === 'devolucao') || null;

  let comparativo = null;
  if (retirada && devolucao) {
    const kmRodado =
      retirada.odometer != null && devolucao.odometer != null
        ? devolucao.odometer - retirada.odometer
        : null;
    const combustivel =
      retirada.fuel_level != null && devolucao.fuel_level != null
        ? devolucao.fuel_level - retirada.fuel_level
        : null;
    comparativo = {
      kmRodado,
      // Negativo = voltou com menos combustível do que saiu (em oitavos).
      combustivelOitavos: combustivel,
      avariasAntes: (retirada.damages || []).length,
      avariasDepois: (devolucao.damages || []).length,
      avariasNovas: Math.max(
        (devolucao.damages || []).length - (retirada.damages || []).length,
        0
      ),
    };
  }

  return { retirada, devolucao, comparativo };
}

/** Sugere o km inicial: o último odômetro registrado para aquele veículo. */
export async function ultimoOdometro(tenant, vehicleId) {
  const ultima = await repo.ultimaDoVeiculo(tenant.id, vehicleId);
  return { odometer: ultima?.odometer ?? null, em: ultima?.created_at ?? null };
}

/** Remove a vistoria e apaga as fotos do storage. */
export async function remove(tenant, id) {
  const vistoria = await repo.getInspectionById(tenant.id, id);
  if (!vistoria) throw new HttpError(404, 'Vistoria não encontrada.');

  const fotos = await repo.listPhotos(id);
  // Apaga os arquivos antes do registro; se algum falhar, seguimos assim mesmo
  // (arquivo órfão é menos grave do que registro fantasma no banco).
  await Promise.all(
    fotos.map((f) =>
      removeFile(f.storage_path).catch((e) =>
        console.warn('Falha ao remover foto da vistoria:', e.message)
      )
    )
  );
  await repo.deleteInspection(tenant.id, id);
}
