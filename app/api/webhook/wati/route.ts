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

const SYSTEM_PROMPT = `Sos el asistente virtual de ${BOT_CONFIG.negocio}, una fábrica de muebles de ${BOT_CONFIG.ciudad}.
Tu objetivo es responder preguntas sobre los productos, generar interés y capturar los datos del cliente para que el equipo de ventas pueda cerrar el pedido.

PRODUCTOS DISPONIBLES:
${BOT_CONFIG.productos.map(p => `
- ${p.nombre}
  Precio blanco: $${p.precio_blanco.toLocaleString('es-AR')}
  Precio color personalizado: $${p.precio_color.toLocaleString('es-AR')} (+15%)
  Colores: ${p.colores.join(', ')}
  Entrega: ${p.dias_entrega} días hábiles
  ${p.descripcion}
`).join('')}

CIERRE DE VENTA:
${BOT_CONFIG.cierre}

INSTRUCCIONES:
- Respondé en español, de forma amigable y directa
- Cuando el cliente muestre interés concreto (quiere comprar, pide precio final, pregunta por la seña), pedile su nombre, barrio y color preferido
- NO seas insistente, acompañá naturalmente la conversación
- Si preguntan algo que no sabés, decí que le vas a avisar a alguien del equipo

RESPUESTA OBLIGATORIA EN JSON con este formato exacto:
{
  "respuesta": "el mensaje que le vas a enviar al cliente",
  "lead": null
}

Si tenés nombre del cliente + interés confirmado, completá "lead" así:
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
  // Intentar sin tenant ID (el token ya identifica el tenant)
  const baseHost = 'https://live.wati.io'
  const url = `${baseHost}/api/v1/sendSessionMessage/${telefono}?messageText=${encodeURIComponent(texto)}`
  console.log('WATI send URL (sin tenant):', url.substring(0, 120))
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WATI_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  const resText = await res.text()
  console.log('WATI response status:', res.status, resText.substring(0, 200))
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
