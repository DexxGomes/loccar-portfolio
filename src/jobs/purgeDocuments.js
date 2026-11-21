// ============================================================================
//  RETENÇÃO DE DOCUMENTOS — apaga o que não precisa mais existir
//
//  A ideia é simples e é a defesa mais forte que existe contra vazamento:
//  documento que já foi descartado não pode ser roubado. CNH, selfie e
//  comprovante de residência ficam guardados enquanto a locação está viva e
//  por mais um prazo de segurança depois que ela acaba (para multa que chega
//  atrasada, contestação, etc.). Passado o prazo, o ARQUIVO sai do bucket.
//
//  O REGISTRO fica: continua dando para provar que o cliente entregou a CNH e
//  em que dia o arquivo foi descartado. Some a imagem, não a prova.
//
//  Vem DESLIGADO (DOCUMENT_RETENTION_DAYS=0). Apagar documento de verdade é
//  decisão do dono da locadora, não padrão silencioso do sistema.
// ============================================================================
import { env } from '../config/env.js';
import {
  listDocumentsToPurge,
  markDocumentPurged,
} from '../repositories/documentRepository.js';
import { removeFile } from '../services/storage.js';

export async function runPurgeDocuments() {
  const dias = env.DOCUMENT_RETENTION_DAYS;
  if (!dias || dias <= 0) return { desligado: true, apagados: 0 };

  let apagados = 0;
  let falhas = 0;

  try {
    const vencidos = await listDocumentsToPurge(dias);
    if (vencidos.length === 0) return { apagados: 0, falhas: 0 };

    for (const doc of vencidos) {
      try {
        await removeFile(doc.storage_path);
        // Só marca depois que o arquivo saiu de verdade. Se marcasse antes e o
        // storage falhasse, o arquivo ficaria órfão no bucket para sempre —
        // invisível para o sistema e ainda assim vazável.
        await markDocumentPurged(doc.id);
        apagados += 1;
      } catch (err) {
        falhas += 1;
        // Sem o caminho no log: ele identifica o cliente dentro do bucket.
        console.error('Retenção: falha ao descartar documento', doc.id, err.message);
      }
    }

    console.log(
      `🧹 Retenção de documentos: ${apagados} arquivo(s) descartado(s) após ${dias} dias` +
        (falhas ? `, ${falhas} falha(s).` : '.')
    );
  } catch (err) {
    console.error('Retenção de documentos falhou:', err.message);
  }

  return { apagados, falhas };
}
