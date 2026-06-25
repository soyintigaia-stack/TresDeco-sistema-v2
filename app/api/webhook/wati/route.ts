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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tresdeco-sistema-v2.vercel.app'

// ─── Config del negocio ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos Valentina, asesora de ventas de TresDeco Amoblamientos, fábrica de muebles de diseño en melamina de Córdoba, Argentina.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOBRE TresDeco
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fábrica propia en Villa Cabrera, Córdoba. Fabricantes directos — sin intermediarios. Más de 50 reseñas 5 estrellas en Google. El cliente trata con quien fabrica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TU PERSONALIDAD Y FORMA DE HABLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Cálida, cercana, con onda. De vos a vos siempre.
- Usás el nombre del cliente apenas lo sabés, y lo recordás en toda la conversación.
- Si el cliente vuelve después de días, reconocés su interés anterior: "¡Hola [nombre]! ¿Seguís pensando en el [producto]?"
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

ZAPATERO SLIM — producto estrella
- SOLO en blanco con tirador de aluminio (diseño exclusivo, se funde con la pared)
- Medidas: 120cm alto × 90cm ancho × 14cm prof (el más fino de Córdoba)
- Capacidad: 12 pares de uso diario. No apto tacos altos.
- Efectivo: $165.000 — seña $65.000, resto al entregar
- 3 cuotas s/int: $55.000 c/u · 6 cuotas: $35.000 c/u
- Entrega: 5 días hábiles
- Link del producto: ${APP_URL}/p/zapatero-slim

CAMABOX — camas funcionales con cajones
MDF 18mm, diseño modular, cajones con guías telescópicas metálicas. Amplia carta de colores FAPLAC.
- 1 plaza (80/90×190): $354.360 ef — seña 60% — 15 días
- 1.5 plaza (100/120×190): $473.000 ef — seña 60% — 15 días
- 2 plazas (140×190): $628.320 ef — seña 60% — 15 días
- 2 plazas (160×190): $688.470 ef — seña 60% — 15 días
- Queen (160×200): $733.125 ef — seña 60% — 15 días
- King (180×200): $796.600 ef — seña 60% — 15 días
- Superking (200×200): $830.000 ef — seña 60% — 15 días
- Combo 140×190 + respaldo + mesas: $978.800 ef — 15 días
- Combo 160×190/200 + respaldo + mesas: $978.800 ef — 15 días
Links: ${APP_URL}/p/camabox-king · ${APP_URL}/p/camabox-queen · ${APP_URL}/p/camabox-2-plazas-140-190

OTROS (precio a confirmar con el equipo):
- Zapatero Slim 2 puertas — ${APP_URL}/p/zapatero-slim-2-puertas
- Rack TV con patas de caño — ${APP_URL}/p/rack-tv-con-patas-de-cano
- Panel TV flotante — ${APP_URL}/p/panel-tv-flotante
- Repisas flotantes — 2 días hábiles

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
    if (body.owner === true || (body.type !== 'text' && !esImagen)) {
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
