// ============================================================================
//  Rotas REST de clientes (painel do dono).
//  Base: /api/customers
//  Inclui a exclusão de dados do cliente (LGPD - direito ao esquecimento).
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  findCustomerById,
  listCustomers,
  updateCustomer,
} from '../repositories/customerRepository.js';
import { listByCustomer } from '../repositories/reservationRepository.js';
import { isBlocked } from '../repositories/blocklistRepository.js';
import { deleteCustomerData } from '../services/lgpdService.js';

export const customersRouter = Router();

// Campo de texto opcional: aceita vazio e guarda NULL (não deixa "" no banco).
const texto = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const edicaoSchema = z.object({
  name: texto(120),
  cpf: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || v.length === 11, 'CPF deve ter 11 dígitos.')
    .transform((v) => v || null)
    .nullable()
    .optional(),
  cnh_number: texto(30),
  cnh_valid_until: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data deve ser AAAA-MM-DD.')
    .transform((v) => v || null)
    .nullable()
    .optional(),

  // Endereço (vai no contrato)
  zip_code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || v.length === 8, 'CEP deve ter 8 dígitos.')
    .transform((v) => v || null)
    .nullable()
    .optional(),
  street: texto(160),
  street_number: texto(20),
  complement: texto(60),
  district: texto(80),
  city: texto(80),
  state: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === '' || /^[A-Z]{2}$/.test(v), 'UF deve ter 2 letras.')
    .transform((v) => v || null)
    .nullable()
    .optional(),
});

// GET /api/customers?search=...  -> lista de clientes (com resumo)
customersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const clientes = await listCustomers(req.tenant.id, { search: req.query.search });
    res.json(clientes);
  })
);

// GET /api/customers/:id  -> detalhe do cliente (+ se está na blocklist)
customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await findCustomerById(req.tenant.id, req.params.id);
    if (!customer) throw new HttpError(404, 'Cliente não encontrado.');

    const bloqueio = await isBlocked(req.tenant.id, {
      phone: customer.phone,
      cpf: customer.cpf,
    });

    res.json({ ...customer, blocklist: bloqueio || null });
  })
);

// PATCH /api/customers/:id  -> edita dados do cliente (inclui o endereço que
// entra no contrato). Só mexe nos campos enviados.
customersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existente = await findCustomerById(req.tenant.id, req.params.id);
    if (!existente) throw new HttpError(404, 'Cliente não encontrado.');

    const parsed = edicaoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || 'Dados inválidos.');
    }

    const atualizado = await updateCustomer(req.tenant.id, req.params.id, parsed.data);
    res.json(atualizado);
  })
);

// GET /api/customers/:id/reservations  -> reservas do cliente
customersRouter.get(
  '/:id/reservations',
  asyncHandler(async (req, res) => {
    const reservas = await listByCustomer(req.tenant.id, req.params.id, 50);
    res.json(reservas);
  })
);

// DELETE /api/customers/:id/data  -> LGPD: apaga todos os dados do cliente
customersRouter.delete(
  '/:id/data',
  asyncHandler(async (req, res) => {
    const resultado = await deleteCustomerData(req.tenant, req.params.id);
    res.json({ ok: true, ...resultado });
  })
);
