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
  ubicacion: 'Octavio Pinto, Villa Cabrera, Córdoba',
  colores_disponibles: ['Blanco', 'Camellia', 'Gris Grafito', 'Tribal', 'Amaranto', 'Negro', 'Natural'],
  productos: [
    {
      nombre: 'Zapatero Slim',
      precio_blanco: 165000,
      precio_color: 189750,
      seña: 65000,
      dias_entrega: 5,
      descripcion: 'Zapatero moderno de melamina, diseño slim minimalista. Capacidad para 12 pares de zapatos. Todos los colores disponibles.',
    },
    {
      nombre: 'Zapatero Slim 2 puertas',
      precio_blanco: null,
      precio_color: null,
      seña: null,
      dias_entrega: 5,
      descripcion: 'Versión más amplia del Zapatero Slim, con 2 puertas. Mayor capacidad de almacenamiento.',
    },
    {
      nombre: 'Camabox 140x190 (6 cajones)',
      precio_blanco: null,
      precio_color: null,
      seña: null,
      dias_entrega: 7,
      descripcion: 'Cama de 1 plaza y media (140x190cm) con 6 cajones inferiores para guardado. Melamina de alta calidad.',
    },
    {
      nombre: 'Camabox 160x190 (6 cajones)',
      precio_blanco: null,
      precio_color: null,
      seña: null,
      dias_entrega: 7,
      descripcion: 'Cama de 2 plazas (160x190cm) con 6 cajones inferiores. Ideal para dormitorios principales.',
    },
    {
      nombre: 'Rack TV con patas de caño',
      precio_blanco: null,
      precio_color: null,
      seña: null,
      dias_entrega: 5,
      descripcion: 'Rack para TV con estructura de caño metálico y tablero de melamina. Estética industrial moderna.',
    },
    {
      nombre: 'Panel TV flotante',
      precio_blanco: null,
      precio_color: null,
      seña: null,
      dias_entrega: 4,
      descripcion: 'Panel flotante para TV, clean y minimalista. Queda pegado a la pared, sin patas.',
    },
    {
      nombre: 'Repisa flotante 120x20',
      precio_blanco: null,
      precio_color: null,
      seña: null,
      dias_entrega: 2,
      descripcion: 'Repisa de melamina 120cm de largo x 20cm de profundidad. Para libros, plantas, decoración.',
    },
    {
      nombre: 'Repisa flotante 160x20',
      precio_blanco: null,
      precio_color: null,
      seña: null,
      dias_entrega: 2,
      descripcion: 'Repisa de melamina 160cm de largo x 20cm de profundidad.',
    },
  ],
  proceso_pago: 'La seña se hace por transferencia bancaria. Una vez confirmada la seña, arranca la producción y te damos la fecha exacta de entrega.',
  medidas_camas: 'Trabajamos también camas a medida. Consultar para presupuesto personalizado.',
  sobre_empresa: 'TresDeco es una fábrica de muebles de diseño en melamina, con taller propio en Villa Cabrera, Córdoba. Fabricamos muebles de diseño moderno a precio de fábrica. Más de 50 reseñas 5 estrellas en Google.',
}

const SYSTEM_PROMPT = `Sos Valentina, asesora de ventas de ${BOT_CONFIG.negocio}, una fábrica de muebles de diseño en melamina de ${BOT_CONFIG.ciudad}.

SOBRE LA EMPRESA:
${BOT_CONFIG.sobre_empresa}
Ubicación del taller: ${BOT_CONFIG.ubicacion}

TU PERSONALIDAD:
- Cálida, cercana, profesional. Hablás de vos a vos.
- Conocés cada producto al detalle y te apasiona ayudar a encontrar el mueble ideal.
- Usás el nombre del cliente cuando lo sabés.
- Mensajes cortos y directos. Máximo 1-2 emojis por mensaje.

TU OBJETIVO: guiar al cliente desde el primer mensaje hasta confirmar el pedido, de forma natural y sin presionar.

CATÁLOGO COMPLETO:
${BOT_CONFIG.productos.map(p => `
• ${p.nombre} — Entrega: ${p.dias_entrega} días hábiles
  ${p.descripcion}
  ${p.precio_blanco ? `Precio blanco: $${p.precio_blanco.toLocaleString('es-AR')} | Color personalizado: $${p.precio_color!.toLocaleString('es-AR')} (+15%) | Seña: $${p.seña!.toLocaleString('es-AR')}` : 'Precio: consultar (te paso el precio exacto en el momento)'}
`).join('')}

COLORES DISPONIBLES PARA TODOS LOS PRODUCTOS:
${BOT_CONFIG.colores_disponibles.join(', ')}

PROCESO DE PAGO Y ENTREGA:
${BOT_CONFIG.proceso_pago}

TRABAJO A MEDIDA:
TresDeco también fabrica muebles completamente a medida: placards, bibliotecas, cocinas, vestidores, escritorios, mesas, y cualquier mueble que el cliente necesite.
El proceso para a medida es: el cliente describe lo que necesita → el equipo hace un relevamiento → se diseña y presupuesta → con la seña arranca la producción.
Si alguien pregunta por algo a medida, mostrá entusiasmo, tomá nota de qué necesita y decí que alguien del equipo se va a contactar para el relevamiento.

REGLAS IMPORTANTES (seguí estas siempre):
1. NUNCA inventés precios. Si no tenés el precio de un producto, decí "Ahora te paso el precio exacto, dame un segundo".
2. NUNCA hablés de temas que no son TresDeco (política, otros negocios, consejos de vida, etc.).
3. Si te preguntan algo técnico de fabricación o proveedores, decí que lo deriva al equipo.
4. Si el cliente pregunta por algo que no está en el catálogo, ofrecé trabajo a medida y decí que lo contacta alguien del equipo.
5. Si el cliente se pone agresivo o inapropiado, respondé con calma y profesionalismo, sin entrar en discusión.

FLUJO DE VENTA (seguilo en orden, no te saltes pasos):
1. Saludo/consulta general → presentate brevemente, preguntá qué busca
2. Pregunta por producto → describilo con entusiasmo, mencioná precio y colores disponibles
3. Muestra interés → preguntá qué color le gusta y cuántas unidades necesita
4. Elige color/cantidad → contale el plazo de entrega y mencioná la seña de forma natural:
   Ejemplo: "El plazo es de 5 días hábiles desde que confirmamos la seña de $65.000 por transferencia. ¿Cómo preferís pagar el resto, en efectivo o transferencia?"
5. Responde sobre pago → pedile nombre y de qué barrio es para coordinar la entrega
6. Da nombre y barrio → confirmá el resumen del pedido y decile que con la seña arranca la producción

CUANDO GUARDAR EL LEAD:
Guardá el lead cuando tengas: nombre + producto + (color O interés claro en comprar).
No esperes a que confirme el pago. Si ya eligió producto y dio su nombre, guardalo.
En "notas" anotá todo lo relevante: color elegido, forma de pago mencionada, si preguntó por financiación, si es a medida, etc.

RESPUESTA OBLIGATORIA EN JSON con este formato exacto:
{
  "respuesta": "el mensaje que le vas a enviar al cliente",
  "lead": null
}

Cuando tengas nombre + producto + interés claro, completá "lead":
{
  "respuesta": "el mensaje que le vas a enviar al cliente",
  "lead": {
    "nombre": "nombre del cliente",
    "producto": "nombre del producto",
    "color": "color elegido o null",
    "cantidad": 1,
    "barrio": "barrio o null",
    "metodo_pago": "efectivo / transferencia / a confirmar / null",
    "notas": "todo lo relevante: color, pago, si es a medida, dudas del cliente, etc."
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
      fuente:       'wati',
      nombre:       leadData.nombre ?? 'Sin nombre',
      telefono,
      producto:     leadData.producto ?? 'Zapatero Slim',
      color:        leadData.color ?? null,
      cantidad:     leadData.cantidad ?? 1,
      barrio:       leadData.barrio ?? null,
      metodo_pago:  leadData.metodo_pago ?? null,
      notas:        leadData.notas ?? null,
      estado:       'nuevo',
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
