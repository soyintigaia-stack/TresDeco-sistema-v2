import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseKey)

export type EstadoOT = 'Pendiente' | 'En producción' | 'Pausado' | 'Listo' | 'Entregado'

export interface OrdenTrabajo {
  id: string
  cliente: string
  telefono: string
  codigo_producto: string
  producto: string
  color: string
  cantidad: number
  estado: EstadoOT
  etapa_actual: number
  fecha_ingreso: string
  fecha_entrega_comprometida: string
  fecha_entrega_real?: string
  origen: 'WhatsApp' | 'Tienda Nube' | 'Manual'
  precio: number
  observaciones?: string
  created_at: string
  updated_at: string
}

export interface Alerta {
  id: string
  tipo: 'danger' | 'warning' | 'info'
  mensaje: string
  ot_id?: string
  resuelta: boolean
  created_at: string
}
