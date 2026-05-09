-- MIGRACIÓN 005 — Precios reales en catálogo + seña + recargo color
-- Ejecutar en: Supabase > SQL Editor

-- Agregar columnas al catálogo
ALTER TABLE productos_catalogo
  ADD COLUMN IF NOT EXISTS precio_sena       numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recargo_color_pct numeric(5,2)  DEFAULT 0;

-- Zapatero Slim — precio confirmado del Informe Operativo Dante Carrizo (mayo 2026)
UPDATE productos_catalogo SET
  precio_base        = 165000,
  precio_sena        = 65000,
  recargo_color_pct  = 15
WHERE codigo = '01';

-- Zapatero Slim 2 puertas — seña y recargo estimados (confirmar con Dante)
UPDATE productos_catalogo SET
  precio_sena       = 65000,
  recargo_color_pct = 15
WHERE codigo = '02';
