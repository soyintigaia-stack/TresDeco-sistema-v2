import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
)

const WATI_URL  = process.env.WATI_API_URL  ?? 'https://live.wati.io/10188987'
const WATI_TOKEN = process.env.WATI_API_TOKEN ?? ''

// ─── Config del negocio (multi-cliente: en el futuro viene de DB) ─────────────
const BOT_CONFIG = {
  negocio: 'TresDeco Amoblamientos',
  ciudad: 'Córdoba, Argentina',
  productos: [
    {
      nombre: 'Zapatero Slim',
      precio_blanco: 165000,
      precio_color: 189750,
      seña: 65000,
      dias_entrega: 5,
      colores: ['Blanco', 'Camellia', 'Gris Grafito', 'Tribal', 'Amaranto', 'Negro', 'Natural'],
      descripcion: 'Zapatero moderno de melamina, capacidad para 12 pares, 6 unidades por día de producción',
    },
  ],
  cierre: 'La seña es de $65.000 y la hacemos por transferencia. Una vez confirmada, te damos fecha exacta de entrega.',
}

const SYSTEM_PROMPT = `Sos Valentina, asesora de ventas de ${BOT_CONFIG.negocio}, una fábrica de muebles de diseño de ${BOT_CONFIG.ciudad}.
Tu personalidad: cálida, profesional, conocés los productos al detalle y te apasiona ayudar a la gente a encontrar el mueble perfecto para su hogar.
Hablás de vos a vos, en tono cercano pero sin tutear de más. Usás el nombre del cliente cuando lo sabés.

TU OBJETIVO: acompañar al cliente desde el primer mensaje hasta que confirme el pedido, de manera natural, sin presionar.

PRODUCTOS DISPONIBLES:
${BOT_CONFIG.productos.map(p => `
- ${p.nombre}
  Precio blanco: $${p.precio_blanco.toLocaleString('es-AR')}
  Precio color personalizado: $${p.precio_color.toLocaleString('es-AR')} (+15%)
  Colores disponibles: ${p.colores.join(', ')}
  Plazo de entrega: ${p.dias_entrega} días hábiles desde que se confirma la seña
  ${p.descripcion}
`).join('')}

PROCESO DE CIERRE:
${BOT_CONFIG.cierre}

CÓMO MANEJAR LA CONVERSACIÓN:
1. Si el cliente saluda o pregunta en general → presentate brevemente y preguntá qué busca
2. Si pregunta por un producto → describilo con entusiasmo, mencioná precio y colores
3. Si muestra interés → preguntá color y cantidad, luego pedí nombre y barrio para reservar
4. Si pregunta por la seña o quiere confirmar → explicá el proceso de pago y dale seguridad
5. Si pregunta algo que no sabés → decí "Eso te lo confirmo en un momento, le consulto al equipo"
6. Nunca inventés precios ni datos que no tenés

TONO: natural, como una persona real. Usá emojis con moderación (1-2 por mensaje máximo). Mensajes cortos y directos, sin párrafos largos.

RESPUESTA OBLIGATORIA EN JSON con este formato exacto:
{
  "respuesta": "el mensaje que le vas a enviar al cliente",
  "lead": null
}

Cuando el cliente confirmó nombre + producto + interés real en comprar, completá "lead":
{
  "respuesta": "el mensaje que le vas a enviar al cliente",
  "lead": {
    "nombre": "nombre del cliente",
    "producto": "nombre del producto",
    "color": "color elegido o null",
    "cantidad": 1,
    "barrio": "barrio o null",
    "notas": "cualquier info extra relevante"
  }
}

IMPORTANTE: Respondé SOLO con el JSON puro. Sin markdown, sin bloques de código, sin texto antes ni después. Empezá directamente con { y terminá con }.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getConversacion(telefono: string) {
  const { data } = await supabase
    .from('conversaciones_bot')
    .select('*')
    .eq('telefono', telefono)
    .single()
  return data
}

async function guardarMensaje(
  telefono: string,
  nombre: string,
  mensajes: { role: string; content: string }[]
) {
  await supabase.from('conversaciones_bot').upsert(
    { telefono, nombre, mensajes, updated_at: new Date().toISOString() },
    { onConflict: 'telefono' }
  )
}

async function marcarLeadCapturado(telefono: string, leadId: string) {
  await supabase
    .from('conversaciones_bot')
    .update({ lead_id: leadId })
    .eq('telefono', telefono)
}

async function enviarMensajeWati(telefono: string, texto: string) {
  const url = `${WATI_URL}/api/v1/sendSessionMessage/${telefono}`
  console.log('WATI send URL:', url)
  const body = new URLSearchParams({ messageText: texto })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WATI_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  const resText = await res.text()
  console.log('WATI response status:', res.status, resText.substring(0, 300))
  if (!res.ok) {
    console.error('Error enviando mensaje WATI:', resText)
  }
}

async function guardarLead(telefono: string, leadData: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      fuente:    'wati',
      nombre:    leadData.nombre ?? 'Sin nombre',
      telefono,
      producto:  leadData.producto ?? 'Zapatero Slim',
      color:     leadData.color ?? null,
      cantidad:  leadData.cantidad ?? 1,
      barrio:    leadData.barrio ?? null,
      notas:     leadData.notas ?? null,
      estado:    'nuevo',
    })
    .select()
    .single()

  if (error) console.error('Error guardando lead:', error)
  return data
}

// ─── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Log para debug
    console.log('WATI webhook body keys:', Object.keys(body))
    console.log('WATI body sample:', JSON.stringify(body).substring(0, 400))

    // Solo procesar mensajes entrantes de texto
    if (body.owner === true || body.type !== 'text' || !body.text) {
      return NextResponse.json({ ok: true })
    }

    const telefono   = body.waId as string
    const nombre     = (body.senderName ?? body.messageContact?.name ?? '') as string
    const mensajeCliente = (body.text as string).trim()

    if (!telefono || !mensajeCliente) {
      return NextResponse.json({ ok: true })
    }

    // Obtener historial de conversación
    const conv = await getConversacion(telefono)
    const historial: { role: string; content: string }[] = conv?.mensajes ?? []

    // Si ya se capturó el lead, no volver a hacerlo
    const leadYaCapturado = !!conv?.lead_id

    // Agregar mensaje del cliente al historial
    historial.push({ role: 'user', content: mensajeCliente })

    // Mantener máximo 20 mensajes para no pasarnos de tokens
    const historialReciente = historial.slice(-20)

    // Llamar a Claude
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:     SYSTEM_PROMPT,
      messages:   historialReciente.map(m => ({
        role:    m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parsear respuesta JSON de Claude (maneja si viene envuelto en markdown)
    let parsed: { respuesta: string; lead: Record<string, unknown> | null }
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      parsed = { respuesta: rawText.trim(), lead: null }
    }

    const { respuesta, lead } = parsed

    // Agregar respuesta del bot al historial
    historialReciente.push({ role: 'assistant', content: respuesta })

    // Guardar conversación actualizada
    await guardarMensaje(telefono, nombre, historialReciente)

    // Enviar respuesta al cliente vía WATI
    await enviarMensajeWati(telefono, respuesta)

    // Capturar lead si Claude lo detectó y no lo hicimos antes
    if (lead && !leadYaCapturado) {
      const leadGuardado = await guardarLead(telefono, lead)
      if (leadGuardado) {
        await marcarLeadCapturado(telefono, leadGuardado.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error en webhook WATI:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// WATI verifica el webhook con GET al configurarlo
export async function GET() {
  return NextResponse.json({ ok: true, webhook: 'TresDeco Bot activo' })
}
