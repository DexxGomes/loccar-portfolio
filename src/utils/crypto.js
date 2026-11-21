// ============================================================================
//  Criptografia simétrica para segredos guardados no banco (ex: o
//  whatsapp_token de cada locadora). AES-256-GCM: além de cifrar, o GCM
//  autentica (detecta adulteração).
//
//  Formato do valor cifrado:  enc:v1:<iv_b64>:<tag_b64>:<dado_b64>
//  O prefixo "enc:v1:" deixa distinguir um valor cifrado de um texto puro
//  legado — por isso decrypt() é retrocompatível: se o valor não estiver no
//  formato cifrado, ele é devolvido como veio (token antigo continua servindo
//  até ser migrado com scripts/encryptWhatsappTokens.js).
//
//  A chave vem de ENCRYPTION_KEY (.env): 32 bytes, em hex (64 chars) ou base64.
//    Gere uma:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// ============================================================================
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const PREFIX = 'enc:v1:';

/** Resolve a chave de 32 bytes a partir do .env (hex ou base64). */
function getKey() {
  const raw = env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY não definido no .env — necessário para cifrar/decifrar segredos.'
    );
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hex, ou base64 de 32 bytes).');
  }
  return key;
}

/** Diz se um valor já está no formato cifrado. */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Cifra um texto. Valores vazios/nulos passam direto (nada a proteger). */
export function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (isEncrypted(plaintext)) return plaintext; // já cifrado — não cifra duas vezes
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96 bits, recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const dado = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), dado.toString('base64')].join(':');
}

/** Decifra um valor. Texto puro legado (sem o prefixo) é devolvido como veio. */
export function decrypt(value) {
  if (!isEncrypted(value)) return value;
  const key = getKey();
  const partes = value.split(':'); // ['enc','v1', iv, tag, dado]
  if (partes.length !== 5) throw new Error('Segredo cifrado em formato inválido.');
  const iv = Buffer.from(partes[2], 'base64');
  const tag = Buffer.from(partes[3], 'base64');
  const dado = Buffer.from(partes[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dado), decipher.final()]).toString('utf8');
}
