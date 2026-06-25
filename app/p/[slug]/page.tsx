import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1TaaG04ZHAKara64_1XmyIM8NABWX78uZvgkp7phQntE/export?format=csv&gid=0'
const ALIAS_CBU = 'tresdeco.nx.ars'
const TITULAR    = 'Flavia Vitali'
const WAPP_NUM   = '5493513579013'
const HORARIO    = 'Lunes a viernes 9 a 18hs · Sábados 9 a 13hs'

type Producto = {
  slug: string; codigo: string; nombre: string; categoria: string
  descripcion: string; medidas: string; colores: string
  precioEfectivo: number; precioLista: number
  señaFija: number; señaPct: number
  cuotas3: number; cuotas6: number
  diasEntrega: number; activo: boolean; notas: string
  imagenes?: string[]
}

// Fotos por código de producto (se completan con Imgur hasta tener CDN propio)
const FOTOS: Record<string, string[]> = {
  'ZAP-01': [
    'https://i.imgur.com/17rKzZ3.jpeg',
    'https://i.imgur.com/gZEjq1l.jpeg',
    'https://i.imgur.com/IkpyhMy.jpeg',
  ],
}

// ── CSV parser que respeta campos entre comillas ──────────────────────────────
function parseCSVRow(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
    else cur += c
  }
  fields.push(cur.trim())
  return fields
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
}
function parseMoney(v: string): number { return parseInt((v||'').replace(/[^0-9]/g,'')) || 0 }
function formatPeso(n: number) { return n > 0 ? `$${n.toLocaleString('es-AR')}` : '—' }

// ── Productos hardcodeados como fallback si el Sheet no es público ────────────
const FALLBACK: Omit<Producto,'slug'>[] = [
  { codigo:'ZAP-01', nombre:'Zapatero Slim', categoria:'Zapatero', descripcion:'El zapatero más fino de Córdoba. Solo 14cm de profundidad, se funde con la pared y cambia completamente el ambiente de una entrada o pasillo. MDF 18mm con tirador de aluminio real. Se entrega armado.', medidas:'Alto 120cm × Ancho 90cm × Prof 14cm', colores:'Solo blanco', precioEfectivo:165000, precioLista:231000, señaFija:65000, señaPct:0, cuotas3:77000, cuotas6:38500, diasEntrega:5, activo:true, notas:'', imagenes: FOTOS['ZAP-01'] },
  { codigo:'ZAP-02', nombre:'Zapatero Slim 2 puertas', categoria:'Zapatero', descripcion:'Versión más amplia del Zapatero Slim con 2 puertas para mayor capacidad. Mismo diseño minimalista.', medidas:'Alto 120cm × Ancho 180cm × Prof 14cm', colores:'Solo blanco', precioEfectivo:0, precioLista:0, señaFija:0, señaPct:0, cuotas3:0, cuotas6:0, diasEntrega:10, activo:false, notas:'Consultar precio' },
  { codigo:'CAM-01', nombre:'Camabox 1 plaza', categoria:'Cama', descripcion:'Cama funcional de 1 plaza con cajones integrados. MDF 18mm, diseño modular que entra por cualquier puerta. Cajones con guías telescópicas metálicas.', medidas:'80×190 cm ó 90×190 cm', colores:'Ver Carta de Colores FAPLAC', precioEfectivo:354360, precioLista:496104, señaFija:0, señaPct:60, cuotas3:165368, cuotas6:82684, diasEntrega:15, activo:true, notas:'' },
  { codigo:'CAM-02', nombre:'Camabox 1.5 plaza', categoria:'Cama', descripcion:'Cama funcional de 1 plaza y media con cajones integrados. MDF 18mm, guías telescópicas, diseño modular.', medidas:'100×190 cm ó 120×190 cm', colores:'Ver Carta de Colores FAPLAC', precioEfectivo:473000, precioLista:662200, señaFija:0, señaPct:60, cuotas3:220733, cuotas6:110367, diasEntrega:15, activo:true, notas:'' },
  { codigo:'CAM-03', nombre:'Camabox 2 plazas 140×190', categoria:'Cama', descripcion:'Cama funcional de 2 plazas con cajones integrados. MDF 18mm, guías telescópicas.', medidas:'140×190 cm', colores:'Ver Carta de Colores FAPLAC', precioEfectivo:628320, precioLista:879648, señaFija:0, señaPct:60, cuotas3:293216, cuotas6:146608, diasEntrega:15, activo:true, notas:'' },
  { codigo:'CAM-04', nombre:'Camabox 2 plazas 160×190', categoria:'Cama', descripcion:'Cama funcional de 2 plazas con cajones integrados. MDF 18mm, guías telescópicas.', medidas:'160×190 cm', colores:'Ver Carta de Colores FAPLAC', precioEfectivo:688470, precioLista:963858, señaFija:0, señaPct:60, cuotas3:321286, cuotas6:160643, diasEntrega:15, activo:true, notas:'' },
  { codigo:'CAM-05', nombre:'Camabox Queen', categoria:'Cama', descripcion:'Camabox tamaño Queen. Base funcional con cajones. MDF 18mm, diseño modular.', medidas:'160×200 cm', colores:'Ver Carta de Colores FAPLAC', precioEfectivo:733125, precioLista:1026375, señaFija:0, señaPct:60, cuotas3:342125, cuotas6:171063, diasEntrega:15, activo:true, notas:'' },
  { codigo:'CAM-06', nombre:'Camabox King', categoria:'Cama', descripcion:'Camabox tamaño King. Base funcional con cajones. MDF 18mm premium, diseño modular.', medidas:'180×200 cm', colores:'Ver Carta de Colores FAPLAC', precioEfectivo:796600, precioLista:1115240, señaFija:0, señaPct:60, cuotas3:371747, cuotas6:185873, diasEntrega:15, activo:true, notas:'' },
  { codigo:'CAM-07', nombre:'Camabox Superking', categoria:'Cama', descripcion:'Camabox Superking. La opción más grande. Base funcional con cajones, MDF 18mm.', medidas:'200×200 cm', colores:'Ver Carta de Colores FAPLAC', precioEfectivo:830000, precioLista:1162000, señaFija:0, señaPct:60, cuotas3:387333, cuotas6:193667, diasEntrega:15, activo:true, notas:'' },
]

async function getProductos(): Promise<Producto[]> {
  try {
    const res = await fetch(SHEET_CSV, { next: { revalidate: 3600 } })
    if (res.ok) {
      const csv = await res.text()
      const rows = csv.split('\n').slice(1)
      const fromSheet = rows
        .map(row => {
          const c = parseCSVRow(row)
          if (!c[0]) return null
          return {
            slug: slugify(c[0]),
            codigo: c[1] || '',
            nombre: c[0],
            categoria: c[2] || '',
            descripcion: c[3] || '',
            medidas: c[4] || '',
            colores: c[5] || '',
            precioEfectivo: parseMoney(c[7]),
            precioLista: parseMoney(c[8]),
            señaFija: parseMoney(c[9]),
            señaPct: parseMoney(c[10]),
            cuotas3: parseMoney(c[11]),
            cuotas6: parseMoney(c[12]),
            diasEntrega: parseInt(c[13]) || 7,
            activo: c[14]?.toUpperCase() === 'SI',
            notas: c[15] || '',
            imagenes: FOTOS[c[1]] ?? [],
          } as Producto
        })
        .filter((p): p is Producto => p !== null && p.activo)
      if (fromSheet.length > 0) return fromSheet
    }
  } catch { /* fallback */ }
  return FALLBACK.filter(p => p.activo).map(p => ({ ...p, slug: slugify(p.nombre) }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const productos = await getProductos()
  const p = productos.find(x => x.slug === slug)
  if (!p) return { title: 'Producto no encontrado — TresDeco' }
  return { title: `${p.nombre} — TresDeco Amoblamientos`, description: p.descripcion }
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const productos = await getProductos()
  const p = productos.find(x => x.slug === slug)
  if (!p) notFound()

  const seña = p.señaFija > 0 ? p.señaFija : Math.round(p.precioEfectivo * p.señaPct / 100)
  const resto = p.precioEfectivo - seña

  const wappMsg = encodeURIComponent(`Hola! Quiero reservar el ${p.nombre}. Ya transferí la seña de ${formatPeso(seña)} al alias ${ALIAS_CBU}. Les mando el comprobante.`)

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white">
      {/* Header */}
      <header className="border-b border-[#2E2E2B] px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#C9B99A] flex items-center justify-center text-[#1A1A18] font-bold text-xs">TD</div>
        <span className="font-semibold tracking-wide text-[#C9B99A]" style={{fontFamily:'var(--font-display)'}}>TresDeco Amoblamientos</span>
        <span className="text-[#555] text-xs ml-auto hidden sm:block">{HORARIO}</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Imagen / Galería */}
        {p.imagenes && p.imagenes.length > 0 ? (
          <div className="space-y-2">
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#2E2E2B]">
              <img src={p.imagenes[0]} alt={p.nombre} className="w-full h-full object-cover" />
            </div>
            {p.imagenes.length > 1 && (
              <div className="flex gap-2">
                {p.imagenes.slice(1).map((img, i) => (
                  <div key={i} className="flex-1 aspect-square rounded-xl overflow-hidden bg-[#2E2E2B]">
                    <img src={img} alt={`${p.nombre} ${i + 2}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-[4/3] rounded-2xl bg-[#2E2E2B] flex items-center justify-center overflow-hidden">
            <div className="text-center text-[#444]">
              <p className="text-5xl mb-2">🛏</p>
              <p className="text-xs">Foto próximamente</p>
            </div>
          </div>
        )}

        {/* Nombre */}
        <div>
          <p className="text-[#C9B99A] text-xs uppercase tracking-widest mb-1">{p.categoria}</p>
          <h1 className="text-2xl font-bold" style={{fontFamily:'var(--font-display)'}}>{p.nombre}</h1>
          <p className="text-[#aaa] text-sm mt-2 leading-relaxed">{p.descripcion}</p>
        </div>

        {/* Características */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label:'Medidas', value: p.medidas },
            { label:'Colores', value: p.colores },
            { label:'Entrega', value: `${p.diasEntrega} días hábiles` },
            { label:'Material', value: 'MDF 18mm FAPLAC' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#2E2E2B] rounded-xl p-3.5">
              <p className="text-[#777] text-xs mb-1">{label}</p>
              <p className="text-sm font-medium">{value || '—'}</p>
            </div>
          ))}
        </div>

        {/* Precios */}
        {p.precioEfectivo > 0 && (
          <div className="bg-[#2E2E2B] rounded-2xl p-5 space-y-3">
            <p className="text-xs text-[#C9B99A] uppercase tracking-wider font-semibold">Precios</p>
            <div className="flex justify-between items-baseline">
              <span className="text-[#aaa] text-sm">Efectivo / Transferencia</span>
              <span className="text-2xl font-bold">{formatPeso(p.precioEfectivo)}</span>
            </div>
            {p.cuotas3 > 0 && (
              <div className="flex justify-between items-center border-t border-[#3a3a37] pt-3">
                <span className="text-[#aaa] text-sm">3 cuotas sin interés</span>
                <span className="font-semibold">{formatPeso(p.cuotas3)} <span className="text-[#777] text-xs font-normal">c/u</span></span>
              </div>
            )}
            {p.cuotas6 > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[#aaa] text-sm">6 cuotas</span>
                <span className="font-semibold">{formatPeso(p.cuotas6)} <span className="text-[#777] text-xs font-normal">c/u</span></span>
              </div>
            )}
          </div>
        )}

        {/* Seña */}
        {seña > 0 && (
          <div className="bg-[#1a2e1c] border border-[#2d5030] rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs text-[#7ec880] uppercase tracking-wider font-semibold mb-1">Reservá ahora</p>
              <p className="text-[#bbb] text-sm">
                Señá con <span className="text-white font-semibold">{formatPeso(seña)}</span> y arrancamos a fabricar.
                El resto ({formatPeso(resto)}) lo abonás al retirar.
              </p>
            </div>

            {/* Datos bancarios */}
            <div className="bg-[#1A1A18] rounded-xl p-4 space-y-2.5">
              <p className="text-xs text-[#666] uppercase tracking-wider">Datos para transferir</p>
              <div className="flex justify-between">
                <span className="text-[#888] text-sm">Alias</span>
                <span className="font-mono font-semibold text-[#C9B99A] text-sm">{ALIAS_CBU}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888] text-sm">Titular</span>
                <span className="text-sm">{TITULAR}</span>
              </div>
              <div className="flex justify-between border-t border-[#2E2E2B] pt-2.5">
                <span className="text-[#888] text-sm">Monto seña</span>
                <span className="text-xl font-bold text-[#7ec880]">{formatPeso(seña)}</span>
              </div>
            </div>

            {/* CTA */}
            <a
              href={`https://wa.me/${WAPP_NUM}?text=${wappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-semibold py-3.5 rounded-xl hover:bg-[#22c35e] transition-colors text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enviar comprobante por WhatsApp
            </a>

            <p className="text-xs text-[#555] text-center">
              Horario de atención: {HORARIO}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-[#444] pb-4 space-y-1 pt-2">
          <p>TresDeco Amoblamientos · Villa Cabrera, Córdoba</p>
          <p>Fábrica propia · +50 reseñas 5 ⭐ en Google</p>
        </div>
      </main>
    </div>
  )
}
