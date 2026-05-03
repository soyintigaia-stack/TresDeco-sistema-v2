-- ============================================
-- TRESDECO SISTEMA v2.0 — SETUP SUPABASE
-- Pegar en SQL Editor y ejecutar
-- ============================================

-- PRODUCTOS ESTÁNDAR
CREATE TABLE IF NOT EXISTS productos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  categoria text,
  colores text[],
  precio numeric DEFAULT 0,
  unidades_dia integer DEFAULT 1,
  plazo integer DEFAULT 5,
  unidad_plazo text DEFAULT 'días hábiles',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ÓRDENES ESTÁNDAR (ya existente, actualizamos)
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id text PRIMARY KEY,
  tipo text DEFAULT 'standard', -- 'standard' | 'medida'
  cliente text NOT NULL,
  telefono text,
  codigo_producto text,
  producto text NOT NULL,
  color text,
  cantidad integer DEFAULT 1,
  estado text DEFAULT 'Pendiente',
  etapa_actual integer DEFAULT 0,
  fecha_ingreso date DEFAULT CURRENT_DATE,
  fecha_entrega_comprometida date,
  fecha_entrega_real date,
  origen text DEFAULT 'Manual',
  precio numeric DEFAULT 0,
  observaciones text,
  -- campos a medida
  codigo_proyecto text, -- TR-2026-001
  responsable_comercial text,
  responsable_relevamiento text,
  responsable_diseno text,
  fecha_ot date,
  requiere_instalacion boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RELEVAMIENTOS (muebles a medida)
CREATE TABLE IF NOT EXISTS relevamientos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ot_id text REFERENCES ordenes_trabajo(id),
  -- Datos generales
  fecha date DEFAULT CURRENT_DATE,
  realizado_por text DEFAULT 'Equipo TresDeco',
  realizado_por_cliente boolean DEFAULT false,
  -- Cliente y ubicación
  cliente text NOT NULL,
  telefono text,
  direccion text,
  -- Producto
  tipo_mueble text,
  descripcion text,
  -- Medidas del espacio
  ancho_cm numeric,
  alto_cm numeric,
  profundidad_cm numeric,
  ancho_abertura_cm numeric,
  -- Materiales y condiciones
  material_pared text,
  estado_pared text,
  piso_irregular boolean DEFAULT false,
  techo_irregular boolean DEFAULT false,
  notas_condiciones text,
  -- Configuración del mueble
  cantidad_cuerpos integer DEFAULT 1,
  cantidad_puertas integer DEFAULT 0,
  cantidad_cajones integer DEFAULT 0,
  cantidad_estantes integer DEFAULT 0,
  bisagras_tipo text,
  color_principal text,
  color_secundario text,
  manijas boolean DEFAULT false,
  tipo_manija text,
  iluminacion boolean DEFAULT false,
  -- Instalación
  requiere_instalacion boolean DEFAULT true,
  dificultad_acceso text,
  notas_instalacion text,
  -- Presupuesto calculado
  m2_calculado numeric,
  precio_m2 numeric DEFAULT 0,
  precio_estimado numeric DEFAULT 0,
  aprobado_dante boolean DEFAULT false,
  notas_presupuesto text,
  -- Fotos (URLs)
  foto_general text,
  foto_medidas text,
  foto_detalle text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ALERTAS
CREATE TABLE IF NOT EXISTS alertas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  mensaje text NOT NULL,
  ot_id text REFERENCES ordenes_trabajo(id),
  resuelta boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ACTIVIDAD / LOG
CREATE TABLE IF NOT EXISTS actividad (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ot_id text REFERENCES ordenes_trabajo(id),
  descripcion text NOT NULL,
  usuario text DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);

-- CONFIGURACIÓN DEL SISTEMA (precio m2, etc)
CREATE TABLE IF NOT EXISTS configuracion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clave text UNIQUE NOT NULL,
  valor text NOT NULL,
  descripcion text,
  updated_at timestamptz DEFAULT now()
);

-- POLÍTICAS RLS
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE relevamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acceso publico" ON ordenes_trabajo FOR ALL USING (true);
CREATE POLICY "acceso publico" ON relevamientos FOR ALL USING (true);
CREATE POLICY "acceso publico" ON alertas FOR ALL USING (true);
CREATE POLICY "acceso publico" ON actividad FOR ALL USING (true);
CREATE POLICY "acceso publico" ON productos FOR ALL USING (true);
CREATE POLICY "acceso publico" ON configuracion FOR ALL USING (true);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_trabajo;
ALTER PUBLICATION supabase_realtime ADD TABLE relevamientos;
ALTER PUBLICATION supabase_realtime ADD TABLE alertas;
ALTER PUBLICATION supabase_realtime ADD TABLE actividad;

-- DATOS INICIALES
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('precio_m2_melamina', '85000', 'Precio por m² de melamina trabajada en pesos'),
('precio_m2_mdf', '95000', 'Precio por m² de MDF trabajado en pesos'),
('margen_instalacion', '15', 'Porcentaje adicional por instalación'),
('contador_proyectos', '21', 'Último número de proyecto usado')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO productos (codigo, nombre, categoria, colores, precio, unidades_dia, plazo, unidad_plazo) VALUES
('01', 'Zapatero Slim',    'Ingreso',    ARRAY['Blanco','Arena'],              45000,  6,  5,  'días hábiles'),
('02', 'Camabox 1 plaza',  'Dormitorio', ARRAY['Blanco','Arena','Gris'],       120000, 4,  15, 'días corridos'),
('03', 'Camabox 2 plazas', 'Dormitorio', ARRAY['Blanco','Arena','Gris'],       160000, 2,  15, 'días corridos'),
('04', 'Repisa flotante',  'Estar',      ARRAY['Blanco','Negro','Madera'],     18000,  16, 72, 'horas')
ON CONFLICT (codigo) DO NOTHING;

-- DATOS DE DEMO — ESTÁNDAR
INSERT INTO ordenes_trabajo (id, tipo, cliente, telefono, codigo_producto, producto, color, cantidad, estado, etapa_actual, fecha_ingreso, fecha_entrega_comprometida, origen, precio) VALUES
('OT-031', 'standard', 'Familia Rodríguez', '351-555-0101', '03', 'Camabox 2 plazas', 'Blanco', 1, 'En producción', 3, '2026-04-20', '2026-05-05', 'WhatsApp', 160000),
('OT-032', 'standard', 'Martínez, Laura',   '351-555-0202', '01', 'Zapatero Slim',    'Arena',  1, 'En producción', 1, '2026-04-24', '2026-05-01', 'Tienda Nube', 45000),
('OT-033', 'standard', 'Soria, Daniela',    '351-555-0303', '02', 'Camabox 1 plaza',  'Gris',   1, 'Pausado',       2, '2026-04-22', '2026-05-07', 'WhatsApp', 120000, 'Falta melamina gris 18mm'),
('OT-034', 'standard', 'González, Pablo',   '351-555-0404', '04', 'Repisa flotante',  'Blanco', 3, 'Listo',         4, '2026-04-27', '2026-04-29', 'WhatsApp', 54000),
('OT-001', 'standard', 'Familia Gómez',     '351-555-0001', '03', 'Camabox 2 plazas', 'Blanco', 1, 'Entregado',     5, '2026-04-01', '2026-04-16', 'WhatsApp', 160000)
ON CONFLICT (id) DO NOTHING;

-- DATOS DE DEMO — A MEDIDA
INSERT INTO ordenes_trabajo (id, tipo, cliente, telefono, producto, estado, etapa_actual, fecha_ingreso, fecha_entrega_comprometida, origen, precio, codigo_proyecto, responsable_comercial, requiere_instalacion) VALUES
('TR-2026-022', 'medida', 'Fernández, María',  '351-555-1001', 'Vestidor a medida',      'Relevamiento', 0, '2026-04-25', '2026-05-20', 'WhatsApp', 0,      'TR-2026-022', 'Dante', true),
('TR-2026-021', 'medida', 'López, Sebastián',  '351-555-1002', 'Biblioteca empotrada',   'Diseño',       0, '2026-04-18', '2026-05-15', 'WhatsApp', 380000, 'TR-2026-021', 'Dante', false),
('TR-2026-020', 'medida', 'Romero, Claudia',   '351-555-1003', 'Cocina a medida',        'Aprobado',     0, '2026-04-10', '2026-05-30', 'WhatsApp', 850000, 'TR-2026-020', 'Dante', true),
('TR-2026-019', 'medida', 'García, Tomás',     '351-555-1004', 'Placard dormitorio',     'Producción',   2, '2026-04-05', '2026-05-10', 'WhatsApp', 420000, 'TR-2026-019', 'Dante', true),
('TR-2026-018', 'medida', 'Blanco, Valeria',   '351-555-1005', 'Mueble TV empotrado',    'Entregado',    0, '2026-03-15', '2026-04-20', 'WhatsApp', 290000, 'TR-2026-018', 'Dante', false)
ON CONFLICT (id) DO NOTHING;

-- ALERTAS DEMO
INSERT INTO alertas (tipo, mensaje, ot_id) VALUES
('warning', '⚠️ OT-033 pausada — Falta melamina gris 18mm. Soria espera respuesta.', 'OT-033'),
('info',    'OT-034 (González) lista para entrega — Repisa flotante x3.', 'OT-034'),
('warning', 'TR-2026-022 — Relevamiento de Fernández pendiente de realizar.', 'TR-2026-022'),
('info',    'TR-2026-020 — Cocina Romero aprobada. Lista para pasar a producción.', 'TR-2026-020')
ON CONFLICT DO NOTHING;
