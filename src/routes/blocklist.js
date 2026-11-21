// ============================================================================
//  Rotas REST da blocklist (painel).
//  Base: /api/blocklist
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  listBlocklist,
  addToBlocklist,
  removeFromBlocklist,
} from '../repositories/blocklistRepository.js';

export const blocklistRouter = Router();

const addSchema = z
  .object({
    cpf: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  })
  .refine((d) => d.cpf || d.phone, { message: 'Informe CPF ou telefone.' });

// GET /api/blocklist
blocklistRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listBlocklist(req.tenant.id));
  })
);

// POST /api/blocklist  { cpf?, phone?, reason? }
blocklistRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = addSchema.parse(req.body);
    const item = await addToBlocklist(req.tenant.id, {
      cpf: data.cpf ? data.cpf.replace(/\D/g, '') : null,
      phone: data.phone ?? null,
      reason: data.reason ?? null,
      createdBy: req.user?.id ?? null,
    });
    res.status(201).json(item);
  })
);

// DELETE /api/blocklist/:id
blocklistRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = await removeFromBlocklist(req.tenant.id, req.params.id);
    if (!ok) throw new HttpError(404, 'Item não encontrado.');
    res.status(204).send();
  })
);
