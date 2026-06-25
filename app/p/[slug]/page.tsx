import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1TaaG04ZHAKara64_1XmyIM8NABWX78uZvgkp7phQntE/export?format=csv&gid=0'
const ALIAS_CBU = 'tresdeco.nx.ars'
const TITULAR = 'Flavia Vitali'

type Producto = {
  slug: string
  codigo: string
  nombre: string
  categoria: string
  descripcion: string
  medidas: string
  colores: string
  precioEfectivo: number
  precioLista: number
  señaFija: number
  señaPct: number
  cuotas3: number
  cuotas6: number
  diasEntrega: number
  activo: boolean
  notas: string
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseMoney(val: string): number {
  if (!val) return 0
  return parseInt(val.replace(/[^0-9]/g, '')) || 0
}

async function getProductos(): Promise<Producto[]> {
  try {
    const res = await fetch(SHEET_CSV, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const csv = await res.text()
    const rows = csv.split('\n').slice(1)
    return rows
      .map(row => {
        const cols = row.split(',').map(c => c.replace(/^"|"$/g, '').trim())
        if (!cols[0]) return null
        const nombre = cols[0]
        return {
          slug: slugify(nombre),
          codigo: cols[1] || '',
          nombre,
          categoria: cols[2] || '',
          descripcion: cols[3] || '',
          medidas: cols[4] || '',
          colores: cols[5] || '',
          precioEfectivo: parseMoney(cols[7]),
          precioLista: parseMoney(cols[8]),
          señaFija: parseMoney(cols[9]),
          señaPct: parseMoney(cols[10]),
          cuotas3: parseMoney(cols[11]),
          cuotas6: parseMoney(cols[12]),
          diasEntrega: parseInt(cols[13]) || 7,
          activo: cols[14]?.toUpperCase() === 'SI',
          notas: cols[15] || '',
        } as Producto
      })
      .filter((p): p is Producto => p !== null && p.activo)
  } catch {
    return []
  }
}

function formatPeso(n: number) {
  return n > 0 ? `$${n.toLocaleString('es-AR')}` : '—'
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const productos = await getProductos()
  const p = productos.find(x => x.slug === slug)
  if (!p) return { title: 'Producto no encontrado — TresDeco' }
  return {
    title: `${p.nombre} — TresDeco Amoblamientos`,
    description: p.descripcion,
  }
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const productos = await getProductos()
  const p = productos.find(x => x.slug === slug)
  if (!p) notFound()

  const seña = p.señaFija > 0 ? p.señaFija : Math.round(p.precioEfectivo * p.señaPct / 100)
  const resto = p.precioEfectivo - seña

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white">
      {/* Header */}
      <header className="border-b border-[#2E2E2B] px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#C9B99A] flex items-center justify-center text-[#1A1A18] font-bold text-xs">TD</div>
        <span className="font-semibold tracking-wide text-[#C9B99A]" style={{ fontFamily: 'var(--font-display)' }}>TresDeco Amoblamientos</span>
        <span className="text-[#666] text-xs ml-auto">Córdoba, Argentina</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Foto placeholder */}
        <div className="w-full aspect-[4/3] rounded-2xl bg-[#2E2E2B] flex items-center justify-center overflow-hidden">
          <div className="text-center text-[#555]">
            <div className="text-4xl mb-2">🪑</div>
            <p className="text-sm">Foto próximamente</p>
          </div>
        </div>

        {/* Nombre y categoría */}
        <div>
          <p className="text-[#C9B99A] text-xs uppercase tracking-widest mb-1">{p.categoria}</p>
          <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{p.nombre}</h1>
          <p className="text-[#aaa] mt-2 text-sm leading-relaxed">{p.descripcion}</p>
        </div>

        {/* Medidas y colores */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#2E2E2B] rounded-xl p-4">
            <p className="text-[#888] text-xs mb-1">Medidas</p>
            <p className="text-sm font-medium">{p.medidas || '—'}</p>
          </div>
          <div className="bg-[#2E2E2B] rounded-xl p-4">
            <p className="text-[#888] text-xs mb-1">Colores</p>
            <p className="text-sm font-medium">{p.colores || '—'}</p>
          </div>
          <div className="bg-[#2E2E2B] rounded-xl p-4">
            <p className="text-[#888] text-xs mb-1">Entrega</p>
            <p className="text-sm font-medium">{p.diasEntrega} días hábiles</p>
          </div>
          <div className="bg-[#2E2E2B] rounded-xl p-4">
            <p className="text-[#888] text-xs mb-1">Material</p>
            <p className="text-sm font-medium">MDF 18mm FAPLAC</p>
          </div>
        </div>

        {/* Precios */}
        <div className="bg-[#2E2E2B] rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#C9B99A] uppercase tracking-wider">Precios</h2>
          <div className="flex justify-between items-center">
            <span className="text-[#aaa] text-sm">Efectivo / Transferencia</span>
            <span className="text-xl font-bold">{formatPeso(p.precioEfectivo)}</span>
          </div>
          {p.cuotas3 > 0 && (
            <div className="flex justify-between items-center border-t border-[#3a3a37] pt-3">
              <span className="text-[#aaa] text-sm">3 cuotas sin interés</span>
              <span className="font-semibold">{formatPeso(p.cuotas3)} <span className="text-[#888] text-xs font-normal">c/u</span></span>
            </div>
          )}
          {p.cuotas6 > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[#aaa] text-sm">6 cuotas</span>
              <span className="font-semibold">{formatPeso(p.cuotas6)} <span className="text-[#888] text-xs font-normal">c/u</span></span>
            </div>
          )}
        </div>

        {/* Seña */}
        <div className="bg-[#1e2e20] border border-[#2d4a30] rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[#7ec880] uppercase tracking-wider mb-1">Reservá tu mueble ahora</h2>
            <p className="text-[#aaa] text-sm">Señá con <span className="text-white font-semibold">{formatPeso(seña)}</span> y empezamos a fabricar. El resto ({formatPeso(resto)}) lo abonás al retirar o recibir.</p>
          </div>

          <div className="bg-[#1A1A18] rounded-xl p-4 space-y-2">
            <p className="text-xs text-[#888] uppercase tracking-wider">Datos para transferir</p>
            <div className="flex justify-between items-center">
              <span className="text-[#aaa] text-sm">Alias</span>
              <span className="font-mono font-semibold text-[#C9B99A]">{ALIAS_CBU}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#aaa] text-sm">Titular</span>
              <span className="text-sm">{TITULAR}</span>
            </div>
            <div className="flex justify-between items-center border-t border-[#2E2E2B] pt-2 mt-1">
              <span className="text-[#aaa] text-sm">Monto seña</span>
              <span className="text-lg font-bold text-[#7ec880]">{formatPeso(seña)}</span>
            </div>
          </div>

          <a
            href={`https://wa.me/5493513579013?text=${encodeURIComponent(`Hola! Quiero reservar el ${p.nombre}. Ya transferí la seña de ${formatPeso(seña)}. Les mando el comprobante.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-[#25D366] text-white font-semibold py-3 rounded-xl hover:bg-[#22c35e] transition-colors"
          >
            Enviar comprobante por WhatsApp
          </a>
          <p className="text-xs text-[#666] text-center">Una vez confirmada la seña, coordinamos la fecha de entrega.</p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[#555] pb-4 space-y-1">
          <p>TresDeco Amoblamientos — Fábrica propia en Villa Cabrera, Córdoba</p>
          <p>+50 reseñas 5 estrellas en Google</p>
        </div>
      </main>
    </div>
  )
}
