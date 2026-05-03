import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseKey)

// ESTÁNDAR
export type EstadoOT = 'Pendiente' | 'En producción' | 'Pausado' | 'Listo' | 'Entregado'

// A MEDIDA
export type EstadoMedida = 'Consulta' | 'Relevamiento' | 'Diseño' | 'Corrección' | 'Aprobado' | 'Producción' | 'Instalación' | 'Entregado'

export interface OrdenTrabajo {
  id: string
  tipo: 'standard' | 'medida'
  cliente: string
  telefono: string
  codigo_producto?: string
  producto: string
  color?: string
  cantidad: number
  estado: string
  etapa_actual: number
  fecha_ingreso: string
  fecha_entrega_comprometida: string
  fecha_entrega_real?: string
  origen: string
  precio: number
  observaciones?: string
  // campos a medida
  codigo_proyecto?: string
  responsable_comercial?: string
  responsable_relevamiento?: string
  responsable_diseno?: string
  requiere_instalacion?: boolean
  created_at: string
  updated_at: string
}

export interface Relevamiento {
  id: string
  ot_id: string
  fecha: string
  realizado_por: string
  realizado_por_cliente: boolean
  cliente: string
  telefono: string
  direccion: string
  tipo_mueble: string
  descripcion: string
  ancho_cm: number
  alto_cm: number
  profundidad_cm: number
  ancho_abertura_cm: number
  material_pared: string
  estado_pared: string
  piso_irregular: boolean
  techo_irregular: boolean
  notas_condiciones: string
  cantidad_cuerpos: number
  cantidad_puertas: number
  cantidad_cajones: number
  cantidad_estantes: number
  color_principal: string
  color_secundario: string
  manijas: boolean
  iluminacion: boolean
  requiere_instalacion: boolean
  dificultad_acceso: string
  notas_instalacion: string
  m2_calculado: number
  precio_m2: number
  precio_estimado: number
  aprobado_dante: boolean
  notas_presupuesto: string
  foto_general?: string
  foto_medidas?: string
  foto_detalle?: string
  created_at: string
}

export interface Alerta {
  id: string
  tipo: 'danger' | 'warning' | 'info'
  mensaje: string
  ot_id?: string
  resuelta: boolean
  created_at: string
}

export interface Configuracion {
  id: string
  clave: string
  valor: string
  descripcion: string
}

// Etapas por tipo
export const ETAPAS_STANDARD: Record<string, string[]> = {
  '01': ['Corte', 'Tapacanto', 'Armado', 'Control calidad'],
  '02': ['Corte', 'CNC', 'Tapacanto', 'Armado', 'Control calidad'],
  '03': ['Corte', 'CNC', 'Tapacanto', 'Armado', 'Control calidad'],
  '04': ['Corte', 'Tapacanto', 'Armado', 'Control calidad'],
}

export const ESTADOS_MEDIDA: EstadoMedida[] = [
  'Consulta', 'Relevamiento', 'Diseño', 'Corrección', 'Aprobado', 'Producción', 'Instalación', 'Entregado'
]

export const ESTADO_COLOR_STANDARD: Record<string, string> = {
  'Pendiente':     'bg-zinc-800 text-zinc-400 border border-zinc-700',
  'En producción': 'bg-blue-950 text-blue-300 border border-blue-800',
  'Pausado':       'bg-amber-950 text-amber-300 border border-amber-800',
  'Listo':         'bg-stone-800 text-[#C9B99A] border border-stone-600',
  'Entregado':     'bg-emerald-950 text-emerald-300 border border-emerald-800',
}

export const ESTADO_COLOR_MEDIDA: Record<string, string> = {
  'Consulta':      'bg-zinc-800 text-zinc-400 border border-zinc-700',
  'Relevamiento':  'bg-purple-950 text-purple-300 border border-purple-800',
  'Diseño':        'bg-indigo-950 text-indigo-300 border border-indigo-800',
  'Corrección':    'bg-orange-950 text-orange-300 border border-orange-800',
  'Aprobado':      'bg-teal-950 text-teal-300 border border-teal-800',
  'Producción':    'bg-blue-950 text-blue-300 border border-blue-800',
  'Instalación':   'bg-amber-950 text-amber-300 border border-amber-800',
  'Entregado':     'bg-emerald-950 text-emerald-300 border border-emerald-800',
}

export function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fmtFecha(iso: string) {
  return iso?.split('-').reverse().join('/')
}
