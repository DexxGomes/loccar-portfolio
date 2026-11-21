// ============================================================================
//  Cliente da API da Anthropic (Claude).
//  Só é criado se ANTHROPIC_API_KEY estiver no .env.
// ============================================================================
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';

export const anthropic = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : null;

/** Indica se a IA está configurada. */
export function isAiEnabled() {
  return anthropic !== null;
}
