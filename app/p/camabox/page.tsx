'use client'
import { useState } from 'react'
import Link from 'next/link'

const ALIAS_CBU = 'tresdeco.nx.ars'
const TITULAR   = 'Flavia Vitali'
const WAPP_NUM  = '5493513579013'
const HORARIO   = 'Lunes a viernes 9 a 18hs · Sábados 9 a 13hs'

const MEDIDAS = [
  { id: 'cam-01', label: '1 plaza',        detalle: '80×190 ó 90×190 cm',   efectivo: 354360,  lista: 496104,  cuotas3: 165368, cuotas6: 82684  },
  { id: 'cam-02', label: '1½ plaza',       detalle: '100×190 ó 120×190 cm', efectivo: 473000,  lista: 662200,  cuotas3: 220733, cuotas6: 110367 },
  { id: 'cam-03', label: '2 plazas',       detalle: '140×190 cm',           efectivo: 628320,  lista: 879648,  cuotas3: 293216, cuotas6: 146608 },
  { id: 'cam-04', label: '2 plazas',       detalle: '160×190 cm',           efectivo: 688470,  lista: 963858,  cuotas3: 321286, cuotas6: 160643 },
  { id: 'cam-05', label: 'Queen',          detalle: '160×200 cm',           efectivo: 733125,  lista: 1026375, cuotas3: 342125, cuotas6: 171063 },
  { id: 'cam-06', label: 'King',           detalle: '180×200 cm',           efectivo: 796600,  lista: 1115240, cuotas3: 371747, cuotas6: 185873 },
  { id: 'cam-07', label: 'Superking',      detalle: '200×200 cm',           efectivo: 830000,  lista: 1162000, cuotas3: 387333, cuotas6: 193667 },
]

const COLORES = [
  { nombre: 'Camellia',      img: 'https://i.imgur.com/4cJ7OX7.png' },
  { nombre: 'Gris Caliza',   img: 'https://i.imgur.com/zGiIz1N.png' },
  { nombre: 'Blanco Tundra', img: 'https://i.imgur.com/1Zn3AnB.png' },
  { nombre: 'Scotch',        img: 'https://i.imgur.com/GAFSgLb.png' },
]

const FOTOS = [
  'https://i.imgur.com/dMYyFcf.jpeg',
  'https://i.imgur.com/oOs57GS.jpeg',
  'https://i.imgur.com/DOOb9Wz.jpeg',
]

function fmt(n: number) { return `$${n.toLocaleString('es-AR')}` }

export default function CamaboxPage() {
  const [selIdx, setSelIdx] = useState(2) // default: 2 plazas 140
  const m = MEDIDAS[selIdx]
  const seña = Math.round(m.efectivo * 0.6)
  const resto = m.efectivo - seña
  const wappMsg = encodeURIComponent(`Hola! Quiero reservar el Camabox ${m.label} (${m.detalle}). Ya transferí la seña de ${fmt(seña)} al alias ${ALIAS_CBU}. Les mando el comprobante.`)

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white">
      <header className="border-b border-[#2E2E2B] px-5 py-4 flex items-center gap-3">
        <Link href="/p" className="w-8 h-8 rounded-full bg-[#C9B99A] flex items-center justify-center text-[#1A1A18] font-bold text-xs">TD</Link>
        <span className="font-semibold tracking-wide text-[#C9B99A]">TresDeco Amoblamientos</span>
        <span className="text-[#555] text-xs ml-auto hidden sm:block">{HORARIO}</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="md:flex md:gap-10 md:items-start space-y-5 md:space-y-0">

          {/* Fotos */}
          <div className="md:w-1/2 md:sticky md:top-6 space-y-2 shrink-0">
            <div className="w-full aspect-[3/4] md:aspect-[4/5] rounded-2xl overflow-hidden bg-[#2E2E2B]">
              <img src={FOTOS[0]} alt="Camabox" className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex gap-2">
              {FOTOS.slice(1).map((img, i) => (
                <div key={i} className="flex-1 aspect-square rounded-xl overflow-hidden bg-[#2E2E2B]">
                  <img src={img} alt={`Camabox ${i+2}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <p className="text-[#555] text-xs text-center">Foto referencial · fabricamos en todas las medidas</p>
          </div>

          {/* Datos */}
          <div className="md:w-1/2 space-y-5">
            <div>
              <p className="text-[#C9B99A] text-xs uppercase tracking-widest mb-1">Cama</p>
              <h1 className="text-2xl font-bold">Camabox</h1>
              <p className="text-[#aaa] text-sm mt-2 leading-relaxed">
                Cama funcional con cajones integrados. MDF 18mm, guías telescópicas metálicas. Se entrega armada y entra por cualquier puerta.
              </p>
            </div>

            {/* Selector de medida */}
            <div className="space-y-2">
              <p className="text-xs text-[#C9B99A] uppercase tracking-wider font-semibold">Elegí tu medida</p>
              <div className="grid grid-cols-2 gap-2">
                {MEDIDAS.map((med, i) => (
                  <button
                    key={med.id}
                    onClick={() => setSelIdx(i)}
                    className={`text-left rounded-xl px-4 py-3 border transition-all ${
                      selIdx === i
                        ? 'border-[#C9B99A] bg-[#C9B99A]/10 text-white'
                        : 'border-[#3a3a37] bg-[#2E2E2B] text-[#aaa] hover:border-[#C9B99A]/50'
                    }`}
                  >
                    <p className="font-semibold text-sm">{med.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{med.detalle}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Info de medida seleccionada */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Medida', value: m.detalle },
                { label: 'Colores', value: 'Ver carta FAPLAC' },
                { label: 'Entrega', value: '15 días hábiles' },
                { label: 'Material', value: 'MDF 18mm FAPLAC' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#2E2E2B] rounded-xl p-3.5">
                  <p className="text-[#777] text-xs mb-1">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>

            {/* Colores */}
            <div className="space-y-3">
              <p className="text-xs text-[#C9B99A] uppercase tracking-wider font-semibold">Colores disponibles</p>
              <div className="grid grid-cols-4 gap-2">
                {COLORES.map(c => (
                  <div key={c.nombre} className="text-center">
                    <div className="rounded-xl overflow-hidden aspect-square border border-[#3a3a37]">
                      <img src={c.img} alt={c.nombre} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[#aaa] text-xs mt-1.5 leading-tight">{c.nombre}</p>
                  </div>
                ))}
              </div>
              <p className="text-[#555] text-xs">¿Otro color? Lo personalizamos con un pequeño recargo — consultanos.</p>
            </div>

            {/* Precios — actualizan con la medida */}
            <div className="bg-[#2E2E2B] rounded-2xl p-5 space-y-3">
              <p className="text-xs text-[#C9B99A] uppercase tracking-wider font-semibold">Precios</p>
              <div className="flex justify-between items-baseline">
                <span className="text-[#aaa] text-sm">Efectivo / Transferencia</span>
                <span className="text-2xl font-bold transition-all">{fmt(m.efectivo)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[#3a3a37] pt-3">
                <span className="text-[#aaa] text-sm">3 cuotas sin interés</span>
                <span className="font-semibold">{fmt(m.cuotas3)} <span className="text-[#777] text-xs font-normal">c/u</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#aaa] text-sm">6 cuotas</span>
                <span className="font-semibold">{fmt(m.cuotas6)} <span className="text-[#777] text-xs font-normal">c/u</span></span>
              </div>
            </div>

            {/* Seña */}
            <div className="bg-[#1a2e1c] border border-[#2d5030] rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs text-[#7ec880] uppercase tracking-wider font-semibold mb-1">Reservá ahora</p>
                <p className="text-[#bbb] text-sm">
                  Señá con <span className="text-white font-semibold">{fmt(seña)}</span> y arrancamos a fabricar.
                  El resto ({fmt(resto)}) lo abonás al retirar.
                </p>
              </div>
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
                  <span className="text-xl font-bold text-[#7ec880]">{fmt(seña)}</span>
                </div>
              </div>
              <a
                href={`https://wa.me/${WAPP_NUM}?text=${wappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-semibold py-3.5 rounded-xl hover:bg-[#22c35e] transition-colors text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar comprobante por WhatsApp
              </a>
              <p className="text-xs text-[#555] text-center">{HORARIO}</p>
            </div>

            <div className="text-center text-xs text-[#444] pb-4 space-y-1 pt-2">
              <p>TresDeco Amoblamientos · Villa Cabrera, Córdoba</p>
              <p>Fábrica propia · +50 reseñas 5 ⭐ en Google</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
