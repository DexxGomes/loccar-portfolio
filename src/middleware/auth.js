// ============================================================================
//  Autenticação das rotas do painel.
//  Aceita o token JWT (Authorization: Bearer ...) e resolve o tenant a partir
//  dele. Em desenvolvimento, mantém o atalho pelo header x-tenant-id para
//  facilitar testes com curl (desativado em produção).
// ============================================================================
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { verifyToken } from '../services/authService.js';
import { findTenantById } from '../repositories/tenantRepository.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (token) {
      const payload = verifyToken(token);
      const tenant = await findTenantById(payload.tenantId);
      if (!tenant) throw new HttpError(401, 'Locadora não encontrada.');
      req.tenant = tenant;
      req.user = { id: payload.userId, role: payload.role, email: payload.email || null };
      return next();
    }

    // Atalho de desenvolvimento: aceita x-tenant-id no lugar do login. É um
    // BYPASS de autenticação, então só vale em NODE_ENV=development E com
    // ALLOW_DEV_TENANT_HEADER ligado explicitamente. Assim um deploy sem
    // NODE_ENV=production nunca fica aberto por acidente.
    if (env.NODE_ENV === 'development' && env.ALLOW_DEV_TENANT_HEADER) {
      const tenantId = req.get('x-tenant-id');
      if (tenantId) {
        const tenant = await findTenantById(tenantId);
        if (!tenant) throw new HttpError(404, 'Locadora (tenant) não encontrada.');
        req.tenant = tenant;
        req.user = { id: null, role: 'owner' };
        return next();
      }
    }

    throw new HttpError(401, 'Autenticação necessária.');
  } catch (err) {
    next(err);
  }
}
