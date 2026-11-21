// ============================================================================
//  Cria (ou atualiza) um usuário DONO de uma locadora.
//
//  Uso:
//    node scripts/createOwner.js <email> "<nome>" <cpf> [telefone] [tenantId]
//
//  - O login do dono passa a ser o CPF (só dígitos).
//  - O sistema GERA uma senha forte e única e a imprime aqui — passe-a ao
//    cliente; ele será obrigado a trocá-la no primeiro acesso.
//  - Sem tenantId, usa a locadora demo do seed.
// ============================================================================
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { createUser } from '../src/repositories/userRepository.js';

const DEMO_ID = '00000000-0000-0000-0000-000000000001';
const [, , email, nome, cpfArg, telefoneArg, tenantIdArg] = process.argv;
const tenantId = tenantIdArg || DEMO_ID;
const cpf = (cpfArg || '').replace(/\D/g, '');
const phone = telefoneArg ? telefoneArg.replace(/\D/g, '') : null;

if (!email || !nome || !cpf) {
  console.error('Uso: node scripts/createOwner.js <email> "<nome>" <cpf> [telefone] [tenantId]');
  process.exit(1);
}
if (cpf.length !== 11) {
  console.error('❌ CPF deve ter 11 dígitos.');
  process.exit(1);
}

// Senha forte e única, sem caracteres ambíguos (fácil de digitar).
function gerarSenha() {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const L = 'abcdefghijkmnpqrstuvwxyz';
  const D = '23456789';
  const S = '#@$';
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  return pick(S) + pick(U) + Array.from({ length: 6 }, () => pick(D)).join('') + pick(L) + pick(U);
}

const senha = gerarSenha();

try {
  const hash = await bcrypt.hash(senha, 10);
  const user = await createUser({
    tenantId,
    name: nome,
    email: email.toLowerCase().trim(),
    passwordHash: hash,
    role: 'owner',
    cpf,
    phone,
    mustChangePassword: true,
  });
  console.log('✅ Dono pronto:', { id: user.id, nome, cpf, tenant: user.tenant_id });
  console.log('');
  console.log('   👉 Login:  CPF ' + cpf);
  console.log('   👉 Senha inicial (passe ao cliente):  ' + senha);
  console.log('   (ele troca no primeiro acesso)');
} catch (err) {
  console.error('❌ Erro ao criar usuário:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
