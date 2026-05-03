import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['400','500','600','700','800'] })
const dm = DM_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['300','400','500'] })

export const metadata: Metadata = {
  title: 'TresDeco — Sistema Operativo',
  description: 'Sistema de gestión TresDeco Amoblamientos',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'TresDeco' },
}
export const viewport: Viewport = { themeColor: '#1A1A18', width: 'device-width', initialScale: 1, maximumScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${syne.variable} ${dm.variable} bg-[#1A1A18] text-white antialiased`} style={{ fontFamily: 'var(--font-body)' }}>
        {children}
      </body>
    </html>
  )
}
