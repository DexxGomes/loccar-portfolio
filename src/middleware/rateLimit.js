// ============================================================================
//  Limitador de taxa (rate limit) — freia força bruta e abuso da API.
//
//  Implementação em memória (janela fixa por IP), sem dependência externa.
//  Suficiente para uma instância única. Num cluster/serverless com várias
//  instâncias, troque o store por algo compartilhado (Redis) — cada processo
//  aqui tem sua própria contagem.
// ============================================================================
import { HttpError } from '../utils/httpError.js';

/**
 * Cria um middleware de rate limit.
 * @param {object} opts
 * @param {number} opts.windowMs  tamanho da janela em ms
 * @param {number} opts.max       máximo de requisições por IP na janela
 * @param {string} [opts.message] mensagem do erro 429
 * @param {string} [opts.keyPrefix] separa contadores de limites diferentes
 */
export function rateLimit({ windowMs, max, message, keyPrefix = '' }) {
  const hits = new Map(); // key -> { count, reset }

  // Limpeza periódica para o Map não crescer sem limite. unref() evita que o
  // timer segure o processo vivo no encerramento.
  const timer = setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of hits) if (v.reset <= agora) hits.delete(k);
  }, windowMs);
  timer.unref?.();

  return function rateLimitMiddleware(req, res, next) {
    const agora = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
    const key = keyPrefix + ip;

    let reg = hits.get(key);
    if (!reg || reg.reset <= agora) {
      reg = { count: 0, reset: agora + windowMs };
      hits.set(key, reg);
    }
    reg.count += 1;

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - reg.count)));

    if (reg.count > max) {
      const retryAfter = Math.max(1, Math.ceil((reg.reset - agora) / 1000));
      res.set('Retry-After', String(retryAfter));
      return next(
        new HttpError(429, message || 'Muitas requisições. Aguarde um momento e tente de novo.')
      );
    }
    next();
  };
}
