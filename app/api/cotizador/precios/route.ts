import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
)

// GET /api/cotizador/precios?tipo_mueble=Placard
// Retorna los precios para un tipo de mueble (o todos si no se especifica)
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo_mueble')

  let query = supabase.from('precios_medida').select('*').eq('activo', true)
  if (tipo) query = query.eq('tipo_mueble', tipo)

  const { data, error } = await query.order('tipo_mueble')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ precios: data }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}

// POST /api/cotizador/calcular
// Body: { tipo_mueble, m2, requiere_instalacion }
// Retorna el desglose de precio calculado
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tipo_mueble, m2, requiere_instalacion } = body

  if (!tipo_mueble || !m2) {
    return NextResponse.json({ error: 'tipo_mueble y m2 son requeridos' }, { status: 400 })
  }

  const { data: precio, error } = await supabase
    .from('precios_medida')
    .select('*')
    .eq('tipo_mueble', tipo_mueble)
    .eq('activo', true)
    .single()

  if (error || !precio) {
    return NextResponse.json({ error: 'No se encontraron precios para este tipo de mueble' }, { status: 404 })
  }

  const precio_materiales = precio.precio_m2_materiales * m2
  const precio_mano_obra  = precio.precio_m2_mano_obra * m2
  const precio_instalacion = requiere_instalacion
    ? precio.precio_instalacion_base + (precio.precio_instalacion_m2 * m2)
    : 0
  const precio_estimado = precio_materiales + precio_mano_obra + precio_instalacion

  return NextResponse.json({
    tipo_mueble,
    m2,
    precio_m2_materiales:  precio.precio_m2_materiales,
    precio_m2_mano_obra:   precio.precio_m2_mano_obra,
    precio_materiales,
    precio_mano_obra,
    precio_instalacion,
    precio_estimado,
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}
