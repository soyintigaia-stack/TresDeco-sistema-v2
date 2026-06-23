-- MIGRACIÓN 007 — Conversaciones Bot WhatsApp
-- Ejecutar en: Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS conversaciones_bot (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telefono    text NOT NULL UNIQUE,
  nombre      text,
  mensajes    jsonb NOT NULL DEFAULT '[]',
  lead_id     uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_telefono ON conversaciones_bot(telefono);
CREATE INDEX IF NOT EXISTS idx_conv_updated  ON conversaciones_bot(updated_at DESC);

ALTER TABLE conversaciones_bot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_public" ON conversaciones_bot USING (true) WITH CHECK (true);

-- Actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversaciones_bot_updated_at
  BEFORE UPDATE ON conversaciones_bot
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Permite 'wati' como fuente en leads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_fuente_check;
ALTER TABLE leads ADD CONSTRAINT leads_fuente_check
  CHECK (fuente IN ('whatsapp', 'instagram', 'web', 'manual', 'manychat', 'wati'));
