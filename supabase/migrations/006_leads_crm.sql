-- MIGRACIÓN 006 — CRM de Leads
-- Ejecutar en: Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS leads (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fuente          text NOT NULL DEFAULT 'manual'
                  CHECK (fuente IN ('whatsapp', 'instagram', 'web', 'manual', 'manychat')),
  nombre          text NOT NULL,
  telefono        text,
  barrio          text,
  producto        text DEFAULT 'Zapatero Slim',
  color           text,
  cantidad        integer DEFAULT 1,
  metodo_pago     text,
  estado          text NOT NULL DEFAULT 'nuevo'
                  CHECK (estado IN ('nuevo', 'contactado', 'interesado', 'presupuestado', 'cerrado', 'perdido')),
  notas           text,
  convertido      boolean DEFAULT false,
  ot_id           text REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_estado    ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_fuente    ON leads(fuente);
CREATE INDEX IF NOT EXISTS idx_leads_created   ON leads(created_at DESC);

-- RLS: solo lectura pública (el webhook usa service key o anon key con política)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_public" ON leads FOR SELECT USING (true);
CREATE POLICY "insert_public" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "update_public" ON leads FOR UPDATE USING (true);
