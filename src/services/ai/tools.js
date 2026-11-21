// ============================================================================
//  Ferramentas (tools) que a IA pode chamar durante a conversa.
//    - toolDefinitions: os esquemas enviados ao Claude
//    - executeTool: executa a ferramenta usando os serviços do sistema
//
//  Cada execução recebe um contexto { tenant, customer, conversation }.
//  As ferramentas NUNCA confirmam reservas nem expõem dados internos.
// ============================================================================
import { HttpError } from '../../utils/httpError.js';
import { CATEGORIAS } from '../../utils/categorias.js';
import * as reservationService from '../reservationService.js';
import * as reservationRepo from '../../repositories/reservationRepository.js';
import { updateCustomer, registerLgpdConsent } from '../../repositories/customerRepository.js';
import { setNeedsHuman } from '../../repositories/conversationRepository.js';
import { notifyOwnerNeedsHuman } from '../notify.js';

// Esquemas das ferramentas (strict: garante que os argumentos batem com o schema).
export const toolDefinitions = [
  {
    name: 'consultar_disponibilidade',
    description:
      'Lista os veículos disponíveis para um período, com valor da diária, caução e total estimado. Use antes de criar qualquer pré-reserva.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pickupAt: { type: 'string', description: 'Data/hora de retirada em ISO 8601' },
        returnAt: { type: 'string', description: 'Data/hora de devolução em ISO 8601' },
        category: {
          type: ['string', 'null'],
          enum: [...CATEGORIAS, null],
          description:
            'Categoria desejada. Use null se o cliente não especificou uma preferência.',
        },
      },
      required: ['pickupAt', 'returnAt', 'category'],
    },
  },
  {
    name: 'criar_pre_reserva',
    description:
      'Cria uma PRÉ-RESERVA de um veículo para o cliente atual, em um período. Sempre deixe claro que é sujeita a análise.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        vehicleId: { type: 'string', description: 'ID do veículo escolhido (vindo da disponibilidade)' },
        pickupAt: { type: 'string', description: 'Data/hora de retirada em ISO 8601' },
        returnAt: { type: 'string', description: 'Data/hora de devolução em ISO 8601' },
      },
      required: ['vehicleId', 'pickupAt', 'returnAt'],
    },
  },
  {
    name: 'remarcar_reserva',
    description: 'Altera o período de uma PRÉ-RESERVA existente do cliente.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reservationId: { type: 'string' },
        pickupAt: { type: 'string', description: 'Nova retirada em ISO 8601' },
        returnAt: { type: 'string', description: 'Nova devolução em ISO 8601' },
      },
      required: ['reservationId', 'pickupAt', 'returnAt'],
    },
  },
  {
    name: 'cancelar_reserva',
    description: 'Cancela uma PRÉ-RESERVA do cliente.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reservationId: { type: 'string' },
      },
      required: ['reservationId'],
    },
  },
  {
    name: 'consultar_minhas_reservas',
    description: 'Lista as reservas do cliente atual (para ele consultar status, remarcar ou cancelar).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    name: 'atualizar_dados_cliente',
    description:
      'Salva/atualiza dados do cliente (nome, CPF, CNH e endereço de residência) quando ele informar. ' +
      'O endereço é obrigatório no contrato de locação.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: ['string', 'null'] },
        cpf: { type: ['string', 'null'], description: 'Apenas dígitos' },
        cnh_number: { type: ['string', 'null'] },
        cnh_valid_until: { type: ['string', 'null'], description: 'Data (YYYY-MM-DD)' },
        zip_code: { type: ['string', 'null'], description: 'CEP, apenas dígitos (8)' },
        street: { type: ['string', 'null'], description: 'Rua/alameda/avenida' },
        street_number: { type: ['string', 'null'], description: 'Número da casa' },
        complement: { type: ['string', 'null'], description: 'Apto, bloco (opcional)' },
        district: { type: ['string', 'null'], description: 'Bairro' },
        city: { type: ['string', 'null'] },
        state: { type: ['string', 'null'], description: 'UF com 2 letras' },
      },
      required: [
        'name',
        'cpf',
        'cnh_number',
        'cnh_valid_until',
        'zip_code',
        'street',
        'street_number',
        'complement',
        'district',
        'city',
        'state',
      ],
    },
  },
  {
    name: 'registrar_consentimento_lgpd',
    description:
      'Registra que o cliente consentiu com o uso dos documentos para análise da locação (LGPD). Use quando ele aceitar.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    name: 'escalar_para_humano',
    description:
      'Transfere a conversa para um atendente humano quando o pedido está fora do escopo (seguro, multa, acidente, cobrança, reclamação) ou você não conseguiu resolver. Após chamar, avise o cliente que um atendente vai continuar.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        motivo: { type: 'string', description: 'Motivo interno da transferência' },
      },
      required: ['motivo'],
    },
  },
];

// ---- Helpers de formatação para as respostas das ferramentas ----
const brl = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

/** Resultado de sucesso (texto que volta para a IA). */
function ok(data) {
  return { text: JSON.stringify(data), isError: false };
}
/** Resultado de erro amigável. */
function fail(mensagem) {
  return { text: JSON.stringify({ erro: mensagem }), isError: true };
}

/**
 * Executa uma ferramenta pelo nome.
 * @param {string} name
 * @param {object} input
 * @param {{tenant:object, customer:object, conversation:object}} ctx
 * @returns {Promise<{text:string, isError:boolean}>}
 */
export async function executeTool(name, input, ctx) {
  const { tenant, customer, conversation } = ctx;

  try {
    switch (name) {
      case 'consultar_disponibilidade': {
        const veiculos = await reservationService.listAvailable(tenant, {
          pickupAt: input.pickupAt,
          returnAt: input.returnAt,
          category: input.category ?? undefined,
        });
        if (veiculos.length === 0) {
          return ok({ disponiveis: [], mensagem: 'Nenhum veículo disponível nesse período.' });
        }
        return ok({
          disponiveis: veiculos.map((v) => ({
            id: v.id,
            modelo: v.model,
            categoria: v.category,
            diaria: brl(v.daily_rate),
            caucao: brl(v.deposit_amount),
            diarias: v.days,
            total_estimado: brl(v.total_estimado),
          })),
        });
      }

      case 'criar_pre_reserva': {
        const r = await reservationService.createPreReservation(tenant, {
          vehicleId: input.vehicleId,
          customerId: customer.id,
          pickupAt: input.pickupAt,
          returnAt: input.returnAt,
        });
        return ok({
          reserva_id: r.id,
          status: 'pré-reserva (sujeita a análise)',
          diarias: r.days_count,
          total: brl(r.total_amount),
          caucao: brl(r.deposit_snapshot),
          expira_em: r.expires_at,
          aviso: 'É uma pré-reserva; a confirmação depende da análise dos documentos pelo dono.',
        });
      }

      case 'remarcar_reserva': {
        const r = await reservationService.reschedule(
          tenant,
          input.reservationId,
          { pickupAt: input.pickupAt, returnAt: input.returnAt },
          { byOwner: false }
        );
        return ok({ reserva_id: r.id, novas_diarias: r.days_count, novo_total: brl(r.total_amount) });
      }

      case 'cancelar_reserva': {
        const r = await reservationService.cancel(tenant, input.reservationId, { byOwner: false });
        return ok({ reserva_id: r.id, status: 'cancelada' });
      }

      case 'consultar_minhas_reservas': {
        const reservas = await reservationRepo.listByCustomer(tenant.id, customer.id);
        return ok({
          reservas: reservas.map((r) => ({
            id: r.id,
            veiculo: r.vehicle_model,
            retirada: r.pickup_at,
            devolucao: r.return_at,
            status: r.status,
            total: brl(r.total_amount),
          })),
        });
      }

      case 'atualizar_dados_cliente': {
        const campos = {};
        if (input.name) campos.name = input.name;
        if (input.cpf) campos.cpf = input.cpf.replace(/\D/g, '');
        if (input.cnh_number) campos.cnh_number = input.cnh_number;
        if (input.cnh_valid_until) campos.cnh_valid_until = input.cnh_valid_until;
        // Endereço (entra no contrato). Guardamos CEP e UF já normalizados.
        if (input.zip_code) campos.zip_code = input.zip_code.replace(/\D/g, '').slice(0, 8);
        if (input.street) campos.street = input.street;
        if (input.street_number) campos.street_number = input.street_number;
        if (input.complement) campos.complement = input.complement;
        if (input.district) campos.district = input.district;
        if (input.city) campos.city = input.city;
        if (input.state) campos.state = input.state.toUpperCase().slice(0, 2);
        await updateCustomer(tenant.id, customer.id, campos);
        return ok({ atualizado: true });
      }

      case 'registrar_consentimento_lgpd': {
        await registerLgpdConsent(tenant.id, customer.id);
        // Move a pré-reserva para "aguardando_documentos".
        await reservationService.markAwaitingDocuments(tenant, customer.id);
        return ok({ consentimento_registrado: true });
      }

      case 'escalar_para_humano': {
        await setNeedsHuman(tenant.id, conversation.id, true, input.motivo);
        console.log(`🔔 [${tenant.name}] Conversa ${conversation.phone} precisa de humano: ${input.motivo}`);
        // Avisa o dono no WhatsApp (best-effort; não bloqueia a resposta).
        notifyOwnerNeedsHuman(tenant, { conversation, customer, motivo: input.motivo }).catch(() => {});
        return ok({ transferido: true });
      }

      default:
        return fail(`Ferramenta desconhecida: ${name}`);
    }
  } catch (err) {
    // Erros de negócio (HttpError) viram mensagem amigável para a IA relatar.
    if (err instanceof HttpError) {
      return fail(err.message);
    }
    console.error(`Erro na ferramenta ${name}:`, err);
    return fail('Não foi possível concluir a operação agora.');
  }
}
