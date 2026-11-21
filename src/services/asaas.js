// ============================================================================
//  ADAPTADOR DO ASAAS (cobrança PIX)
//
//  Fica isolado de propósito: o resto do sistema fala com "o provedor de
//  cobrança", não com o Asaas. Trocar de provedor um dia significa escrever
//  outro arquivo como este, sem mexer em serviço nem em tela.
//
//  Sem ASAAS_API_KEY no .env, o recurso simplesmente não liga — o painel
//  segue funcionando com cobrança manual (dinheiro, PIX na mão, cartão).
//
//  ATENÇÃO: este adaptador ainda NÃO foi exercitado contra a API real, porque
//  depende de uma chave da conta do dono. A primeira cobrança deve ser feita
//  no ambiente sandbox (ASAAS_ENV=sandbox).
// ============================================================================
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
};

/** O provedor está configurado? */
export function estaConfigurado() {
  return Boolean(env.ASAAS_API_KEY);
}

function base() {
  return BASES[env.ASAAS_ENV] || BASES.sandbox;
}

/** Chamada HTTP com o cabeçalho de autenticação do Asaas. */
async function chamar(caminho, { metodo = 'GET', corpo } = {}) {
  if (!estaConfigurado())
    throw new HttpError(400, 'Cobrança automática não configurada: falta a chave do Asaas.');

  let resposta;
  try {
    resposta = await fetch(`${base()}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        access_token: env.ASAAS_API_KEY,
        'User-Agent': 'LocCar',
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch (err) {
    throw new HttpError(502, `Não consegui falar com o Asaas: ${err.message}`);
  }

  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : {};

  if (!resposta.ok) {
    // O Asaas devolve { errors: [{ code, description }] }
    const descricao = dados?.errors?.[0]?.description || `Erro ${resposta.status} no Asaas.`;
    throw new HttpError(resposta.status === 401 ? 401 : 400, descricao);
  }
  return dados;
}

/**
 * Encontra o cliente pelo CPF/CNPJ ou cria um novo.
 * O Asaas exige um cliente cadastrado antes de emitir a cobrança.
 */
export async function garantirCliente({ nome, cpfCnpj, telefone, email }) {
  if (!cpfCnpj) throw new HttpError(400, 'Para gerar o PIX, o cliente precisa ter CPF cadastrado.');

  const busca = await chamar(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`);
  if (busca?.data?.length) return busca.data[0].id;

  const criado = await chamar('/customers', {
    metodo: 'POST',
    corpo: {
      name: nome || 'Cliente',
      cpfCnpj,
      mobilePhone: telefone || undefined,
      email: email || undefined,
      notificationDisabled: false,
    },
  });
  return criado.id;
}

/**
 * Cria uma cobrança PIX.
 * @returns {Promise<{id: string, invoiceUrl: string, status: string}>}
 */
export async function criarCobrancaPix({ clienteId, valor, vencimento, descricao, referencia }) {
  return chamar('/payments', {
    metodo: 'POST',
    corpo: {
      customer: clienteId,
      billingType: 'PIX',
      value: Number(valor.toFixed(2)),
      dueDate: vencimento, // YYYY-MM-DD
      description: descricao,
      externalReference: referencia,
    },
  });
}

/** Busca o QR Code (imagem em base64 e o código copia-e-cola). */
export async function pegarQrCodePix(cobrancaId) {
  return chamar(`/payments/${cobrancaId}/pixQrCode`);
}

/** Consulta a situação de uma cobrança (útil para conferir pagamento). */
export async function consultarCobranca(cobrancaId) {
  return chamar(`/payments/${cobrancaId}`);
}
