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

  // ── Proteger /administracion ─────────────────────────────────────────────
  if (pathname.startsWith('/administracion')) {
    // Buscar cookie de sesión de Supabase (el nombre varía según la versión)
    const cookies = req.cookies.getAll()
    const authCookie = cookies.find(c =>
      c.name.includes('auth-token') ||
      c.name.includes('sb-') && c.name.includes('-auth-token')
    )

    if (!authCookie) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/administracion/:path*'],
}
