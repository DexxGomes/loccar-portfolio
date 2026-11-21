// ============================================================================
//  Envolve handlers assíncronos do Express para que erros lançados em Promises
//  sejam encaminhados ao errorHandler (sem precisar de try/catch em cada rota).
// ============================================================================
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
