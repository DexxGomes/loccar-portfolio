// ============================================================================
//  Autenticação do painel (login por e-mail/senha, com JWT).
// ============================================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { findByEmail, findByCpf, findById, updatePassword } from '../repositories/userRepository.js';
import { findTenantById } from '../repositories/tenantRepository.js';

const TOKEN_EXPIRACAO = '7d';

function exigirSegredo() {
  if (!env.JWT_SECRET) {
    throw new HttpError(500, 'JWT_SECRET não configurado no servidor.');
  }
  return env.JWT_SECRET;
}

/**
 * Faz login por CPF (só dígitos) ou e-mail, e devolve token JWT + dados básicos.
 * O identificador com 11 dígitos é tratado como CPF; caso contrário, e-mail.
 */
export async function login(identificador, senha) {
  const secret = exigirSegredo();
  if (!identificador || !senha) throw new HttpError(400, 'Informe o CPF (ou e-mail) e a senha.');

  const bruto = String(identificador).trim();
  const digitos = bruto.replace(/\D/g, '');
  const user = digitos.length === 11 ? await findByCpf(digitos) : await findByEmail(bruto.toLowerCase());

  // Mensagem genérica (não revela se o cadastro existe).
  if (!user) throw new HttpError(401, 'CPF/e-mail ou senha inválidos.');

  const confere = await bcrypt.compare(senha, user.password_hash);
  if (!confere) throw new HttpError(401, 'CPF/e-mail ou senha inválidos.');

  const token = jwt.sign(
    // O e-mail vai junto para o registro de auditoria conseguir dizer QUEM
    // acessou sem uma consulta extra a cada acesso. Token antigo (sem e-mail)
    // continua valendo: a auditoria grava o user_id do mesmo jeito.
    { userId: user.id, tenantId: user.tenant_id, role: user.role, email: user.email },
    secret,
    { expiresIn: TOKEN_EXPIRACAO }
  );

  const tenant = await findTenantById(user.tenant_id);
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
    tenant: { id: tenant.id, name: tenant.name },
  };
}

/** Troca a senha do usuário logado (exige a senha atual). */
export async function changePassword(userId, senhaAtual, novaSenha) {
  if (!userId) throw new HttpError(401, 'Sessão inválida.');
  if (!senhaAtual || !novaSenha) throw new HttpError(400, 'Informe a senha atual e a nova senha.');
  if (String(novaSenha).length < 6) {
    throw new HttpError(400, 'A nova senha precisa de pelo menos 6 caracteres.');
  }
  const user = await findById(userId);
  if (!user) throw new HttpError(404, 'Usuário não encontrado.');
  const confere = await bcrypt.compare(senhaAtual, user.password_hash);
  if (!confere) throw new HttpError(401, 'Senha atual incorreta.');
  const hash = await bcrypt.hash(novaSenha, 10);
  await updatePassword(userId, hash);
}

/** Verifica um token JWT e devolve o payload. Lança 401 se inválido. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, exigirSegredo());
  } catch {
    throw new HttpError(401, 'Sessão inválida ou expirada.');
  }
}
