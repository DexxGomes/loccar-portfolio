# Spec: Login por CPF

> feature: login-cpf
> status: implementada

## Contexto

O dono da locadora e sua equipe não são pessoas de tecnologia, e muitos não têm
e-mail que usem no dia a dia. O CPF é o número que todo brasileiro sabe de cor.
Esta feature faz do CPF a porta de entrada do painel, mantém o e-mail como
alternativa para quem já entrava assim, e obriga a troca da senha inicial no
primeiro acesso — porque a senha de estreia é gerada por nós e trafega por
WhatsApp até chegar ao cliente.

## Histórias

### US-001 — Entrar com o número que eu sei de cor

Como dono de locadora, quero entrar no painel com meu CPF e senha, para que eu
não precise lembrar qual e-mail cadastrei.

#### AC-001 — Entra com o CPF e recebe acesso

- **Dado** um usuário cadastrado com CPF e senha
- **Quando** ele informa o CPF (só números) e a senha certa
- **Então** entra no painel e vê o nome da locadora dele

#### AC-002 — O CPF é aceito do jeito que aparece na tela

- **Dado** que a tela de login põe pontos e traço enquanto a pessoa digita
- **Quando** ela envia o CPF no formato `000.000.000-00`
- **Então** entra normalmente (o sistema ignora a pontuação)

#### AC-003 — Quem já entrava por e-mail continua entrando

- **Dado** um usuário cadastrado com e-mail
- **Quando** ele digita o e-mail com maiúsculas ou espaço sobrando
- **Então** entra normalmente (o sistema arruma maiúsculas e espaços)

#### AC-004 — Senha errada não entra, e a mensagem não entrega quem é cliente

- **Dado** alguém tentando adivinhar acesso
- **Quando** erra a senha de um CPF que existe, ou tenta um CPF que não existe
- **Então** recebe a mesma mensagem nos dois casos
- **E** não consegue descobrir, pela resposta, se aquele CPF é cliente da casa

#### AC-005 — Faltando dado, o sistema diz o que falta

- **Dado** alguém que enviou o CPF mas não a senha
- **Quando** tenta entrar
- **Então** recebe um aviso pedindo o CPF (ou e-mail) e a senha (resposta 400)

#### AC-006 — Usuário desativado não entra

- **Dado** um usuário que foi desativado
- **Quando** ele tenta entrar com a senha correta
- **Então** o acesso é recusado

### US-002 — Trocar a senha de estreia antes de usar o sistema

Como responsável pelo sistema, quero que a senha inicial seja trocada no
primeiro acesso, para que a senha enviada por WhatsApp não continue valendo.

#### AC-007 — O sistema avisa que a senha precisa ser trocada

- **Dado** um usuário criado com senha inicial gerada por nós
- **Quando** ele entra pela primeira vez
- **Então** o sistema informa que a troca de senha é obrigatória

#### AC-008 — Trocar a senha exige estar logado

- **Dado** alguém que não entrou no sistema
- **Quando** tenta trocar a senha de um usuário
- **Então** o pedido é recusado

#### AC-009 — Trocar a senha exige saber a senha atual

- **Dado** um usuário logado
- **Quando** ele informa a senha atual errada
- **Então** a troca é recusada

#### AC-010 — Senha nova curta demais é recusada

- **Dado** um usuário logado trocando a senha
- **Quando** ele escolhe uma senha com menos de 6 caracteres
- **Então** a troca é recusada com aviso

#### AC-011 — Depois de trocar, vale a senha nova e o aviso some

- **Dado** um usuário no primeiro acesso
- **Quando** ele troca a senha informando a atual corretamente
- **Então** consegue entrar com a senha nova
- **E** a senha antiga deixa de funcionar
- **E** o sistema para de exigir a troca

### US-003 — Um CPF, uma pessoa

Como responsável pelo sistema, quero que o CPF identifique um único usuário,
para que o login por CPF nunca fique ambíguo.

#### AC-012 — O mesmo CPF não pode ficar em dois usuários

- **Dado** um usuário já cadastrado com um CPF
- **Quando** alguém tenta cadastrar outro usuário com o mesmo CPF
- **Então** o cadastro é recusado

## Fora de escopo

- Recuperação de senha pelo próprio usuário (hoje o dono do sistema redefine).
- Segundo fator de autenticação.
- Conferir o dígito verificador do CPF: aceitamos 11 dígitos. Validar a
  matemática do CPF não impede ninguém de entrar com o CPF certo.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | Um identificador com 11 dígitos é sempre CPF; qualquer outra coisa é e-mail | confirmada | Nenhum e-mail é composto só por 11 dígitos, então a regra não gera ambiguidade |
| ASM-002 | O CPF é único entre TODAS as locadoras, não só dentro de uma | confirmada | O login acontece antes de saber a locadora, então precisa resolver para um único usuário no sistema inteiro |
| ASM-003 | Senha de 6 caracteres é o mínimo aceitável para o painel | confirmada | Mantido o mínimo que já valia antes desta feature |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | Funcionário da locadora terá login próprio ou todos usam o do dono? | respondida | Por ora só o dono tem acesso; login por funcionário fica para quando houver demanda |
