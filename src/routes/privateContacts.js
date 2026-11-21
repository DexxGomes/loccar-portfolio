// ============================================================================
//  Contatos particulares — os números que o sistema nunca atende nem grava.
//  Base: /api/particulares
//
//  Quem usa: a locadora que atende no mesmo WhatsApp da vida pessoal. Cadastra
//  a família aqui uma vez e pronto.
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  listPrivateContacts,
  addPrivateContact,
  removePrivateContact,
} from '../repositories/privateContactRepository.js';

export const privateContactsRouter = Router();

const novoSchema = z.object({
  // Aceita como a pessoa digita — (34) 99999-9999 — e guarda só os dígitos.
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 10, 'Telefone precisa ter DDD e número.'),
  label: z.string().trim().max(80).optional(),
});

privateContactsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listPrivateContacts(req.tenant.id));
  })
);

privateContactsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const dados = novoSchema.parse(req.body);
    const criado = await addPrivateContact(req.tenant.id, dados);
    res.status(201).json(criado);
  })
);

privateContactsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = await removePrivateContact(req.tenant.id, req.params.id);
    if (!ok) throw new HttpError(404, 'Contato não encontrado.');
    res.sendStatus(204);
  })
);
