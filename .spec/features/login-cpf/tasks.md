# Tasks: Login por CPF

> feature: login-cpf

## T-001 — Guardar CPF, telefone e a marca de trocar senha [concluida]
- Refs: US-001, US-002, AC-001, AC-012
- Arquivos: db/migrations/009_login_cpf.sql, src/repositories/userRepository.js
- Notas: CPF único entre todos os usuários (índice parcial, só quando preenchido) — é o que garante AC-012.

## T-002 — Aceitar CPF ou e-mail no login e avisar sobre a troca [concluida]
- Refs: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007
- Arquivos: src/services/authService.js, src/routes/auth.js
- Notas: 11 dígitos = CPF; qualquer outra coisa = e-mail. Mensagem idêntica nos dois casos de falha (AC-004).

## T-003 — Trocar a senha com segurança e limpar a marca [concluida]
- Refs: AC-008, AC-009, AC-010, AC-011
- Arquivos: src/services/authService.js
- Notas: a troca limpa `must_change_password` na mesma escrita da senha.

## T-004 — Tela de login com o teclado certo no celular [concluida]
- Refs: AC-002, AC-003, AC-007
- Arquivos: web/src/pages/Login.jsx, web/src/api.js
- Notas: dois modos (CPF e e-mail) porque no celular cada um pede um teclado diferente; máscara enquanto digita.

## T-005 — Definir CPF de usuário que já existia [concluida]
- Refs: US-001, AC-001
- Arquivos: scripts/setUserLogin.js, scripts/createOwner.js, package.json
- Notas: quem foi criado antes do login por CPF precisa ganhar CPF sem trocar a senha.
