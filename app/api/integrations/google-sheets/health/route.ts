import { NextResponse } from 'next/server'
import { getSheetsClient } from '@/lib/googleSheets'

function assertAdmin(req: Request) {
  // Durante `next build`, Next puede invocar handlers sin env vars reales.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'build' })
  }

  const token = process.env.INTEGRATIONS_ADMIN_TOKEN
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Falta INTEGRATIONS_ADMIN_TOKEN (definilo en Vercel y llamá con ?token=...).' },
      { status: 500 }
    )
  }

  const url = new URL(req.url)
  const provided = url.searchParams.get('token')
  if (provided !== token) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  return null
}

export async function GET(req: Request) {
  const denied = assertAdmin(req)
  if (denied) return denied

  const spreadsheetId = process.env.GOOGLE_SHEETS_PRESUPUESTOS_ID
  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: 'Falta GOOGLE_SHEETS_PRESUPUESTOS_ID' }, { status: 500 })
  }

  // Nota: el nombre real de la pestaña en tu Excel/Google puede incluir espacios al final (ej: "Placas ").
  // Podés sobreescribir este rango en Vercel si hace falta.
  const range = process.env.GOOGLE_SHEETS_PRESUPUESTOS_TEST_RANGE ?? "'Placas '!A1:D5"

  try {
    const sheets = getSheetsClient()
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
    return NextResponse.json({
      ok: true,
      spreadsheetId,
      range,
      values: res.data.values ?? [],
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Falló la lectura con Google Sheets API',
        details: e?.message ?? String(e),
      },
      { status: 500 }
    )
  }
}
