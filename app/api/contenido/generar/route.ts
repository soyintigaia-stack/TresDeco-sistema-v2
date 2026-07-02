import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIPOS: Record<string, string> = {
  post:     'post de feed de Instagram (máx 120 palabras, con 5-8 hashtags relevantes al final)',
  historia: 'historia de Instagram (máx 80 palabras, texto pensado para acompañar una foto, storytelling breve)',
  oferta:   'post de oferta especial (máx 100 palabras, urgencia y llamado a la acción claro)',
  tip:      'tip de decoración u organización del hogar (máx 100 palabras, educativo y útil, no comercial)',
  whatsapp: 'mensaje de difusión de WhatsApp para clientes (máx 80 palabras, cercano y directo, sin hashtags)',
}

export async function POST(req: NextRequest) {
  try {
    const { producto, tipo, red, info_extra } = await req.json()
    if (!producto || !tipo) {
      return NextResponse.json({ error: 'Faltan producto y tipo' }, { status: 400 })
    }

    const formato = TIPOS[tipo] ?? TIPOS.post

    const prompt = `Sos el community manager de TresDeco Amoblamientos, fábrica de muebles de melamina a medida en Córdoba, Argentina.
Tono: profesional, cálido, cercano pero no chabacano. Sin exceso de exclamaciones.

Generá un ${formato} sobre el producto: *${producto}*${info_extra ? `\nInfo adicional del equipo: ${info_extra}` : ''}

Reglas:
- Voz de la marca: primera persona plural ("fabricamos", "creamos", "te ofrecemos")
- Destacar que son fabricantes directos, sin intermediarios, con más de 12 años en el mercado
- Llamado a la acción: consultar por WhatsApp o visitar tresdecoamoblamientos.com
- Máximo 3 emojis en todo el texto
- Red social destino: ${red ?? 'Instagram'}
- Terminar con la firma: *TresDeco Amoblamientos* | Córdoba

Devolvé solo el texto del contenido listo para publicar, sin explicaciones ni comentarios.`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const texto = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return NextResponse.json({ texto })
  } catch (e) {
    console.error('Error generando contenido:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
