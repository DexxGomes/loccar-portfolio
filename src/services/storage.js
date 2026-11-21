// ============================================================================
//  Storage privado de arquivos (Supabase Storage).
//  Os documentos NUNCA ficam públicos: o painel acessa por URL ASSINADA
//  temporária, gerada sob demanda.
// ============================================================================
import { randomUUID } from 'node:crypto';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';

const BUCKET = env.SUPABASE_STORAGE_BUCKET;

// Extensão a partir do mime type (para nomear o arquivo).
const EXT_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Faz upload de um buffer para o bucket privado e retorna o caminho salvo.
 * @param {Buffer} buffer
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string} [opts.prefix]   subpasta lógica (ex: "reservas/<id>")
 * @param {string} opts.mimeType
 * @returns {Promise<string>} storage_path
 */
export async function uploadBuffer(buffer, { tenantId, prefix = 'geral', mimeType }) {
  const supabase = getSupabase();
  const ext = EXT_POR_MIME[mimeType] || 'bin';
  const path = `tenants/${tenantId}/${prefix}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Falha ao subir arquivo no storage: ${error.message}`);
  }
  return path;
}

/**
 * Gera uma URL assinada temporária para visualizar um arquivo privado.
 * @param {string} storagePath
 * @param {number} [expiresInSeconds=300]  validade da URL (padrão 5 min)
 */
export async function getSignedUrl(storagePath, expiresInSeconds = 300) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new Error(`Falha ao gerar URL assinada: ${error.message}`);
  }
  return data.signedUrl;
}

/**
 * Remove um arquivo do storage (usado, por ex., na exclusão de dados - LGPD).
 */
export async function removeFile(storagePath) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Falha ao remover arquivo do storage: ${error.message}`);
  }
}
