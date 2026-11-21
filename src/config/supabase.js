// ============================================================================
//  Client do Supabase (usado para o Storage privado de documentos).
//  Só é inicializado se SUPABASE_URL e SUPABASE_KEY estiverem no .env.
//  Será efetivamente usado a partir da etapa de documentos (2e).
//
//  IMPORTANTE: use sempre a SERVICE ROLE KEY apenas no backend.
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabase =
  env.SUPABASE_URL && env.SUPABASE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
        auth: { persistSession: false },
      })
    : null;

/**
 * Garante que o Supabase está configurado antes de usá-lo.
 * Lança um erro claro caso as variáveis não estejam preenchidas.
 */
export function getSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_KEY no .env.'
    );
  }
  return supabase;
}
