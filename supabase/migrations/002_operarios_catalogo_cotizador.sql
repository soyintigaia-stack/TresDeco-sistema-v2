-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 002 — TresDeco Sistema v2.1
-- Operarios, Catálogo Standard, Despieces, Precios A Medida
-- Ejecutar en: Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────
-- 1. OPERARIOS — Personal del taller
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operarios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  area        text NOT NULL DEFAULT 'ambos'
              CHECK (area IN ('standard', 'medida', 'ambos', 'diseño', 'instalacion')),
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Operarios reales de TresDeco (fuente: control de calidad abril 2026)
-- Dante puede editar/agregar desde Administración > Operarios
INSERT INTO operarios (nombre, area) VALUES
  ('Claudio',        'ambos'),
  ('Facundo Avila',  'ambos'),
  ('Matias Argota',  'ambos'),
  ('Josefina Toci',  'ambos'),
  ('Joaquin Sivori', 'ambos')
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────
-- 2. ETAPA_REGISTRO — Quién ejecutó cada etapa
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etapa_registro (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ot_id            text REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  etapa            text NOT NULL,
  operario_id      uuid REFERENCES operarios(id),
  operario_nombre  text NOT NULL,   -- desnormalizado para consultas rápidas
  fecha            date DEFAULT CURRENT_DATE,
  notas            text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etapa_registro_ot     ON etapa_registro(ot_id);
CREATE INDEX IF NOT EXISTS idx_etapa_registro_op     ON etapa_registro(operario_id);
CREATE INDEX IF NOT EXISTS idx_etapa_registro_fecha  ON etapa_registro(fecha);


-- ─────────────────────────────────────────────
-- 3. PRODUCTOS_CATALOGO — Catálogo standard
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos_catalogo (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo           text UNIQUE NOT NULL,   -- '01', '02', etc.
  nombre           text NOT NULL,
  categoria        text NOT NULL DEFAULT 'General',
  descripcion      text DEFAULT '',
  precio_base      numeric(12,2) DEFAULT 0,
  dias_produccion  integer DEFAULT 5,
  foto_url         text,
  activo           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- Productos reales de TresDeco (datos de documentos internos)
INSERT INTO productos_catalogo (codigo, nombre, categoria, dias_produccion, precio_base) VALUES
  ('01', 'Zapatero Slim',                'Zapateros',   4, 0),
  ('02', 'Zapatero Slim 2 puertas',      'Zapateros',   5, 0),
  ('03', 'Camabox 140x190 6 cajones',    'Camas',       7, 0),
  ('04', 'Camabox 160x190 6 cajones',    'Camas',       7, 0),
  ('05', 'Rack TV con patas de caño',    'Living',      5, 0),
  ('06', 'Panel TV flotante',            'Living',      4, 0),
  ('07', 'Repisa flotante 120x20',       'Repisas',     2, 0),
  ('08', 'Repisa flotante 160x20',       'Repisas',     2, 0),
  ('09', 'Repisa flotante 176.5x20',     'Repisas',     2, 0)
ON CONFLICT (codigo) DO NOTHING;


-- ─────────────────────────────────────────────
-- 4. DESPIECES — Lista de materiales por producto
--    El operario la usa como checklist antes de comenzar
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS despieces (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id  uuid REFERENCES productos_catalogo(id) ON DELETE CASCADE,
  material     text NOT NULL,
  cantidad     numeric(10,3) NOT NULL,
  unidad       text NOT NULL CHECK (unidad IN ('m²', 'ml', 'unidad', 'kg', 'par', 'juego')),
  descripcion  text DEFAULT '',
  es_checklist boolean DEFAULT true,
  orden        integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_despieces_producto ON despieces(producto_id);

-- Despieces reales de TresDeco (basados en lista de precios y control de calidad)
-- ZAPATERO SLIM (código 01)
INSERT INTO despieces (producto_id, material, cantidad, unidad, descripcion, es_checklist, orden)
SELECT p.id, d.material, d.cantidad::numeric, d.unidad, d.descripcion, d.checklist::boolean, d.orden::integer
FROM productos_catalogo p,
  (VALUES
    ('1/2 Placa MDF 18mm FAPLAC',  1,    'm²',    'Laterales, base y tapa',       'true',  1),
    ('Canto Blanco 22mm',          3,    'ml',    'Cantos visibles',              'true',  2),
    ('Canto Textura 22mm',         0,    'ml',    'Si lleva textura',             'true',  3),
    ('Bisagras cazoleta 0/9/17',   4,    'unidad', 'Para puertas',               'true',  4),
    ('Imanes para cierre',         4,    'unidad', 'Cierre de puertas',           'true',  5),
    ('Tornillos MDF 3.5x40mm',     20,   'unidad', 'Armado general',             'true',  6),
    ('Patines ajustables 12mm',    4,    'unidad', 'Nivelación',                 'true',  7)
  ) AS d(material, cantidad, unidad, descripcion, checklist, orden)
WHERE p.codigo = '01';

-- CAMABOX 140x190 6 cajones (código 03)
INSERT INTO despieces (producto_id, material, cantidad, unidad, descripcion, es_checklist, orden)
SELECT p.id, d.material, d.cantidad::numeric, d.unidad, d.descripcion, d.checklist::boolean, d.orden::integer
FROM productos_catalogo p,
  (VALUES
    ('Placa MDF 18mm FAPLAC',      2.5,  'm²',    'Estructura y cajones',         'true',  1),
    ('1/2 Plus Blanco 3mm',        0.5,  'm²',    'Fondos de cajones',            'true',  2),
    ('Canto Blanco 22mm',          6,    'ml',    'Cantos visibles',              'true',  3),
    ('Guías telescópicas 40cm',    6,    'par',   'Para los 6 cajones',           'true',  4),
    ('Tornillos MDF 3.5x40mm',     40,   'unidad', 'Armado estructura',          'true',  5),
    ('Tornillos MDF 3.5x20mm',     20,   'unidad', 'Armado fondos',              'true',  6),
    ('Caño oval 1200mm',           1,    'unidad', 'Para colgar ropa (si aplica)','false', 7),
    ('Soporte lateral caño',       2,    'unidad', 'Si aplica',                  'false', 8)
  ) AS d(material, cantidad, unidad, descripcion, checklist, orden)
WHERE p.codigo = '03';

-- RACK TV CON PATAS DE CAÑO (código 05)
INSERT INTO despieces (producto_id, material, cantidad, unidad, descripcion, es_checklist, orden)
SELECT p.id, d.material, d.cantidad::numeric, d.unidad, d.descripcion, d.checklist::boolean, d.orden::integer
FROM productos_catalogo p,
  (VALUES
    ('1/2 Placa MDF 18mm FAPLAC',  0.8,  'm²',    'Tablero principal',            'true',  1),
    ('Canto Blanco 22mm',          2,    'ml',    'Cantos visibles',              'true',  2),
    ('Caño cuadrado 40x40mm',      1,    'unidad', 'Patas — longitud según diseño','true', 3),
    ('Tornillos autoperforantes',  8,    'unidad', 'Fijación patas a tablero',    'true',  4),
    ('Tapones para caño',          4,    'unidad', 'Terminación inferior patas',  'true',  5)
  ) AS d(material, cantidad, unidad, descripcion, checklist, orden)
WHERE p.codigo = '05';

-- REPISA FLOTANTE (código 07 — base, ajustar cantidad según medida)
INSERT INTO despieces (producto_id, material, cantidad, unidad, descripcion, es_checklist, orden)
SELECT p.id, d.material, d.cantidad::numeric, d.unidad, d.descripcion, d.checklist::boolean, d.orden::integer
FROM productos_catalogo p,
  (VALUES
    ('1/2 Placa MDF 18mm',         0.3,  'm²',    'Tablero repisa',               'true',  1),
    ('Canto Blanco 22mm',          1.5,  'ml',    'Canto frontal y laterales',    'true',  2),
    ('Escuadras de colgar',        2,    'unidad', 'Fijación a pared',            'true',  3),
    ('Tornillos/tacos pared',      4,    'unidad', 'Según material de pared',     'true',  4)
  ) AS d(material, cantidad, unidad, descripcion, checklist, orden)
WHERE p.codigo = '07';


-- ─────────────────────────────────────────────
-- 5. PRECIOS_MEDIDA — Cotizador A Medida
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS precios_medida (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_mueble               text NOT NULL UNIQUE,
  precio_m2_materiales      numeric(12,2) NOT NULL DEFAULT 0,
  precio_m2_mano_obra       numeric(12,2) NOT NULL DEFAULT 0,
  precio_instalacion_base   numeric(12,2) DEFAULT 0,
  precio_instalacion_m2     numeric(12,2) DEFAULT 0,
  descripcion               text DEFAULT '',
  activo                    boolean DEFAULT true,
  updated_at                timestamptz DEFAULT now()
);

-- Precios de referencia — actualizar desde Administración con valores reales
INSERT INTO precios_medida
  (tipo_mueble, precio_m2_materiales, precio_m2_mano_obra, precio_instalacion_base, precio_instalacion_m2)
VALUES
  ('Placard',             0, 0, 0, 0),
  ('Vestidor',            0, 0, 0, 0),
  ('Biblioteca',          0, 0, 0, 0),
  ('Rack TV',             0, 0, 0, 0),
  ('Mueble de cocina',    0, 0, 0, 0),
  ('Alacena',             0, 0, 0, 0),
  ('Zapatero',            0, 0, 0, 0),
  ('Mesa',                0, 0, 0, 0),
  ('Escritorio',          0, 0, 0, 0),
  ('Cama con cajones',    0, 0, 0, 0),
  ('Otro',                0, 0, 0, 0)
ON CONFLICT (tipo_mueble) DO NOTHING;


-- ─────────────────────────────────────────────
-- 6. ACTUALIZAR ordenes_trabajo — nuevos campos
-- ─────────────────────────────────────────────
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS precio_sena numeric(12,2) DEFAULT 0;

-- Actualizar tipo de estado para a-medida (ampliar si usa enum)
-- Si el campo "estado" es text, no hace falta migración de tipo.
-- Si usás un enum, ejecutar:
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Diseño y Despiece';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Presupuesto';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Esperando Seña';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Señado';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Corte';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Tapacanto';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Armado';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Control';
-- ALTER TYPE estado_medida ADD VALUE IF NOT EXISTS 'Listo';


-- ─────────────────────────────────────────────
-- 7. ACTUALIZAR relevamientos — campos cotizador
-- ─────────────────────────────────────────────
ALTER TABLE relevamientos
  ADD COLUMN IF NOT EXISTS precio_materiales     numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_mano_obra      numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_instalacion    numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_final          numeric(12,2),
  ADD COLUMN IF NOT EXISTS aprobado_admin        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS presupuesto_enviado   boolean DEFAULT false;

-- Renombrar campo si existe con nombre viejo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='relevamientos' AND column_name='aprobado_dante'
  ) THEN
    ALTER TABLE relevamientos RENAME COLUMN aprobado_dante TO aprobado_admin;
  END IF;
END $$;


-- ─────────────────────────────────────────────
-- 8. ÍNDICES ADICIONALES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ot_estado  ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_ot_tipo    ON ordenes_trabajo(tipo);
CREATE INDEX IF NOT EXISTS idx_ot_fecha   ON ordenes_trabajo(fecha_entrega_comprometida);


-- ═══════════════════════════════════════════════════════════════
-- FIN MIGRACIÓN 002
-- Verificar con:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
-- ═══════════════════════════════════════════════════════════════
