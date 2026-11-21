// ============================================================================
//  Define o CPF (e o telefone) de um usuário QUE JÁ EXISTE, sem mexer na senha.
//
//  Serve para quem foi criado antes do login por CPF: o acesso continua o
//  mesmo, só passa a aceitar o CPF também.
//
//  Uso:
//    node scripts/setUserLogin.js <email> <cpf> [telefone]
//    npm run set:login -- <email> <cpf> [telefone]
//
//  Para criar um dono NOVO (com senha inicial gerada), use createOwner.js.
// ============================================================================
import { pool } from '../src/config/db.js';

const [, , emailArg, cpfArg, telefoneArg] = process.argv;

const email = (emailArg || '').toLowerCase().trim();
const cpf = (cpfArg || '').replace(/\D/g, '');
const phone = telefoneArg ? telefoneArg.replace(/\D/g, '') : null;

if (!email || !cpf) {
  console.error('Uso: node scripts/setUserLogin.js <email> <cpf> [telefone]');
  process.exit(1);
}
if (cpf.length !== 11) {
  console.error('❌ CPF deve ter 11 dígitos. Recebi ' + cpf.length + '.');
  process.exit(1);
}

try {
  // O CPF é único entre todos os usuários — avisa antes de esbarrar no índice.
  const { rows: jaUsado } = await pool.query(
    'SELECT email FROM users WHERE cpf = $1 AND lower(email) <> $2',
    [cpf, email]
  );
  if (jaUsado.length) {
    console.error(`❌ Esse CPF já está no login de outro usuário (${jaUsado[0].email}).`);
    process.exit(1);
  }

  const { rows } = await pool.query(
    `UPDATE users
        SET cpf   = $2,
            phone = COALESCE($3, phone)
      WHERE lower(email) = $1
      RETURNING id, name, email, cpf, phone, must_change_password`,
    [email, cpf, phone]
  );

  if (!rows.length) {
    console.error(`❌ Nenhum usuário com o e-mail ${email}.`);
    process.exit(1);
  }

  const u = rows[0];
  console.log('✅ Login atualizado:', {
    nome: u.name,
    email: u.email,
    cpf: u.cpf,
    telefone: u.phone || '—',
  });
  console.log('');
  console.log('   👉 Agora dá para entrar com o CPF ' + u.cpf + ' e a MESMA senha de antes.');
  if (u.must_change_password) {
    console.log('   ⚠️  Esse usuário ainda vai ser obrigado a trocar a senha no próximo acesso.');
  }
} catch (err) {
  console.error('❌ Erro ao atualizar o login:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
