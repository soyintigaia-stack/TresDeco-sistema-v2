import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const nombre = body.nombre
      ?? (body.first_name ? `${body.first_name ?? ''} ${body.last_name ?? ''}`.trim() : null)
      ?? body.name
      ?? 'Sin nombre'

    const lead = {
      // Datos del contacto
      fuente:            body.fuente ?? body.source ?? 'manychat',
      canal:             body.canal ?? 'instagram',
      nombre:            nombre || 'Sin nombre',
      telefono:          body.telefono ?? body.phone ?? null,

      // Producto e interés
      producto:          body.interes_producto ?? body.producto ?? null,
      color:             body.color ?? null,
      cantidad:          parseInt(body.cantidad ?? '1') || 1,
      medida_colchon:    body.medida_colchon ?? null,
      necesidad_cliente: body.necesidad_cliente ?? null,

      // Clasificación
      estado:            body.estado_lead ?? body.estado ?? 'nuevo',
      tipo_cliente:      body.tipo_cliente ?? null,
      lead_caliente:     body.lead_caliente === 'SI' || body.lead_caliente === true || false,
      lead_premium:      body.lead_premium === 'SI' || body.lead_premium === true || false,

      // Logística
      zona:              body.zona ?? body.barrio ?? null,
      disponibilidad:    body.disponibilidad ?? null,
      tipo_avance:       body.tipo_avance ?? null,
      metodo_pago:       body.metodo_pago ?? null,
      interaccion:       parseInt(body.interaccion ?? '0') || 0,

      // Extra
      notas:             body.notas ?? null,
      updated_at:        new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('leads')
      .upsert(lead, { onConflict: 'telefono', ignoreDuplicates: false })
      .select()
      .single()

    if (error) {
      console.error('Error guardando lead:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })

  } catch (e) {
    console.error('Error en /api/leads:', e)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'TresDeco CRM — leads webhook activo v2.0' })
}
