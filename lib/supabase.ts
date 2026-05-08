import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(
  supabaseUrl || 'https://example.invalid',
  supabaseKey || 'anon-key-missing'
)

// ─────────────────────────────────────────────
// TIPOS — ÓRDENES DE TRABAJO
// ─────────────────────────────────────────────

export type EstadoStandard = 'Pendiente' | 'En producción' | 'Pausado' | 'Listo' | 'Entregado'

// Pipeline completo A Medida (pre-venta + producción + post-producción)
export type EstadoMedida =
  | 'Consulta'           // Cliente solicita info/precio
  | 'Relevamiento'       // Visita al domicilio, toma de medidas
  | 'Diseño y Despiece'  // Diseño 3D + planos + lista de materiales
  | 'Presupuesto'        // Presupuesto enviado al cliente
  | 'Esperando Seña'     // Esperando que el cliente abone la seña
  | 'Señado'             // Seña abonada — VENTA CONFIRMADA, pasa a producción
  | 'Corte'              // Taller: corte de tableros
  | 'Tapacanto'          // Taller: aplicación de tapacanto
  | 'Armado'             // Taller: armado de cuerpos
  | 'Control'            // Taller: control de calidad
  | 'Listo'              // Listo para entrega / instalación
  | 'Instalación'        // Instalación en domicilio del cliente
  | 'Entregado'          // Proyecto finalizado

export interface OrdenTrabajo {
  id: string
  tipo: 'standard' | 'medida'
  cliente: string
  telefono: string
  codigo_producto?: string   // ej: '01', '02' — para standard
  producto: string
  color?: string
  cantidad: number
  estado: string
  etapa_actual: number       // índice dentro del pipeline de etapas
  fecha_ingreso: string
  fecha_entrega_comprometida: string
  fecha_entrega_real?: string
  origen: string             // 'Tienda Nube' | 'Manual' | 'Consulta Web' | 'WhatsApp'
  precio: number
  precio_sena?: number       // monto de la seña
  observaciones?: string
  // Campos exclusivos A Medida
  codigo_proyecto?: string   // ej: TR-2025-001
  requiere_instalacion?: boolean
  // Responsables por área (almacenados en etapa_registro)
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────
// TIPOS — RELEVAMIENTO / COTIZADOR
// ─────────────────────────────────────────────

export interface Relevamiento {
  id: string
  ot_id: string
  fecha: string
  realizado_por: string
  realizado_por_cliente: boolean
  // Datos del cliente
  cliente: string
  telefono: string
  direccion: string
  // Mueble
  tipo_mueble: string
  descripcion: string
  // Medidas
  ancho_cm: number
  alto_cm: number
  profundidad_cm: number
  ancho_abertura_cm: number
  // Condiciones
  material_pared: string
  estado_pared: string
  piso_irregular: boolean
  techo_irregular: boolean
  notas_condiciones: string
  // Configuración
  cantidad_cuerpos: number
  cantidad_puertas: number
  cantidad_cajones: number
  cantidad_estantes: number
  color_principal: string
  color_secundario: string
  manijas: boolean
  tipo_manija?: string
  iluminacion: boolean
  // Instalación
  requiere_instalacion: boolean
  dificultad_acceso: string
  notas_instalacion: string
  // Cotizador
  m2_calculado: number
  precio_m2: number
  precio_materiales: number
  precio_mano_obra: number
  precio_instalacion: number
  precio_estimado: number
  precio_final?: number      // precio aprobado por admin
  aprobado_admin: boolean
  notas_presupuesto: string
  presupuesto_enviado: boolean
  // Fotos
  foto_general?: string
  foto_medidas?: string
  foto_detalle?: string
  created_at: string
}

// ─────────────────────────────────────────────
// TIPOS — PERSONAL / OPERARIOS
// ─────────────────────────────────────────────

export interface Operario {
  id: string
  nombre: string
  area: 'standard' | 'medida' | 'ambos' | 'diseño' | 'instalacion'
  activo: boolean
  created_at: string
}

// Registro de quién ejecutó cada etapa (standard y a medida)
export interface EtapaRegistro {
  id: string
  ot_id: string
  etapa: string              // nombre de la etapa ejecutada
  operario_id: string
  operario_nombre: string    // desnormalizado para consultas rápidas
  fecha: string
  notas?: string
  created_at: string
}

// ─────────────────────────────────────────────
// TIPOS — CATÁLOGO STANDARD
// ─────────────────────────────────────────────

export interface ProductoCatalogo {
  id: string
  codigo: string             // '01', '02', etc.
  nombre: string             // 'Zapatero Simple', 'Placard 2 puertas'
  categoria: string          // 'Zapateros', 'Placares', 'Bibliotecas', etc.
  descripcion: string
  precio_base: number
  dias_produccion: number
  foto_url?: string
  activo: boolean
  created_at: string
}

// Línea del despiece / lista de materiales por producto
export interface Despiece {
  id: string
  producto_id: string
  material: string           // 'MDF 18mm', 'Tapacanto ABS 2mm'
  cantidad: number
  unidad: string             // 'm²', 'ml', 'unidad', 'kg'
  descripcion?: string
  es_checklist: boolean      // aparece en checklist del operario
  orden: number              // orden de verificación
}

// ─────────────────────────────────────────────
// TIPOS — COTIZADOR A MEDIDA
// ─────────────────────────────────────────────

export interface PrecioMedida {
  id: string
  tipo_mueble: string        // 'Placard', 'Vestidor', 'Biblioteca', etc.
  precio_m2_materiales: number
  precio_m2_mano_obra: number
  precio_instalacion_base: number  // precio fijo base de instalación
  precio_instalacion_m2: number    // adicional por m²
  descripcion?: string
  activo: boolean
  updated_at: string
}

// ─────────────────────────────────────────────
// TIPOS — ALERTAS Y ACTIVIDAD
// ─────────────────────────────────────────────

export interface Alerta {
  id: string
  tipo: 'danger' | 'warning' | 'info'
  mensaje: string
  ot_id?: string
  resuelta: boolean
  created_at: string
}

export interface Actividad {
  id: string
  ot_id: string
  descripcion: string
  usuario: string
  operario_id?: string
  created_at: string
}

export interface Configuracion {
  id: string
  clave: string
  valor: string
  descripcion: string
}

// ─────────────────────────────────────────────
// PIPELINES DE ETAPAS
// ─────────────────────────────────────────────

// Etapas para productos standard — indexadas por código de producto
// Usadas por etapa_actual (número) para trackear avance
export const ETAPAS_STANDARD: Record<string, string[]> = {
  'default': ['Corte', 'Tapacanto', 'Armado', 'Control'],
  '01':      ['Corte', 'Tapacanto', 'Armado', 'Control'],
  '02':      ['Corte', 'CNC', 'Tapacanto', 'Armado', 'Control'],
  '03':      ['Corte', 'CNC', 'Tapacanto', 'Armado', 'Control'],
  '04':      ['Corte', 'Tapacanto', 'Armado', 'Control'],
}

// Pipeline completo A Medida — orden del proceso
export const ESTADOS_MEDIDA: EstadoMedida[] = [
  'Consulta',
  'Relevamiento',
  'Diseño y Despiece',
  'Presupuesto',
  'Esperando Seña',
  'Señado',
  'Corte',
  'Tapacanto',
  'Armado',
  'Control',
  'Listo',
  'Instalación',
  'Entregado',
]

// Etapas que son de pre-venta (antes de confirmar la compra)
export const ETAPAS_PREVENTA: EstadoMedida[] = [
  'Consulta', 'Relevamiento', 'Diseño y Despiece', 'Presupuesto', 'Esperando Seña'
]

// Etapas de producción (post-seña)
export const ETAPAS_PRODUCCION: EstadoMedida[] = [
  'Señado', 'Corte', 'Tapacanto', 'Armado', 'Control', 'Listo', 'Instalación', 'Entregado'
]

// ─────────────────────────────────────────────
// COLORES DE ESTADO
// ─────────────────────────────────────────────

export const ESTADO_COLOR_STANDARD: Record<string, string> = {
  'Pendiente':     'bg-zinc-800 text-zinc-400 border border-zinc-700',
  'En producción': 'bg-blue-950 text-blue-300 border border-blue-800',
  'Pausado':       'bg-amber-950 text-amber-300 border border-amber-800',
  'Listo':         'bg-stone-800 text-[#C9B99A] border border-stone-600',
  'Entregado':     'bg-emerald-950 text-emerald-300 border border-emerald-800',
}

export const ESTADO_COLOR_MEDIDA: Record<string, string> = {
  // Pre-venta
  'Consulta':          'bg-zinc-800 text-zinc-400 border border-zinc-700',
  'Relevamiento':      'bg-purple-950 text-purple-300 border border-purple-800',
  'Diseño y Despiece': 'bg-indigo-950 text-indigo-300 border border-indigo-800',
  'Presupuesto':       'bg-sky-950 text-sky-300 border border-sky-800',
  'Esperando Seña':    'bg-orange-950 text-orange-300 border border-orange-800',
  // Venta confirmada y producción
  'Señado':            'bg-teal-950 text-teal-300 border border-teal-800',
  'Corte':             'bg-blue-950 text-blue-300 border border-blue-800',
  'Tapacanto':         'bg-blue-950 text-blue-200 border border-blue-700',
  'Armado':            'bg-violet-950 text-violet-300 border border-violet-800',
  'Control':           'bg-amber-950 text-amber-300 border border-amber-800',
  'Listo':             'bg-stone-800 text-[#C9B99A] border border-stone-600',
  'Instalación':       'bg-rose-950 text-rose-300 border border-rose-800',
  'Entregado':         'bg-emerald-950 text-emerald-300 border border-emerald-800',
}

// ─────────────────────────────────────────────
// TIPOS DE MUEBLE — para selects
// ─────────────────────────────────────────────

export const TIPOS_MUEBLE = [
  'Placard',
  'Vestidor',
  'Biblioteca',
  'Rack TV',
  'Mueble de cocina',
  'Alacena',
  'Zapatero',
  'Mesa',
  'Escritorio',
  'Cama con cajones',
  'Otro',
]

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

export function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function fmtFecha(iso: string) {
  return iso?.split('-').reverse().join('/')
}

export function fmtPeso(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function getEtapasParaOT(ot: OrdenTrabajo): string[] {
  if (ot.tipo === 'medida') return ESTADOS_MEDIDA
  const etapas = ETAPAS_STANDARD[ot.codigo_producto ?? ''] ?? ETAPAS_STANDARD['default']
  return etapas
}

export function isPreVenta(estado: string): boolean {
  return ETAPAS_PREVENTA.includes(estado as EstadoMedida)
}

export function isProduccion(estado: string): boolean {
  return ETAPAS_PRODUCCION.includes(estado as EstadoMedida)
}

export function diasHabilesRestantes(fechaEntrega: string): number {
  if (!fechaEntrega) return 0
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const entrega = new Date(fechaEntrega); entrega.setHours(0, 0, 0, 0)
  const signo = entrega >= hoy ? 1 : -1
  let dias = 0
  const cur = new Date(signo > 0 ? hoy : entrega)
  const fin = signo > 0 ? entrega : hoy
  while (cur <= fin) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) dias++
    cur.setDate(cur.getDate() + 1)
  }
  return signo * dias
}

export function addDiasHabiles(desde: Date, dias: number): Date {
  const r = new Date(desde); let count = 0
  while (count < dias) {
    r.setDate(r.getDate() + 1)
    if (r.getDay() !== 0 && r.getDay() !== 6) count++
  }
  return r
}

export const COLORES_DISPONIBLES = [
  'Blanco', 'Camellia', 'Gris Grafito', 'Tribal', 'Amaranto',
  'Negro', 'Natural', 'Otro',
]

export const ORIGENES_OT = [
  'Manual', 'WhatsApp', 'Instagram', 'Tienda Virtual', 'Consulta Web', 'Referido',
]
