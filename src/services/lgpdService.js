// ============================================================================
//  LGPD - Direito ao esquecimento.
//  Exclui TODOS os dados de um cliente: arquivos no storage privado e registros
//  no banco (documentos, reservas, conversa, mensagens e o próprio cadastro).
//
//  Observação: as entradas de blocklist NÃO são apagadas por padrão — são um
//  registro interno de segurança. Ajuste conforme sua política se necessário.
// ============================================================================
import { HttpError } from '../utils/httpError.js';
import { withTransaction } from '../config/db.js';
import { findCustomerById } from '../repositories/customerRepository.js';
import { listStoragePathsByCustomer } from '../repositories/documentRepository.js';
import { removeFile } from './storage.js';

/**
 * Apaga todos os dados de um cliente do tenant.
 * @returns {Promise<{arquivos_removidos:number}>}
 */
export async function deleteCustomerData(tenant, customerId) {
  const customer = await findCustomerById(tenant.id, customerId);
  if (!customer) throw new HttpError(404, 'Cliente não encontrado.');

  // 1) Remove os arquivos do storage (fora da transação do banco).
  const paths = await listStoragePathsByCustomer(tenant.id, customerId);
  let removidos = 0;
  for (const path of paths) {
    try {
      await removeFile(path);
      removidos++;
    } catch (e) {
      console.warn(`Falha ao remover arquivo ${path}:`, e.message);
    }
  }

  // 2) Remove os registros do banco, na ordem correta das dependências.
  await withTransaction(async (client) => {
    await client.query('DELETE FROM documents WHERE tenant_id = $1 AND customer_id = $2', [
      tenant.id,
      customerId,
    ]);
    await client.query('DELETE FROM reservations WHERE tenant_id = $1 AND customer_id = $2', [
      tenant.id,
      customerId,
    ]);
    // Conversas do cliente (mensagens caem em cascata pela FK).
    await client.query('DELETE FROM conversations WHERE tenant_id = $1 AND customer_id = $2', [
      tenant.id,
      customerId,
    ]);
    await client.query('DELETE FROM customers WHERE tenant_id = $1 AND id = $2', [
      tenant.id,
      customerId,
    ]);
  });

  return { arquivos_removidos: removidos };
}
