// ============================================================================
//  Tratamento central de erros da API.
//  Converte erros conhecidos (validação Zod, HttpError, violações do Postgres)
//  em respostas HTTP adequadas, e o resto em 500 genérico (sem vazar detalhes).
// ============================================================================
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

/** Rota não encontrada (404). */
export function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

// ----------------------------------------------------------------------------
//  Traduzir erro técnico em frase de gente
//
//  O painel mostra APENAS o campo `error`. Se ele disser "Dados inválidos.",
//  a pessoa fica sem saber o que corrigir — por isso montamos aqui uma frase
//  que nomeia o campo e o problema.
// ----------------------------------------------------------------------------

/** Nome do campo como aparece na tela, não como se chama no banco. */
const ROTULOS = {
  model: 'Modelo',
  plate: 'Placa',
  category: 'Categoria',
  daily_rate: 'Valor da diária',
  deposit_amount: 'Caução',
  year: 'Ano',
  color: 'Cor',
  odometer: 'Quilometragem',
  name: 'Nome',
  cpf: 'CPF',
  phone: 'Telefone',
  email: 'E-mail',
  cnh_number: 'CNH',
  cnh_valid_until: 'Validade da CNH',
  zip_code: 'CEP',
  street: 'Rua',
  street_number: 'Número',
  district: 'Bairro',
  city: 'Cidade',
  state: 'UF',
  amount: 'Valor',
  date: 'Data',
  due_date: 'Vencimento',
  description: 'Descrição',
  vehicleId: 'Veículo',
  customerId: 'Cliente',
  reservationId: 'Reserva',
  pickupAt: 'Data de retirada',
  returnAt: 'Data de devolução',
  type: 'Tipo',
  fuelLevel: 'Nível de combustível',
};

/** Mensagem já escrita por nós (em português) ou padrão do Zod (em inglês)? */
function jaEstaEmPortugues(msg) {
  return /[áâãàéêíóôõúüç]/i.test(msg) || /obrigatóri|inválid|precisa|deve/i.test(msg);
}

function fraseDeValidacao(campo, msg) {
  const rotulo = ROTULOS[campo] || campo;
  if (jaEstaEmPortugues(msg)) return msg.endsWith('.') ? msg : `${msg}.`;
  // "Falta preencher: X" evita a armadilha de concordância (obrigatório vs
  // obrigatória) sem precisar guardar o gênero de cada campo.
  if (/required/i.test(msg)) return `Falta preencher: ${rotulo}.`;
  if (/expected number/i.test(msg)) return `${rotulo} precisa ser um número.`;
  if (/expected string/i.test(msg)) return `${rotulo} precisa ser um texto.`;
  if (/expected array/i.test(msg)) return `${rotulo} precisa ser uma lista.`;
  if (/datetime|invalid date/i.test(msg)) return `${rotulo} precisa ser uma data válida.`;
  if (/invalid enum|invalid_enum/i.test(msg)) return `${rotulo} tem um valor que não existe.`;
  if (/too small|greater than/i.test(msg)) return `${rotulo} está abaixo do mínimo aceito.`;
  if (/too big|less than/i.test(msg)) return `${rotulo} passou do máximo aceito.`;
  return `${rotulo}: ${msg}`;
}

/**
 * Valor repetido (índice único). O Postgres só diz o nome da restrição, então
 * traduzimos para o que a pessoa entende — "essa placa já está cadastrada".
 */
function fraseDeDuplicado(err) {
  const alvo = `${err.constraint || ''} ${err.detail || ''}`.toLowerCase();

  if (alvo.includes('plate')) return 'Já existe um veículo com essa placa.';
  if (alvo.includes('cpf')) return 'Esse CPF já está cadastrado.';
  if (alvo.includes('email')) return 'Esse e-mail já está cadastrado.';
  if (alvo.includes('phone_number_id')) return 'Esse número de WhatsApp já está em uso por outra locadora.';
  if (alvo.includes('phone')) return 'Esse telefone já está cadastrado.';
  if (alvo.includes('reservation_id') && alvo.includes('type'))
    return 'Essa vistoria já foi feita para esta reserva.';
  if (alvo.includes('external_id')) return 'Essa cobrança já foi registrada.';
  return 'Esse valor já está cadastrado.';
}

/** Handler de erro do Express (precisa dos 4 parâmetros). */
export function errorHandler(err, req, res, _next) {
  // Erros de validação de entrada (Zod)
  if (err instanceof ZodError) {
    const campos = err.flatten().fieldErrors;
    const [primeiroCampo, mensagens] = Object.entries(campos)[0] || [];
    const quantos = Object.keys(campos).length;

    return res.status(400).json({
      // Frase principal: nomeia o primeiro problema. Se houver mais de um,
      // avisa quantos faltam, para a pessoa não corrigir um de cada vez.
      error:
        primeiroCampo && mensagens?.[0]
          ? fraseDeValidacao(primeiroCampo, mensagens[0]) +
            (quantos > 1 ? ` (e mais ${quantos - 1} campo(s) para revisar)` : '')
          : 'Dados inválidos.',
      details: campos,
    });
  }

  // Erros de aplicação lançados pelos serviços
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Violações conhecidas do PostgreSQL (códigos SQLSTATE)
  switch (err.code) {
    case '22P02': // invalid_text_representation (ex: UUID malformado)
      return res.status(400).json({ error: 'Esse item não existe mais ou o link está errado.' });
    case '23P01': // exclusion_violation (sobreposição de reserva/bloqueio)
      return res.status(409).json({
        error: 'Conflito de agenda: o período se sobrepõe a outra reserva do veículo.',
      });
    case '23505': // unique_violation
      return res.status(409).json({ error: fraseDeDuplicado(err) });
    case '23503': // foreign_key_violation
      return res.status(409).json({
        error: 'Não dá para excluir: este item ainda está sendo usado em outros registros.',
      });
    case '23514': // check_violation
      return res.status(400).json({ error: 'Algum valor está fora do aceito. Confira os campos.' });
    case 'P0001': // raise_exception — nossas triggers de agenda (reserva x manutenção).
      // As mensagens dessas triggers são escritas para humanos e não expõem
      // nada interno, então podem ir direto ao painel.
      return res.status(409).json({ error: err.message || 'Conflito de agenda.' });
    default:
      // Erro inesperado: loga no servidor e devolve mensagem genérica.
      console.error('Erro não tratado:', err);
      return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
