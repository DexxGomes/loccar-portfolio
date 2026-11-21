// ============================================================================
//  Migra tokens do WhatsApp em TEXTO PURO para CIFRADO (AES-256-GCM).
//
//  Uso:
//    node scripts/encryptWhatsappTokens.js
//
//  Idempotente: pula os que já estão cifrados (prefixo "enc:v1:"). Rode uma vez
//  depois de definir ENCRYPTION_KEY no .env. Seguro rodar de novo.
// ============================================================================
import { pool } from '../src/config/db.js';
import { encrypt, isEncrypted } from '../src/utils/crypto.js';

try {
  const { rows } = await pool.query(
    `SELECT id, name, whatsapp_token FROM tenants
      WHERE whatsapp_token IS NOT NULL AND whatsapp_token <> ''`
  );

  let cifrados = 0;
  let jaCifrados = 0;

  for (const t of rows) {
    if (isEncrypted(t.whatsapp_token)) {
      jaCifrados += 1;
      continue;
    }
    const cifrado = encrypt(t.whatsapp_token);
    await pool.query('UPDATE tenants SET whatsapp_token = $2 WHERE id = $1', [t.id, cifrado]);
    console.log(`  🔒 ${t.name} (${t.id})`);
    cifrados += 1;
  }

  console.log(
    `\n✅ Concluído. Cifrados agora: ${cifrados} · já cifrados: ${jaCifrados} · total com token: ${rows.length}.`
  );
} catch (err) {
  console.error('❌ Erro ao migrar tokens:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
