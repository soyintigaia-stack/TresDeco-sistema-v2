'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  type ProductoCatalogo,
  addDiasHabiles, fmtFecha,
  COLORES_DISPONIBLES, ORIGENES_OT,
} from '@/lib/supabase'

const inputClass = "w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50 placeholder-[#444441]"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[#666660] text-xs uppercase tracking-wider block mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function NuevaOTPage() {
  const router = useRouter()
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [form, setForm] = useState({
    cliente: '',
    telefono: '',
    codigo_producto: '',
    color: 'Blanco',
    cantidad: '1',
    origen: 'Manual',
    precio: '',
    precio_sena: '',
    observaciones: '',
    fecha_entrega_comprometida: '',
  })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    supabase.from('productos_catalogo').select('*').eq('activo', true).order('codigo').then(({ data }: { data: ProductoCatalogo[] | null }) => {
      if (data) setCatalogo(data)
      setLoading(false)
    })
  }, [])

  const productoSeleccionado = catalogo.find(p => p.codigo === form.codigo_producto)

  // Precio sugerido según producto + color
  const precioSugerido = (() => {
    if (!productoSeleccionado || !productoSeleccionado.precio_base) return null
    const base = productoSeleccionado.precio_base
    const esColorEstandar = form.color === 'Blanco'
    const recargo = productoSeleccionado.recargo_color_pct ?? 0
    return esColorEstandar ? base : Math.round(base * (1 + recargo / 100))
  })()
  const senaSugerida = productoSeleccionado?.precio_sena ?? 0

  useEffect(() => {
    if (productoSeleccionado) {
      const entrega = addDiasHabiles(new Date(), productoSeleccionado.dias_produccion)
      setForm(f => ({ ...f, fecha_entrega_comprometida: entrega.toISOString().split('T')[0] }))
    }
  }, [form.codigo_producto])

  useEffect(() => {
    if (precioSugerido) {
      setForm(f => ({
        ...f,
        precio: String(precioSugerido),
        precio_sena: senaSugerida ? String(senaSugerida) : f.precio_sena,
      }))
    }
  }, [form.codigo_producto, form.color])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    if (!form.cliente.trim()) { showToast('Ingresá el nombre del cliente'); return }
    if (!form.codigo_producto) { showToast('Seleccioná un producto'); return }
    const prod = catalogo.find(p => p.codigo === form.codigo_producto)
    const fechaEntrega = form.fecha_entrega_comprometida ||
      addDiasHabiles(new Date(), prod?.dias_produccion ?? 5).toISOString().split('T')[0]

    setGuardando(true)
    const id = `STD-${Date.now()}`
    const { error } = await supabase.from('ordenes_trabajo').insert({
      id,
      tipo: 'standard',
      cliente: form.cliente.trim(),
      telefono: form.telefono.trim(),
      codigo_producto: form.codigo_producto,
      producto: productoSeleccionado?.nombre ?? '',
      color: form.color,
      cantidad: parseInt(form.cantidad) || 1,
      estado: 'Pendiente',
      etapa_actual: 0,
      fecha_ingreso: new Date().toISOString().split('T')[0],
      fecha_entrega_comprometida: fechaEntrega,
      origen: form.origen,
      precio: parseFloat(form.precio) || 0,
      precio_sena: parseFloat(form.precio_sena) || 0,
      observaciones: form.observaciones.trim() || null,
    })

    if (error) {
      showToast('Error al guardar: ' + error.message)
      setGuardando(false)
      return
    }

    await supabase.from('actividad').insert({
      ot_id: id,
      descripcion: `📦 Nueva OT creada — ${productoSeleccionado?.nombre} para ${form.cliente.trim()} (origen: ${form.origen})`,
      usuario: 'Administración',
    })

    showToast('¡Orden creada! Redirigiendo…')
    setTimeout(() => router.push('/administracion'), 1500)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center">
      <p className="text-[#666660]">Cargando…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 text-white text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">{toast}</div>
      )}

      <div className="sticky top-0 z-40 bg-[#1A1A18]/95 backdrop-blur border-b border-[#2E2E2B]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#666660] hover:text-white text-sm transition-colors">← Volver</button>
          <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-base font-bold">
            tres<span className="text-[#C9B99A]">decó</span>
            <span className="text-[#666660] font-normal text-xs ml-2">Nueva Orden Standard</span>
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Producto */}
        <div className="bg-[#242421] border border-[#2E2E2B] rounded-2xl p-5 space-y-4">
          <p className="text-white font-medium text-sm">Producto</p>

          <Field label="Producto" required>
            <div className="grid grid-cols-1 gap-2">
              {catalogo.map(p => (
                <button key={p.codigo} onClick={() => set('codigo_producto', p.codigo)}
                  className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                    form.codigo_producto === p.codigo
                      ? 'border-[#C9B99A]/50 bg-[#C9B99A]/5'
                      : 'border-[#2E2E2B] bg-[#1A1A18] hover:border-[#3a3a37]'
                  }`}>
                  <div>
                    <p className="text-white text-sm font-medium">{p.nombre}</p>
                    <p className="text-[#666660] text-xs">{p.categoria} · {p.dias_produccion} días hábiles</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    form.codigo_producto === p.codigo ? 'border-[#C9B99A]' : 'border-[#444441]'
                  }`}>
                    {form.codigo_producto === p.codigo && <div className="w-2 h-2 rounded-full bg-[#C9B99A]" />}
                  </div>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Color">
              <select value={form.color} onChange={e => set('color', e.target.value)} className={inputClass}>
                {COLORES_DISPONIBLES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Cantidad">
              <input type="number" min="1" max="20" value={form.cantidad}
                onChange={e => set('cantidad', e.target.value)} className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Cliente */}
        <div className="bg-[#242421] border border-[#2E2E2B] rounded-2xl p-5 space-y-4">
          <p className="text-white font-medium text-sm">Cliente</p>
          <Field label="Nombre completo" required>
            <input value={form.cliente} onChange={e => set('cliente', e.target.value)}
              placeholder="Ej: María González" className={inputClass} />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
              placeholder="Ej: 2616001122" className={inputClass} />
          </Field>
          <Field label="Origen de la venta">
            <select value={form.origen} onChange={e => set('origen', e.target.value)} className={inputClass}>
              {ORIGENES_OT.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </div>

        {/* Fechas y precios */}
        <div className="bg-[#242421] border border-[#2E2E2B] rounded-2xl p-5 space-y-4">
          <p className="text-white font-medium text-sm">Entrega y pago</p>

          <Field label="Fecha de entrega comprometida" required>
            <input type="date" value={form.fecha_entrega_comprometida}
              onChange={e => set('fecha_entrega_comprometida', e.target.value)} className={inputClass} />
            {productoSeleccionado && form.fecha_entrega_comprometida && (
              <p className="text-[#666660] text-xs mt-1">
                Auto-calculado: {productoSeleccionado.dias_produccion} días hábiles desde hoy
                ({fmtFecha(form.fecha_entrega_comprometida)})
              </p>
            )}
          </Field>

          {precioSugerido && (
            <div className="bg-[#C9B99A]/5 border border-[#C9B99A]/20 rounded-xl p-3 text-xs">
              <p className="text-[#C9B99A] font-medium mb-1">Precio sugerido para {form.color}:</p>
              <div className="flex gap-4">
                <span className="text-white">${precioSugerido.toLocaleString('es-AR')} total</span>
                {senaSugerida > 0 && <span className="text-[#666660]">${senaSugerida.toLocaleString('es-AR')} seña</span>}
                {form.color !== 'Blanco' && productoSeleccionado?.recargo_color_pct && (
                  <span className="text-amber-400">+{productoSeleccionado.recargo_color_pct}% color</span>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio total ($)">
              <input type="number" value={form.precio} onChange={e => set('precio', e.target.value)}
                placeholder="0" className={inputClass} />
            </Field>
            <Field label="Seña requerida ($)">
              <input type="number" value={form.precio_sena} onChange={e => set('precio_sena', e.target.value)}
                placeholder="0" className={inputClass} />
            </Field>
          </div>

          <Field label="Observaciones">
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas sobre el pedido, preferencias, etc."
              className={`${inputClass} resize-none h-20`} />
          </Field>
        </div>

        {/* Resumen */}
        {productoSeleccionado && form.cliente && (
          <div className="bg-[#C9B99A]/5 border border-[#C9B99A]/20 rounded-2xl p-5">
            <p className="text-[#C9B99A] text-xs uppercase tracking-wider mb-3">Resumen del pedido</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#666660]">Producto</span>
                <span className="text-white">{productoSeleccionado.nombre} · {form.color}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666660]">Cliente</span>
                <span className="text-white">{form.cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666660]">Entrega</span>
                <span className="text-white">{fmtFecha(form.fecha_entrega_comprometida)}</span>
              </div>
              {form.precio && (
                <div className="flex justify-between">
                  <span className="text-[#666660]">Precio</span>
                  <span className="text-white">${parseFloat(form.precio).toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={guardar} disabled={guardando || !form.cliente.trim() || !form.codigo_producto}
          className="w-full py-4 rounded-2xl bg-[#C9B99A] text-[#1A1A18] font-bold text-base disabled:opacity-40 transition-all hover:bg-[#d4c4a8]">
          {guardando ? 'Guardando…' : 'Crear orden de trabajo'}
        </button>
      </div>
    </div>
  )
}
