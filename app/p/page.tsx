import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Catálogo — TresDeco Amoblamientos',
  description: 'Muebles de diseño fabricados en Córdoba. Zapatero Slim, Camabox y más.',
}

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1TaaG04ZHAKara64_1XmyIM8NABWX78uZvgkp7phQntE/export?format=csv&gid=0'

function parseCSVRow(line: string): string[] {
  const fields: string[] = []; let cur = ''; let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
    else cur += c
  }
  fields.push(cur.trim()); return fields
}
function slugify(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }
function parseMoney(v: string): number { return parseInt((v||'').replace(/[^0-9]/g,'')) || 0 }
function formatPeso(n: number) { return n > 0 ? `$${n.toLocaleString('es-AR')}` : '—' }

const FALLBACK_LISTA = [
  { nombre:'Zapatero Slim', categoria:'Zapatero', medidas:'120×90×14 cm', precioEfectivo:165000, activo:true },
  { nombre:'Camabox 1 plaza', categoria:'Cama', medidas:'80/90×190 cm', precioEfectivo:354360, activo:true },
  { nombre:'Camabox 1.5 plaza', categoria:'Cama', medidas:'100/120×190 cm', precioEfectivo:473000, activo:true },
  { nombre:'Camabox 2 plazas 140×190', categoria:'Cama', medidas:'140×190 cm', precioEfectivo:628320, activo:true },
  { nombre:'Camabox 2 plazas 160×190', categoria:'Cama', medidas:'160×190 cm', precioEfectivo:688470, activo:true },
  { nombre:'Camabox Queen', categoria:'Cama', medidas:'160×200 cm', precioEfectivo:733125, activo:true },
  { nombre:'Camabox King', categoria:'Cama', medidas:'180×200 cm', precioEfectivo:796600, activo:true },
  { nombre:'Camabox Superking', categoria:'Cama', medidas:'200×200 cm', precioEfectivo:830000, activo:true },
]

async function getProductos() {
  try {
    const res = await fetch(SHEET_CSV, { next: { revalidate: 3600 } })
    if (res.ok) {
      const csv = await res.text()
      const rows = csv.split('\n').slice(1)
        .map(row => {
          const cols = parseCSVRow(row)
          if (!cols[0]) return null
          return { slug: slugify(cols[0]), nombre: cols[0], categoria: cols[2]||'', medidas: cols[4]||'', precioEfectivo: parseMoney(cols[7]), activo: cols[14]?.toUpperCase() === 'SI' }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null && p.activo)
      if (rows.length > 0) return rows
    }
  } catch { /* fallback */ }
  return FALLBACK_LISTA.map(p => ({ ...p, slug: slugify(p.nombre) }))
}

const CATEGORIA_ICON: Record<string, string> = {
  'Zapatero': '👟',
  'Cama': '🛏',
  'Cama+Respaldo y mesas de luz': '🛏',
  'Rack / Living': '📺',
  'Repisa': '📚',
}

export default async function CatalogoPage() {
  const productos = await getProductos()

  const categorias = Array.from(new Set(productos.map(p => p.categoria)))

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white">
      <header className="border-b border-[#2E2E2B] px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#C9B99A] flex items-center justify-center text-[#1A1A18] font-bold text-xs">TD</div>
        <span className="font-semibold tracking-wide text-[#C9B99A]" style={{ fontFamily: 'var(--font-display)' }}>TresDeco Amoblamientos</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Nuestros productos</h1>
          <p className="text-[#aaa] text-sm">Fabricación propia en Córdoba · Entrega armado · Sin intermediarios</p>
        </div>

        <div className="space-y-8">
          {categorias.map(cat => (
            <div key={cat}>
              <h2 className="text-xs text-[#C9B99A] uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>{CATEGORIA_ICON[cat] || '🪑'}</span> {cat}
              </h2>
              <div className="space-y-2">
                {productos.filter(p => p.categoria === cat).map(p => (
                  <Link
                    key={p.slug}
                    href={`/p/${p.slug}`}
                    className="flex items-center justify-between bg-[#2E2E2B] hover:bg-[#3a3a37] rounded-xl px-4 py-4 transition-colors group"
                  >
                    <div>
                      <p className="font-medium text-sm group-hover:text-[#C9B99A] transition-colors">{p.nombre}</p>
                      {p.medidas && <p className="text-[#888] text-xs mt-0.5">{p.medidas}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatPeso(p.precioEfectivo)}</p>
                      <p className="text-[#888] text-xs">efectivo</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center text-xs text-[#555] space-y-1">
          <p>TresDeco Amoblamientos · Villa Cabrera, Córdoba</p>
          <a href="https://wa.me/5493513579013" className="text-[#C9B99A] hover:underline">Consultar por WhatsApp</a>
        </div>
      </main>
    </div>
  )
}
