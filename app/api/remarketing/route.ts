import { NextRequest, NextResponse } from 'next/server'

const WATI_URL   = process.env.WATI_API_URL   ?? 'https://live-mt-server.wati.io/10188987'
const WATI_TOKEN = process.env.WATI_API_TOKEN ?? ''

export async function POST(req: NextRequest) {
  try {
    const { telefono, mensaje } = await req.json()
    if (!telefono || !mensaje) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const url = `${WATI_URL}/api/v1/sendSessionMessage/${telefono}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WATI_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ messageText: mensaje }).toString(),
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: txt }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
