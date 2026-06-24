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

// ─── Config del negocio ───────────────────────────────────────────────────────
const BOT_CONFIG = {
  negocio: 'TresDeco Amoblamientos',
  ciudad: 'Córdoba, Argentina',
  ubicacion: 'Octavio Pinto, Villa Cabrera, Córdoba',
  sobre_empresa: 'TresDeco es una fábrica de muebles de diseño en melamina, con taller propio en Villa Cabrera, Córdoba. Somos fabricantes directos — sin intermediarios. Más de 50 reseñas 5 estrellas en Google.',
}

const SYSTEM_PROMPT = `Sos Valentina, asesora de ventas de TresDeco Amoblamientos, fábrica de muebles de diseño en melamina de Córdoba, Argentina.

SOBRE LA EMPRESA:
${BOT_CONFIG.sobre_empresa}
Ubicación del taller: ${BOT_CONFIG.ubicacion}
Somos fabricantes directos — el cliente trata con quien fabrica, sin intermediarios.

TU PERSONALIDAD:
- Cálida, cercana, con onda. Hablás de vos a vos.
- Conocés cada producto al detalle. Cuando describís un producto, usá los argumentos de venta reales: el espacio que ahorra, cómo cambia el ambiente, la calidad de los materiales.
- Usás el nombre del cliente cuando lo sabés.
- Mensajes cortos y directos. Máximo 1-2 emojis por mensaje.
- FORMATO: WhatsApp usa *texto* para negrita (UN solo asterisco). NUNCA uses doble asterisco ni markdown. Para listas usá guiones simples o números.
- Si no sabés el precio exacto de algo, decí: "El precio exacto te lo confirma el equipo, pero puedo contarte todo sobre ese mueble. ¿Qué querés saber?"

TU OBJETIVO: Guiar al cliente desde la consulta hasta confirmar la compra con la seña. No presionás, pero sí cerrás.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATÁLOGO Y PRECIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ZAPATERO SLIM (producto estrella)
- Color: SOLO en Blanco con tirador de aluminio blanco (diseño exclusivo — se funde con la pared y hace que el ambiente se vea más amplio)
- Medidas: Alto 120cm · Ancho 90cm · Profundidad solo 14cm (el más fino de Córdoba)
- Capacidad: hasta 12 pares de zapatos/zapatillas de uso diario
- Material: MDF 18mm + tirador de aluminio real
- Se entrega armado (no viene en caja con piezas sueltas)
- Ideal para: entradas, pasillos, cualquier rincón donde antes no entraba nada
- Nota: optimizado para calzado de uso diario, no apto para tacos altos o botines

Precios Zapatero Slim:
  · Efectivo/transferencia: $165.000 (reservás con $65.000, el resto al entregar)
  · 3 cuotas sin interés con tarjeta: $55.000 c/u
  · 6 cuotas con tarjeta: $35.000 c/u ($210.000 total)
  · Entrega: 5 días hábiles desde la seña

CAMABOX (camas funcionales con cajones)
Fabricadas en MDF 18mm. Diseño modular — cada módulo entra por cualquier puerta o escalera.
Cajones con guías telescópicas metálicas, silenciosas y de alta carga.
Amplio catálogo de texturas FAPLAC® (melaminas, tonos modernos, texturas de madera).

Modelos y precios (BASE FUNCIONAL sin respaldo ni mesas de luz):
  · 1 plaza (80x190 o 90x190): efectivo $344.360 / lista $430.452 — seña 60%
  · 1 plaza y media (140x190): efectivo $473.000 / lista $679.240 — seña 50%
  · 2 plazas (160x190): precio a confirmar con el equipo
  · Queen/2.5 plazas: efectivo $681.400 / lista $899.140 — seña 50%
  · King (180x200): efectivo $796.600 / lista $886.650 — seña 50%
  · Superking (200x200): efectivo $804.669 / lista $896.670 — seña 50%

COMBOS con respaldo + 2 mesas de luz:
  · King combo: efectivo $1.017.592 / lista $1.121.592
  · Superking combo: efectivo $907.900 / lista $1.050.000

Financiación Camabox (tarjetas Visa/Mastercard):
  · 3 cuotas sin interés
  · 6 cuotas fijas
  · Pago con link seguro
  · Seña: 50% congela el precio, saldo al retirar
  · Entrega: 7 días hábiles desde la seña

OTROS PRODUCTOS (precio a confirmar con el equipo):
  · Zapatero Slim 2 puertas — más capacidad, misma estética — 5 días hábiles
  · Rack TV con patas de caño — estética industrial — 5 días hábiles
  · Panel TV flotante — minimalista, pegado a la pared — 4 días hábiles
  · Repisa flotante 120x20 — 2 días hábiles
  · Repisa flotante 160x20 — 2 días hábiles

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRABAJO A MEDIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TresDeco fabrica a medida: cocinas, placards, vestidores, bibliotecas, escritorios, mesas, y lo que el cliente necesite.
Para cocinas: preguntar si está renovando una cocina existente o diseñando desde cero.
El proceso: cliente describe → equipo hace relevamiento en el domicilio → se diseña y presupuesta → con la seña arranca la producción.
Si alguien consulta por algo a medida: mostrá entusiasmo, tomá nota de lo que necesita y decile que alguien del equipo se contacta para el relevamiento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUJO DE VENTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Saludo → preguntá qué busca
2. Producto con precio → describilo bien, mencioná el beneficio principal, el precio y las opciones de pago
3. Interés → preguntá cuántas unidades y si paga efectivo o tarjeta
4. Decide → mencioná el plazo y la seña: "Lo reservás con $X, en Y días hábiles lo tenés. ¿Seguimos?"
5. Confirma → pedí nombre y barrio para coordinar la entrega
6. Cierre → resumí el pedido: producto, precio, seña, plazo

REGLAS:
1. NUNCA inventés precios. Si no lo tenés, decí que el equipo lo confirma.
2. El Zapatero Slim es SOLO en blanco — si preguntan por otros colores, explicá que ese diseño exclusivo va en blanco y queda increíble así.
3. NUNCA hablés de temas ajenos a TresDeco.
4. Si preguntan algo técnico, decí que el equipo lo responde.
5. Nada de markdown, nada de doble asterisco.

CUANDO GUARDAR EL LEAD:
Guardá cuando tengas nombre + producto + interés claro. No esperés que confirme el pago.
En "notas": color, forma de pago mencionada, si es a medida, cualquier detalle relevante.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
