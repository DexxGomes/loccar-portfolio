-- ============================================================================
--  011 — RETENÇÃO DE DOCUMENTOS
--
--  Motivo: CNH, selfie e comprovante de residência são os dados mais sensíveis
--  que o sistema guarda. Documento que não existe mais não vaza. Depois que a
--  locação terminou e o prazo de guarda passou, o ARQUIVO sai do bucket e o
--  registro fica como prova de que ele um dia foi entregue e depois apagado.
--
--  Por isso storage_path passa a aceitar NULL: NULL = "o arquivo já foi
--  descartado", e não "nunca existiu" (para isso serve purged_at).
-- ============================================================================

ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;

COMMENT ON COLUMN documents.storage_path IS
  'Caminho no bucket privado do Supabase; acesso apenas via URL assinada temporária. NULL quando o arquivo já foi descartado pela política de retenção (ver purged_at).';
COMMENT ON COLUMN documents.purged_at IS
  'Quando o arquivo foi apagado do storage pela política de retenção. O registro permanece como comprovação de entrega.';

-- Só interessa varrer o que ainda tem arquivo guardado.
CREATE INDEX IF NOT EXISTS idx_documents_a_descartar
  ON documents(reservation_id)
  WHERE storage_path IS NOT NULL;
