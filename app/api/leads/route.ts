import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usa service key para bypasear RLS en inserts desde webhook externo
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
)

// POST /api/leads
// Recibe datos de ManyChat u otros bots y guarda el lead
// ManyChat: Automation > HTTP Request > POST a esta URL
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ManyChat envía los campos en distintos formatos — normalizamos
    const nombre =
      body.nombre ?? body.first_name
        ? `${body.first_name ?? ''} ${body.last_name ?? ''}`.trim()
        : body.name ?? 'Sin nombre'

    const lead = {
      fuente:       body.fuente ?? body.source ?? 'manychat',
      nombre:       nombre || 'Sin nombre',
      telefono:     body.telefono ?? body.phone ?? body.whatsapp ?? null,
      barrio:       body.barrio ?? body.zona ?? null,
      producto:     body.producto ?? body.product ?? 'Zapatero Slim',
      color:        body.color ?? null,
      cantidad:     parseInt(body.cantidad ?? body.quantity ?? '1') || 1,
      metodo_pago:  body.metodo_pago ?? body.payment_method ?? null,
      estado:       'nuevo',
      notas:        body.notas ?? body.notes ?? null,
    }

    const { data, error } = await supabase.from('leads').insert(lead).select().single()

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

// GET /api/leads — health check para verificar que el endpoint funciona
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'TresDeco CRM — leads webhook activo' })
}
