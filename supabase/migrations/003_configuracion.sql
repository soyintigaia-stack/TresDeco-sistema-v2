-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 003 — TresDeco Sistema v2.1
-- Tabla configuracion — contador de proyectos a medida
-- Ejecutar en: Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS configuracion (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clave        text UNIQUE NOT NULL,
  valor        text NOT NULL DEFAULT '',
  descripcion  text DEFAULT ''
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('contador_proyectos', '0', 'Contador auto-incrementable para IDs de proyectos a medida (TR-YYYY-NNN)')
ON CONFLICT (clave) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- FIN MIGRACIÓN 003
-- ═══════════════════════════════════════════════════════════════
