-- MIGRACIÓN 004 — Agregar teléfono a operarios
-- Ejecutar en: Supabase > SQL Editor

ALTER TABLE operarios ADD COLUMN IF NOT EXISTS telefono text;
