// ============================================================================
//  Acesso a dados da tabela "users" (usuários do painel).
// ============================================================================
import { query } from '../config/db.js';

/** Busca um usuário pelo e-mail (primeiro que encontrar). */
export async function findByEmail(email) {
  const { rows } = await query(
    'SELECT * FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

/** Busca um usuário pelo CPF (só dígitos). */
export async function findByCpf(cpf) {
  const { rows } = await query(
    'SELECT * FROM users WHERE cpf = $1 AND is_active = TRUE LIMIT 1',
    [cpf]
  );
  return rows[0] || null;
}

/** Busca um usuário pelo id. */
export async function findById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

/** Atualiza a senha (hash) de um usuário e limpa a marca de "trocar no 1º acesso". */
export async function updatePassword(id, passwordHash) {
  await query(
    'UPDATE users SET password_hash = $2, must_change_password = FALSE WHERE id = $1',
    [id, passwordHash]
  );
}

/** Cria um usuário do painel (aceita cpf, telefone e a marca de troca obrigatória). */
export async function createUser({
  tenantId,
  name,
  email,
  passwordHash,
  role = 'owner',
  cpf = null,
  phone = null,
  mustChangePassword = false,
}) {
  const { rows } = await query(
    `INSERT INTO users (tenant_id, name, email, password_hash, role, cpf, phone, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name,
                     cpf = COALESCE(EXCLUDED.cpf, users.cpf),
                     phone = COALESCE(EXCLUDED.phone, users.phone),
                     must_change_password = EXCLUDED.must_change_password, is_active = TRUE
     RETURNING id, tenant_id, name, email, role, cpf`,
    [tenantId, name, email, passwordHash, role, cpf, phone, mustChangePassword]
  );
  return rows[0];
}
