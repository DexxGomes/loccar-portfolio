// ============================================================================
//  Rotas de autenticação do painel.
//  Base: /api/auth
// ============================================================================
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { login, changePassword } from '../services/authService.js';

export const authRouter = Router();

// POST /api/auth/login  { email, senha } -> { token, user, tenant }
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { identificador, email, senha } = req.body;
    const resultado = await login(identificador || email, senha);
    res.json(resultado);
  })
);

// POST /api/auth/change-password  { senhaAtual, novaSenha }  (exige login)
authRouter.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    await changePassword(req.user?.id, req.body.senhaAtual, req.body.novaSenha);
    res.json({ ok: true });
  })
);
