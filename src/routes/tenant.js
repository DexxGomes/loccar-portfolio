// ============================================================================
//  Configurações da locadora (o próprio tenant).
//  Base: /api/tenant
//  GET   -> dados de configuração (NUNCA expõe token/segredos)
//  PATCH -> atualiza dados legais, termos do contrato, telefone de aviso, etc.
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { updateTenant, findTenantById } from '../repositories/tenantRepository.js';

export const tenantRouter = Router();

/** Devolve só os campos seguros do tenant (sem whatsapp_token etc.). */
function safeTenant(t) {
  return {
    id: t.id,
    name: t.name,
    legal_name: t.legal_name ?? null,
    cnpj: t.cnpj ?? null,
    address: t.address ?? null,
    contract_terms: t.contract_terms ?? null,
    owner_alert_phone: t.owner_alert_phone ?? null,
    display_phone_number: t.display_phone_number ?? null,
    timezone: t.timezone,
    subscription_status: t.subscription_status,
    shared_number: t.shared_number ?? false,
  };
}

const settingsSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome não pode ficar vazio'),
    legal_name: z.string().trim(),
    cnpj: z.string().trim(),
    address: z.string().trim(),
    contract_terms: z.string(),
    owner_alert_phone: z.string().trim(),
    // Liga a triagem por palavras: o WhatsApp da locadora é o mesmo da vida
    // pessoal do dono, então nem toda mensagem que chega é de cliente.
    shared_number: z.boolean(),
  })
  .partial();

tenantRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(safeTenant(req.tenant));
  })
);

tenantRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const data = settingsSchema.parse(req.body);
    // Telefone de aviso: guarda só dígitos (E.164 sem "+").
    if (data.owner_alert_phone !== undefined) {
      data.owner_alert_phone = String(data.owner_alert_phone).replace(/\D/g, '') || null;
    }
    await updateTenant(req.tenant.id, data);
    const atualizado = await findTenantById(req.tenant.id);
    res.json(safeTenant(atualizado));
  })
);
