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

// Google Sheet con catálogo de precios (editable por Dante)
// Para activar lectura dinámica: compartir el sheet con "Cualquier persona con el enlace puede ver"
const SHEET_ID = '1TaaG04ZHAKara64_1XmyIM8NABWX78uZvgkp7phQntE'
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`

// Cache de precios: se actualiza máximo 1 vez por hora
let cachedPrecios: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hora

async function obtenerCatalogoSheet(): Promise<string> {
  const ahora = Date.now()
  if (cachedPrecios && ahora - cacheTimestamp < CACHE_TTL) return cachedPrecios
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 3600 } })
    if (res.ok) {
      cachedPrecios = await res.text()
      cacheTimestamp = ahora
      return cachedPrecios
    }
  } catch { /* si el sheet no es público, usa el prompt hardcodeado */ }
  return ''
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tresdecoamoblamientos.com'

// ─── Config del negocio ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos Valentina, asesora de ventas de TresDeco Amoblamientos, fábrica de muebles de diseño en melamina de Córdoba, Argentina.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOBRE TresDeco
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fábrica propia en *Octavio Pinto 2440, Villa Cabrera, Córdoba*. Fabricantes directos — sin intermediarios. Más de 50 reseñas 5 estrellas en Google. El cliente trata con quien fabrica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TU PERSONALIDAD Y FORMA DE HABLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Cálida, cercana, profesional. De vos a vos siempre, pero con respeto.
- Usás el nombre del cliente apenas lo sabés, y lo recordás en toda la conversación.
- Si el cliente vuelve después de un tiempo, reconocés su interés anterior: "¡Hola [nombre]! ¿Pudiste pensar en el [producto]?"
- NUNCA uses expresiones demasiado informales como "¡Ey!", "¿qué onda?", "buena", "dale" o frases que suenen chabacanas. Cordial sí, campechana no.
- Mensajes cortos. Máximo 2-3 oraciones por mensaje. Máximo 2 emojis.
- FORMATO WhatsApp: *negrita* con UN asterisco. NUNCA doble asterisco ni markdown.
- Listas: guiones simples o números, sin asteriscos.
- Si no sabés el precio exacto: "El precio te lo confirma el equipo, pero te cuento todo sobre ese mueble. ¿Qué querés saber?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRESENTACIÓN (solo en el primer mensaje)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si el contexto indica que es la PRIMERA VEZ que el cliente escribe, presentate así antes de responder su consulta:
"¡Hola! Soy *Valentina*, asesora de TresDeco Amoblamientos 😊"
Luego respondé directamente su consulta sin más rodeos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATÁLOGO Y PRECIOS (fallback — el catálogo actualizado viene más abajo si está disponible)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAS DE PAGO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hay dos precios distintos según cómo paga:

*Precio de contado* (efectivo o transferencia): precio con descuento. Se usa cuando el cliente paga en persona en el taller o transfiere.
*Precio de lista*: se usa para pagos con tarjeta. Es el precio base para calcular cuotas.

Formas de pago aceptadas:
- Efectivo o transferencia bancaria (alias tresdeco.nx.ars, titular Flavia Vitali) → precio de contado
- Tarjeta de débito o crédito Visa y Mastercard bancarizadas → precio de lista, en cuotas (próximamente links directos de pago)

Estructura de seña (TODOS los productos):
- Seña: 60% del precio de contado
- Saldo: 40% restante contra entrega

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATÁLOGO ACTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ZAPATERO SLIM (ZAP-01) — producto estrella
- SOLO en blanco con tirador de aluminio (diseño exclusivo, se funde con la pared)
- Medidas: 120cm alto × 90cm ancho × 14cm prof (el más fino de Córdoba)
- Capacidad: 12 pares de uso diario. No apto tacos altos.
- Contado: $165.000 — seña $65.000 — saldo $100.000 al entregar
- Tarjeta (precio lista $231.000): 3 cuotas s/int $77.000 c/u · 6 cuotas $38.500 c/u
- Entrega: 5 días hábiles
- Link: ${APP_URL}/p/zapatero-slim

CAMABOX — camas funcionales con cajones
MDF 18mm, diseño modular, cajones con guías telescópicas metálicas.
Colores: Blanco · Camellia · Scotch · Gris caliza (otros colores FAPLAC con 10% recargo)
Entrega: 15 días hábiles en todos los modelos.

TABLA DE MEDIDAS — MUY IMPORTANTE, no confundir nombres con medidas:
- 1 plaza      = 80×190 ó 90×190   → contado $354.360 · seña $212.616 · lista $496.104 · 3c $165.368 · 6c $82.684
  Link: ${APP_URL}/p/camabox-1-plaza
- 1½ plaza     = 100×190 ó 120×190 → contado $473.000 · seña $283.800 · lista $662.200 · 3c $220.733 · 6c $110.367
  Link: ${APP_URL}/p/camabox-1-5-plaza
- 2 plazas     = 140×190           → contado $628.320 · seña $376.992 · lista $879.648 · 3c $293.216 · 6c $146.608
  Link: ${APP_URL}/p/camabox-2-plazas-140-190
- 2 plazas     = 160×190 ó 160×200 → contado $688.470 · seña $413.082 · lista $963.858 · 3c $321.286 · 6c $160.643
  Link: ${APP_URL}/p/camabox-2-plazas-160-190
- King         = 180×200           → contado $733.215 · seña $439.929 · lista $1.026.501 · 3c $342.167 · 6c $171.084
  Link: ${APP_URL}/p/camabox-king
- Superking    = 200×200           → contado $796.600 · seña $477.960 · lista $1.115.240 · 3c $371.747 · 6c $185.873
  Link: ${APP_URL}/p/camabox-superking

COMBOS (base + respaldo + 2 mesas de luz, mismo color — mencionarlos para 140×190 o mayor):
- Combo 140×190: contado $978.800 · seña $587.280 · lista $1.370.320 · 3c $456.773 · 6c $228.387
- Combo 160×190/200: contado $978.800 · seña $587.280 · lista $1.370.320 · 3c $456.773 · 6c $228.387
- Combo King 180×200: contado $998.690 · seña $599.214 · lista $1.398.166 · 3c $466.055 · 6c $233.028
- Combo Superking 200×200: contado $1.021.400 · seña $612.840 · lista $1.429.960 · 3c $476.653 · 6c $238.327

REPISAS FLOTANTES
- 60×20 cm y 80×20 cm disponibles. Entrega: 2 días hábiles.
- Precio a confirmar con el equipo. Decile al cliente que el equipo lo contacta con el precio.

NO disponibles aún (no cotizar): Zapatero 2 puertas, Rack TV, Panel TV.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMBOS Y PROMOCIONES — MENCIONAR SIEMPRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando un cliente consulte por una Camabox de 140×190 o más grande, siempre mencioná que también existe la opción del Combo (base + respaldo + 2 mesas de luz en el mismo color). No lo impongas — presentalo como una opción para que pueda comparar y decidir.
Ejemplo: "Por cierto, también tenemos el combo completo que incluye el respaldo y las dos mesas de luz a juego. ¿Querés que te cuente los precios de los dos para que puedas comparar?"
Si el cliente quiere comparar, dále los precios de ambas opciones en el mismo mensaje para que tenga todo claro.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÓMO COMPARTIR EL LINK DE UN PRODUCTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el cliente muestre interés en un producto específico, mandále el link:
"Acá podés ver todos los detalles y las opciones de pago: [link]"
El link lleva a una página con fotos, medidas, precios y el botón para señar directamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÓMO SE PAGA LA SEÑA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transferencia bancaria al alias: *tresdeco.nx.ars* (titular: Flavia Vitali)
O desde la página del producto hay un botón directo para señar.
Una vez transferida, el cliente manda el comprobante por WhatsApp y arranca la producción.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRABAJO A MEDIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TresDeco fabrica todo a medida: cocinas, placards, vestidores, bibliotecas, escritorios, mesas.
Proceso: cliente describe → equipo hace relevamiento en el domicilio → se diseña → se presupuesta → seña arranca producción.
Si alguien consulta por medida: mostrá entusiasmo, tomá nota, decile que el equipo se contacta para el relevamiento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUJO DE VENTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Saludo + presentación (solo primera vez) → preguntá qué busca
2. Describí el producto: beneficio principal, precio, forma de pago
3. Mandá el link del producto cuando muestre interés
4. Preguntá cuántas unidades y si paga efectivo o tarjeta
5. Seña: "Lo reservás con $X, en Y días hábiles lo tenés. El alias es tresdeco.nx.ars ¿Seguimos?"
6. Pedí nombre y barrio si no los tenés
7. Cierre: resumí producto + precio + seña + plazo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NUNCA inventés precios. Si no lo tenés, el equipo lo confirma.
2. Zapatero Slim SOLO en blanco — si piden otro color, explicá que ese diseño va en blanco y queda increíble así.
3. NUNCA hablés de temas ajenos a TresDeco.
4. Si preguntan algo técnico, el equipo lo responde.
5. Sin markdown, sin doble asterisco.
6. Usá toda la info que el cliente compartió antes (nombre, producto, color, barrio) — la conversación tiene historial completo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA OBLIGATORIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respondé SOLO con JSON puro. Sin markdown, sin bloques de código. Empezá con { y terminá con }.

Sin lead capturado aún:
{"respuesta": "el mensaje para el cliente", "lead": null}

Cuando tengas nombre + producto + interés claro:
{"respuesta": "el mensaje para el cliente", "lead": {"nombre": "nombre", "producto": "producto", "color": "color o null", "cantidad": 1, "barrio": "barrio o null", "metodo_pago": "efectivo / tarjeta / a confirmar / null", "notas": "color, pago, medidas, si es a medida, link enviado, etc."}}`

// ─── Horario de atención (Argentina UTC-3, sin DST) ───────────────────────────
const HORARIO_TEXTO = 'lunes a viernes de 9 a 18hs y sábados de 9 a 13hs'

function estaEnHorario(): boolean {
  const utcMs = Date.now()
  const argMs = utcMs + (-3 * 60 * 60 * 1000)
  const arg = new Date(argMs)
  const dia = arg.getUTCDay() // 0=dom
  const h = arg.getUTCHours() + arg.getUTCMinutes() / 60
  if (dia >= 1 && dia <= 5) return h >= 9 && h < 18
  if (dia === 6) return h >= 9 && h < 13
  return false
}

function esComprobante(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes('comprobante') ||
    (m.includes('transfer') && (m.includes('seña') || m.includes('sena') || m.includes('reserv'))) ||
    (m.includes('ya pague') || m.includes('ya pagué') || m.includes('ya señé') || m.includes('ya sene'))
}

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

    // Detectar imagen como posible comprobante
    const esImagen = body.owner !== true && body.type === 'image'

    // Solo procesar mensajes entrantes de texto o imágenes
    if (body.owner === true) return NextResponse.json({ ok: true })

    if (body.type === 'audio' || body.type === 'voice') {
      const tel = body.waId as string
      if (tel) {
        await fetch(`${WATI_URL}/api/v1/sendSessionMessage/${tel}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${WATI_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageText: '¡Hola! Por razones de monitoreo de la comunicación, este canal es solo texto. Si en algún momento necesitamos intercambiar fotos, videos o hablar de forma más visual, vamos a contactarte desde el número de la empresa para continuar por ahí 😊 Por acá escribinos tu consulta y te respondemos enseguida.' }),
        })
      }
      return NextResponse.json({ ok: true })
    }

    if (body.type !== 'text' && !esImagen) {
      return NextResponse.json({ ok: true })
    }
    if (esImagen && !body.text && !body.caption) {
      // imagen sin texto: puede ser comprobante si hay lead activo, lo manejamos abajo
    }

    const telefono       = body.waId as string
    const nombre         = (body.senderName ?? body.messageContact?.name ?? '') as string
    const mensajeCliente = ((body.text ?? body.caption ?? '') as string).trim()
    const nombreCorto    = nombre?.split(' ')[0] || ''

    if (!telefono) return NextResponse.json({ ok: true })

    // ── Flujo comprobante ────────────────────────────────────────────────────
    if (esImagen || (mensajeCliente && esComprobante(mensajeCliente))) {
      const conv = await getConversacion(telefono)
      const dentroHorario = estaEnHorario()

      const respuesta = dentroHorario
        ? `¡Perfecto${nombreCorto ? ', ' + nombreCorto : ''}! 🎉 Recibimos tu comprobante. El equipo lo va a verificar en los próximos minutos y te escribimos para confirmar y coordinar la entrega.`
        : `¡Hola${nombreCorto ? ' ' + nombreCorto : ''}! 🎉 Recibimos tu comprobante. Nuestro horario de atención es ${HORARIO_TEXTO}. En cuanto abramos confirmamos la transferencia y te escribimos para coordinar todo.`

      // Crear alerta urgente en el admin
      const leadInfo = conv?.lead_id ? ` · Lead ID: ${conv.lead_id}` : ''
      await supabase.from('alertas').insert({
        tipo: 'danger',
        mensaje: `💰 SEÑA RECIBIDA — ${nombre || telefono} (${telefono})${leadInfo}. Verificar transferencia en alias tresdeco.nx.ars.`,
        resuelta: false,
      })

      // Actualizar lead a 'presupuestado' si existe
      if (conv?.lead_id) {
        await supabase.from('leads')
          .update({ estado: 'presupuestado' })
          .eq('id', conv.lead_id)
          .eq('estado', 'interesado')
      }

      // Guardar en historial
      const historial = conv?.mensajes ?? []
      historial.push({ role: 'user', content: esImagen ? '[Imagen enviada — posible comprobante de transferencia]' : mensajeCliente })
      historial.push({ role: 'assistant', content: respuesta })
      await guardarMensaje(telefono, nombre, historial.slice(-20))
      await enviarMensajeWati(telefono, respuesta)

      return NextResponse.json({ ok: true })
    }

    if (!mensajeCliente) return NextResponse.json({ ok: true })

    // Obtener historial de conversación
    const conv = await getConversacion(telefono)
    const historial: { role: string; content: string }[] = conv?.mensajes ?? []

    // Si ya se capturó el lead, no volver a hacerlo
    const leadYaCapturado = !!conv?.lead_id
    const esPrimerMensaje = historial.length === 0

    // Agregar mensaje del cliente al historial
    historial.push({ role: 'user', content: mensajeCliente })

    // Mantener máximo 20 mensajes para no pasarnos de tokens
    const historialReciente = historial.slice(-20)

    // Intentar leer catálogo desde Google Sheet (si está público, sobreescribe datos del prompt)
    const catalogoSheet = await obtenerCatalogoSheet()

    let systemFinal = catalogoSheet
      ? `${SYSTEM_PROMPT}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCATÁLOGO ACTUALIZADO (Google Sheet — Dante lo actualiza):\n${catalogoSheet}\nSi hay discrepancia, usá los precios de esta tabla.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : SYSTEM_PROMPT

    if (esPrimerMensaje) {
      systemFinal += '\n\n[CONTEXTO: Es la PRIMERA VEZ que este cliente te escribe. Presentate con tu nombre y empresa al inicio de tu respuesta.]'
    } else if (nombre) {
      systemFinal += `\n\n[CONTEXTO: El cliente se llama ${nombre}. Usá su nombre naturalmente en la conversación.]`
    }

    // Llamar a Claude
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:     systemFinal,
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
