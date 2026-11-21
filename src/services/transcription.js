// ============================================================================
//  Transcrição de áudio (mensagens de voz do WhatsApp).
//
//  O Claude não transcreve áudio, então usamos um serviço compatível com a
//  API "Whisper" da OpenAI (a própria OpenAI, ou Groq — mais barato e rápido).
//  É OPCIONAL: sem TRANSCRIPTION_API_KEY, o inbound pede ao cliente que escreva.
//
//  Config (.env):
//    TRANSCRIPTION_API_KEY   chave do provedor
//    TRANSCRIPTION_BASE_URL  padrão https://api.openai.com/v1
//                            (Groq: https://api.groq.com/openai/v1)
//    TRANSCRIPTION_MODEL     padrão whisper-1  (Groq: whisper-large-v3)
// ============================================================================
import { env } from '../config/env.js';

// Extensão do arquivo a partir do mime (o Whisper detecta o formato pelo nome).
const EXT = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

/** Diz se a transcrição está configurada. */
export function isTranscriptionEnabled() {
  return !!env.TRANSCRIPTION_API_KEY;
}

/**
 * Transcreve um áudio (buffer) para texto em português.
 * @param {Buffer} buffer
 * @param {string} mimeType  ex: "audio/ogg; codecs=opus"
 * @returns {Promise<string>} o texto reconhecido (pode ser vazio)
 */
export async function transcribeAudio(buffer, mimeType) {
  if (!isTranscriptionEnabled()) {
    throw new Error('Transcrição não configurada (TRANSCRIPTION_API_KEY ausente).');
  }
  const base = env.TRANSCRIPTION_BASE_URL.replace(/\/+$/, '');
  const tipo = (mimeType || 'audio/ogg').split(';')[0].trim();
  const ext = EXT[tipo] || 'ogg';

  // FormData/Blob/fetch são globais no Node 18+.
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: tipo }), `audio.${ext}`);
  form.append('model', env.TRANSCRIPTION_MODEL);
  form.append('language', 'pt');

  const resp = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TRANSCRIPTION_API_KEY}` },
    body: form,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Transcrição falhou (${resp.status}): ${txt.slice(0, 200)}`);
  }
  const data = await resp.json().catch(() => ({}));
  return (data.text || '').trim();
}
