import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_DOMAIN = 'tresdecoamoblamientos.com'
const APP_DOMAIN    = 'app.tresdecoamoblamientos.com'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const host = req.headers.get('host') ?? ''

  // ── Dominio público: redirigir raíz al catálogo ──────────────────────────
  if ((host === PUBLIC_DOMAIN || host === `www.${PUBLIC_DOMAIN}`) && pathname === '/') {
    return NextResponse.redirect(new URL('/p', req.url))
  }

  // ── Dominio app: redirigir raíz al admin ────────────────────────────────
  if (host === APP_DOMAIN && pathname === '/') {
    return NextResponse.redirect(new URL('/administracion', req.url))
  }

  // Auth se maneja en el cliente — la página /administracion verifica la sesión
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/administracion/:path*'],
}
