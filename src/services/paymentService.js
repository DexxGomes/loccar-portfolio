// ============================================================================
//  Contas a receber da locadora.
//
//  Duas formas de cobrar convivem:
//   1) MANUAL — o dono registra o que combinou (dinheiro, PIX na mão, cartão
//      da maquininha). Funciona sem nenhuma integração.
//   2) AUTOMÁTICA — gera um PIX no Asaas e manda o link pelo WhatsApp.
//      Só liga quando existe ASAAS_API_KEY.
// ============================================================================
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import * as repo from '../repositories/paymentRepository.js';
import { getReservationDetailed } from '../repositories/reservationRepository.js';
import { findCustomerById } from '../repositories/customerRepository.js';
import * as asaas from './asaas.js';
import { sendAndLog } from './messaging.js';

const DIA_MS = 86400000;

const criarSchema = z.object({
  reservationId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  kind: z.enum(['sinal', 'diarias', 'caucao', 'extra', 'multa']).default('diarias'),
  amount: z.coerce.number().nonnegative('O valor não pode ser negativo.'),
  status: z.enum(['pendente', 'pago', 'cancelado', 'estornado']).default('pendente'),
  method: z.enum(['pix', 'dinheiro', 'cartao', 'transferencia', 'boleto', 'outro']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.').optional(),
  description: z.string().trim().max(240).optional(),
});

const atualizarSchema = criarSchema.partial().omit({ reservationId: true, customerId: true });

/** Data de hoje em YYYY-MM-DD (para vencimento padrão). */
const paraData = (d) => d.toISOString().slice(0, 10);

export async function list(tenant, filtros = {}) {
  return repo.listPayments(tenant.id, filtros);
}

export async function resumo(tenant, { from, to } = {}) {
  const fim = to ? new Date(to) : new Date(Date.now() + DIA_MS);
  const inicio = from ? new Date(from) : new Date(fim.getTime() - 30 * DIA_MS);
  return repo.resumo(tenant.id, inicio, fim);
}

/** Cria uma cobrança avulsa ou ligada a uma locação. */
export async function create(tenant, body, usuarioId = null) {
  const dados = criarSchema.parse(body);

  let customerId = dados.customerId ?? null;

  if (dados.reservationId) {
    const reserva = await getReservationDetailed(tenant.id, dados.reservationId);
    if (!reserva) throw new HttpError(404, 'Reserva não encontrada.');
    customerId = customerId || reserva.customer_id;
  }

  // Marcar como pago sem dizer quando: assume agora.
  const paidAt = dados.status === 'pago' ? new Date() : null;

  return repo.createPayment(tenant.id, {
    ...dados,
    customerId,
    paidAt,
    createdBy: usuarioId,
  });
}

/**
 * Cria de uma vez as cobranças que toda locação tem: as diárias e, quando
 * existe, a caução. Evita digitar o óbvio a cada reserva aprovada.
 */
export async function gerarDaReserva(tenant, reservationId, usuarioId = null) {
  const reserva = await getReservationDetailed(tenant.id, reservationId);
  if (!reserva) throw new HttpError(404, 'Reserva não encontrada.');

  const existentes = await repo.listPayments(tenant.id, { reservationId });
  if (existentes.length > 0)
    throw new HttpError(409, 'Esta locação já tem cobranças registradas.');

  // Vencimento no dia da retirada: é quando o dinheiro costuma ser cobrado.
  const vencimento = paraData(new Date(reserva.pickup_at));
  const criadas = [];

  criadas.push(
    await repo.createPayment(tenant.id, {
      reservationId,
      customerId: reserva.customer_id,
      kind: 'diarias',
      amount: Number(reserva.total_amount),
      dueDate: vencimento,
      description: `${reserva.days_count} diária(s) · ${reserva.vehicle_model}`,
      createdBy: usuarioId,
    })
  );

  if (Number(reserva.deposit_snapshot) > 0) {
    criadas.push(
      await repo.createPayment(tenant.id, {
        reservationId,
        customerId: reserva.customer_id,
        kind: 'caucao',
        amount: Number(reserva.deposit_snapshot),
        dueDate: vencimento,
        description: 'Caução (devolvida no fim da locação)',
        createdBy: usuarioId,
      })
    );
  }

  return criadas;
}

/** Atualiza uma cobrança (valor, vencimento, situação…). */
export async function update(tenant, id, body) {
  const dados = atualizarSchema.parse(body);

  // Quem marca como pago sem informar a data está dizendo "recebi agora".
  if (dados.status === 'pago' && dados.paidAt === undefined) dados.paidAt = new Date();
  if (dados.status && dados.status !== 'pago') dados.paidAt = null;

  const atualizada = await repo.updatePayment(tenant.id, id, dados);
  if (!atualizada) throw new HttpError(404, 'Cobrança não encontrada.');
  return atualizada;
}

export async function remove(tenant, id) {
  const ok = await repo.deletePayment(tenant.id, id);
  if (!ok) throw new HttpError(404, 'Cobrança não encontrada.');
}

/** O painel pergunta isto para decidir se mostra o botão de PIX. */
export function statusIntegracao() {
  return { pix: asaas.estaConfigurado() };
}

/**
 * Gera a cobrança PIX no provedor e (se der) manda o link ao cliente pelo
 * WhatsApp. O envio é o último passo e nunca derruba a operação: se o
 * WhatsApp falhar, a cobrança já existe e o link fica no painel.
 */
export async function gerarPix(tenant, id, { enviarWhatsapp = true } = {}) {
  if (!asaas.estaConfigurado())
    throw new HttpError(
      400,
      'Cobrança por PIX não configurada. Adicione ASAAS_API_KEY no servidor para ativar.'
    );

  const cobranca = await repo.getPaymentById(tenant.id, id);
  if (!cobranca) throw new HttpError(404, 'Cobrança não encontrada.');
  if (cobranca.status === 'pago') throw new HttpError(409, 'Esta cobrança já está paga.');
  if (cobranca.external_url)
    return { pagamento: cobranca, jaExistia: true, link: cobranca.external_url };

  if (!cobranca.customer_id) throw new HttpError(400, 'A cobrança precisa de um cliente.');
  const cliente = await findCustomerById(tenant.id, cobranca.customer_id);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado.');

  const clienteAsaas = await asaas.garantirCliente({
    nome: cliente.name,
    cpfCnpj: cliente.cpf,
    telefone: cliente.phone,
  });

  const cobrancaAsaas = await asaas.criarCobrancaPix({
    clienteId: clienteAsaas,
    valor: Number(cobranca.amount),
    vencimento: cobranca.due_date
      ? paraData(new Date(cobranca.due_date))
      : paraData(new Date(Date.now() + DIA_MS)),
    descricao: cobranca.description || 'Locação de veículo',
    referencia: cobranca.id,
  });

  const atualizada = await repo.updatePayment(tenant.id, id, {
    provider: 'asaas',
    externalId: cobrancaAsaas.id,
    externalUrl: cobrancaAsaas.invoiceUrl,
    method: 'pix',
  });

  // QR Code é um extra: se falhar, o link da fatura já resolve.
  const qr = await asaas.pegarQrCodePix(cobrancaAsaas.id).catch(() => null);

  if (enviarWhatsapp && cliente.phone) {
    const texto =
      `Segue o link para pagamento de ${Number(cobranca.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}` +
      `${cobranca.description ? ` (${cobranca.description})` : ''}:\n${cobrancaAsaas.invoiceUrl}`;
    await sendAndLog(tenant, cliente.phone, texto).catch((e) =>
      console.warn('Falha ao enviar o link de pagamento:', e.message)
    );
  }

  return { pagamento: atualizada, link: cobrancaAsaas.invoiceUrl, qrCode: qr?.encodedImage ?? null, copiaECola: qr?.payload ?? null };
}
