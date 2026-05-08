'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase, type OrdenTrabajo, type Alerta,
  ESTADO_COLOR_STANDARD, ESTADO_COLOR_MEDIDA, ESTADOS_MEDIDA,
  fmt, fmtFecha
} from '@/lib/supabase'

const ALERTA_STYLE: Record<string, { dot: string; card: string; text: string; badge: string }> = {
  danger:  { dot: 'bg-red-400',   card: 'border-red-900 bg-red-950/20',    text: 'text-red-200',   badge: 'text-red-400'   },
  warning: { dot: 'bg-amber-400', card: 'border-amber-900 bg-amber-950/20', text: 'text-amber-200', badge: 'text-amber-400' },
  info:    { dot: 'bg-blue-400',  card: 'border-blue-900 bg-blue-950/20',   text: 'text-blue-200',  badge: 'text-blue-400'  },
}

type Vista = 'resumen' | 'standard' | 'medida' | 'alertas'
type FiltroEstado = string | null

export default function DashboardPage() {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>('resumen')
  const [ots, setOts] = useState<OrdenTrabajo[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStd, setFiltroStd] = useState<FiltroEstado>(null)
  const [filtroMed, setFiltroMed] = useState<FiltroEstado>(null)
  const [modalReanudar, setModalReanudar] = useState<OrdenTrabajo | null>(null)
  const [modalEntrega, setModalEntrega] = useState<OrdenTrabajo | null>(null)
  const [modalAvanzarMedida, setModalAvanzarMedida] = useState<OrdenTrabajo | null>(null)
  const [modalHistorial, setModalHistorial] = useState<string | null>(null)
  const [historialData, setHistorialData] = useState<any[]>([])
  const [comentario, setComentario] = useState('')

  const cargar = useCallback(async () => {
    const [{ data: o }, { data: a }] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').order('fecha_entrega_comprometida', { ascending: true }),
      supabase.from('alertas').select('*').eq('resuelta', false).order('created_at', { ascending: false }),
    ])
    if (o) setOts(o)
    if (a) setAlertas(a)
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const c = supabase.channel('dash-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(c) }
  }, [cargar])

  const verHistorial = async (id: string) => {
    setModalHistorial(id)
    const { data } = await supabase.from('actividad').select('*').eq('ot_id', id).order('created_at', { ascending: true })
    if (data) setHistorialData(data)
  }

  const reanudar = async () => {
    if (!modalReanudar || !comentario.trim()) return
    await supabase.from('ordenes_trabajo').update({ estado: 'En producción', observaciones: null, updated_at: new Date().toISOString() }).eq('id', modalReanudar.id)
    await supabase.from('actividad').insert({ ot_id: modalReanudar.id, descripcion: `▶ Reanudado por Dante: ${comentario}`, usuario: 'Dante' })
    await supabase.from('alertas').update({ resuelta: true }).eq('ot_id', modalReanudar.id)
    setModalReanudar(null); setComentario(''); cargar()
  }

  const confirmarEntrega = async () => {
    if (!modalEntrega) return
    await supabase.from('ordenes_trabajo').update({ estado: 'Entregado', fecha_entrega_real: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() }).eq('id', modalEntrega.id)
    await supabase.from('actividad').insert({ ot_id: modalEntrega.id, descripcion: '✅ Entrega confirmada — Cliente retiró el pedido', usuario: 'Dante' })
    await supabase.from('alertas').update({ resuelta: true }).eq('ot_id', modalEntrega.id)
    setModalEntrega(null); cargar()
  }

  const avanzarMedida = async () => {
    if (!modalAvanzarMedida) return
    const idx = ESTADOS_MEDIDA.indexOf(modalAvanzarMedida.estado as any)
    const siguiente = ESTADOS_MEDIDA[idx + 1]
    if (!siguiente) return
    await supabase.from('ordenes_trabajo').update({ estado: siguiente, updated_at: new Date().toISOString() }).eq('id', modalAvanzarMedida.id)
    await supabase.from('actividad').insert({ ot_id: modalAvanzarMedida.id, descripcion: `→ Estado avanzado a: ${siguiente}`, usuario: 'Dante' })
    if (siguiente === 'Corte') {
      await supabase.from('alertas').insert({ tipo: 'info', mensaje: `${modalAvanzarMedida.id} (${modalAvanzarMedida.cliente}) — ${modalAvanzarMedida.producto} pasó a Producción.`, ot_id: modalAvanzarMedida.id })
    }
    setModalAvanzarMedida(null); cargar()
  }

  const resolverAlerta = async (id: string) => {
    await supabase.from('alertas').update({ resuelta: true }).eq('id', id)
    cargar()
  }

  const std = ots.filter(o => o.tipo === 'standard')
  const med = ots.filter(o => o.tipo === 'medida')

  const stdActivas    = std.filter(o => o.estado === 'En producción').length
  const stdListas     = std.filter(o => o.estado === 'Listo').length
  const stdPausadas   = std.filter(o => o.estado === 'Pausado').length
  const stdPendientes = std.filter(o => o.estado === 'Pendiente').length
  const stdEntregadas = std.filter(o => o.estado === 'Entregado').length
  const stdIngresos   = std.filter(o => o.estado === 'Entregado').reduce((s, o) => s + o.precio, 0)

  const medActivas    = med.filter(o => !['Entregado'].includes(o.estado)).length
  const medAprobadas  = med.filter(o => o.estado === 'Aprobado').length
  const medProduccion = med.filter(o => o.estado === 'Producción').length
  const medEntregadas = med.filter(o => o.estado === 'Entregado').length
  const medIngresos   = med.filter(o => o.estado === 'Entregado').reduce((s, o) => s + o.precio, 0)

  const stdFiltradas = filtroStd ? std.filter(o => o.estado === filtroStd) : []
  const medFiltradas = filtroMed ? med.filter(o => o.estado === filtroMed) : []

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A18]">
      <p className="text-zinc-600 text-sm animate-pulse">Cargando sistema...</p>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#1A1A18]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 sticky top-0 z-10 bg-[#1A1A18]">
        <button onClick={() => router.push('/')} style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold hover:opacity-80">
          tres<span className="text-[#C9B99A]">decó</span>
          <span className="text-zinc-600 text-xs font-normal ml-2">sistema operativo</span>
        </button>
        <div className="flex gap-1">
          {(['resumen','standard','medida','alertas'] as Vista[]).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`text-xs px-3 py-1.5 rounded-full transition-all font-medium capitalize ${vista === v ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {v === 'resumen' ? 'Resumen' : v === 'standard' ? 'Estándar' : v === 'medida' ? 'A Medida' : `Alertas${alertas.length > 0 ? ` (${alertas.length})` : ''}`}
            </button>
          ))}
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-[#C9B99A] font-bold">DC</div>
      </div>

      {/* Modales */}
      {modalReanudar && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold mb-1">Reanudar OT</p>
            <p className="text-zinc-500 text-sm mb-4">{modalReanudar.id} — {modalReanudar.cliente}</p>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="¿Cómo se resolvió?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm resize-none h-20 mb-4 focus:outline-none text-white" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setModalReanudar(null); setComentario('') }} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={reanudar} disabled={!comentario.trim()} className="bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-2.5 rounded-xl text-sm font-bold disabled:opacity-40">Reanudar ▶</button>
            </div>
          </div>
        </div>
      )}

      {modalEntrega && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold mb-3">Confirmar entrega</p>
            <p className="text-zinc-400 text-sm mb-6">¿El cliente ya retiró su <span className="text-white font-bold">{modalEntrega.producto}</span>?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setModalEntrega(null)} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={confirmarEntrega} className="bg-emerald-950 border border-emerald-800 text-emerald-300 py-2.5 rounded-xl text-sm font-bold">Confirmar ✅</button>
            </div>
          </div>
        </div>
      )}

      {modalAvanzarMedida && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold mb-1">Avanzar estado</p>
            <p className="text-zinc-500 text-sm mb-2">{modalAvanzarMedida.codigo_proyecto} — {modalAvanzarMedida.cliente}</p>
            <p className="text-zinc-400 text-sm mb-6">
              Cambiar de <span className="text-white font-bold">{modalAvanzarMedida.estado}</span> a{' '}
              <span className="text-[#C9B99A] font-bold">{ESTADOS_MEDIDA[ESTADOS_MEDIDA.indexOf(modalAvanzarMedida.estado as any) + 1]}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setModalAvanzarMedida(null)} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={avanzarMedida} className="bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-2.5 rounded-xl text-sm font-bold">Confirmar →</button>
            </div>
          </div>
        </div>
      )}

      {modalHistorial && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold">Historial {modalHistorial}</p>
              <button onClick={() => { setModalHistorial(null); setHistorialData([]) }} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {historialData.map(h => (
                <div key={h.id} className="flex gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-zinc-300 font-medium">{h.descripcion}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{h.usuario} · {fmt(h.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-5 max-w-6xl mx-auto w-full">

        {/* RESUMEN */}
        {vista === 'resumen' && (
          <div className="flex flex-col gap-5">
            {/* Estándar */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold text-white">Productos Estándar</h2>
                <button onClick={() => setVista('standard')} className="text-xs text-[#C9B99A] hover:underline">Ver todo →</button>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { l: 'En producción', v: stdActivas,    c: 'text-blue-300',    e: 'En producción' },
                  { l: 'Listos',        v: stdListas,     c: 'text-[#C9B99A]',   e: 'Listo'         },
                  { l: 'Pausados',      v: stdPausadas,   c: 'text-amber-400',   e: 'Pausado'       },
                  { l: 'Pendientes',    v: stdPendientes, c: 'text-zinc-400',    e: 'Pendiente'     },
                  { l: 'Entregados',    v: stdEntregadas, c: 'text-emerald-400', e: 'Entregado'     },
                  { l: 'Ingresos',      v: `$${(stdIngresos/1000).toFixed(0)}k`, c: 'text-emerald-300', e: null },
                ].map(m => (
                  <button key={m.l}
                    onClick={() => { if (m.e) { setVista('standard'); setFiltroStd(filtroStd === m.e ? null : m.e) } }}
                    className={`bg-zinc-900 border rounded-xl px-3 py-3 text-center transition-all ${m.e ? 'cursor-pointer hover:border-zinc-600' : 'cursor-default'} border-zinc-800`}>
                    <p style={{ fontFamily: 'var(--font-display)' }} className={`text-2xl font-bold ${m.c}`}>{m.v}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{m.l}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t border-zinc-800" />

            {/* A Medida */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold text-white">Muebles A Medida</h2>
                <button onClick={() => setVista('medida')} className="text-xs text-[#C9B99A] hover:underline">Ver todo →</button>
                <button onClick={() => router.push('/relevamiento')} className="text-xs text-purple-400 hover:underline ml-auto">+ Nuevo relevamiento</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { l: 'En curso',     v: medActivas,    c: 'text-blue-300'    },
                  { l: 'Para aprobar', v: medAprobadas,  c: 'text-teal-300'    },
                  { l: 'Producción',   v: medProduccion, c: 'text-[#C9B99A]'   },
                  { l: 'Entregados',   v: medEntregadas, c: 'text-emerald-400' },
                  { l: 'Ingresos',     v: `$${(medIngresos/1000).toFixed(0)}k`, c: 'text-emerald-300' },
                ].map(m => (
                  <div key={m.l} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-center">
                    <p style={{ fontFamily: 'var(--font-display)' }} className={`text-2xl font-bold ${m.c}`}>{m.v}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{m.l}</p>
                  </div>
                ))}
              </div>

              {/* Proyectos a medida recientes */}
              <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Proyectos activos</p>
                </div>
                {med.filter(o => o.estado !== 'Entregado').slice(0, 5).map((ot, i) => {
                  const color = ESTADO_COLOR_MEDIDA[ot.estado] ?? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  const idx = ESTADOS_MEDIDA.indexOf(ot.estado as any)
                  const pct = idx >= 0 ? Math.round((idx / (ESTADOS_MEDIDA.length - 1)) * 100) : 0
                  return (
                    <div key={ot.id} className={`flex items-center gap-3 px-5 py-3 border-b border-zinc-800/40 last:border-0 ${i%2===0?'':'bg-zinc-800/20'}`}>
                      <span className="text-[10px] text-[#C9B99A] font-mono min-w-[80px]">{ot.codigo_proyecto}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{ot.cliente}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{ot.producto}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 min-w-[52px]">
                        <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-600">{pct}%</span>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${color}`}>{ot.estado}</span>
                      {idx < ESTADOS_MEDIDA.length - 1 && (
                        <button onClick={() => setModalAvanzarMedida(ot)}
                          className="text-[10px] px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 whitespace-nowrap">
                          Avanzar →
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Alertas resumen */}
            {alertas.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Alertas activas</p>
                  <span className="text-[10px] bg-red-900 text-red-300 px-2 py-0.5 rounded-full font-bold">{alertas.length}</span>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {alertas.slice(0, 4).map(a => {
                    const s = ALERTA_STYLE[a.tipo]
                    return (
                      <div key={a.id} className={`flex gap-3 items-start p-3 rounded-xl border ${s.card}`}>
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${s.dot}`} />
                        <p className={`text-sm leading-snug flex-1 font-medium ${s.text}`}>{a.mensaje}</p>
                        <button onClick={() => resolverAlerta(a.id)} className={`text-[11px] font-bold ${s.badge}`}>✓</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ESTÁNDAR */}
        {vista === 'standard' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold">Productos Estándar</h2>
              {filtroStd && <button onClick={() => setFiltroStd(null)} className="text-xs text-zinc-500 hover:text-zinc-300">Limpiar filtro ✕</button>}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { l: 'En producción', v: stdActivas,    c: 'text-blue-300',    e: 'En producción' },
                { l: 'Listos',        v: stdListas,     c: 'text-[#C9B99A]',   e: 'Listo'         },
                { l: 'Pausados',      v: stdPausadas,   c: 'text-amber-400',   e: 'Pausado'       },
                { l: 'Pendientes',    v: stdPendientes, c: 'text-zinc-400',    e: 'Pendiente'     },
                { l: 'Entregados',    v: stdEntregadas, c: 'text-emerald-400', e: 'Entregado'     },
                { l: 'Ingresos',      v: `$${(stdIngresos/1000).toFixed(0)}k`, c: 'text-emerald-300', e: null },
              ].map(m => (
                <button key={m.l}
                  onClick={() => m.e ? setFiltroStd(filtroStd === m.e ? null : m.e) : null}
                  className={`bg-zinc-900 border rounded-xl px-3 py-3 text-center transition-all ${
                    filtroStd === m.e ? 'border-[#C9B99A]' : 'border-zinc-800 hover:border-zinc-600'
                  } ${m.e ? 'cursor-pointer' : 'cursor-default'}`}>
                  <p style={{ fontFamily: 'var(--font-display)' }} className={`text-2xl font-bold ${m.c}`}>{m.v}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{m.l}</p>
                </button>
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{filtroStd ?? 'Todas las órdenes'}</p>
                <span className="text-[10px] text-zinc-600">{(filtroStd ? stdFiltradas : std).length} registros</span>
              </div>
              {(filtroStd ? stdFiltradas : std).map((ot, i) => {
                const total = ['02','03'].includes(ot.codigo_producto ?? '') ? 5 : 4
                const pct = Math.round((ot.etapa_actual / total) * 100)
                const color = ESTADO_COLOR_STANDARD[ot.estado] ?? ''
                return (
                  <div key={ot.id}>
                    <div className={`flex items-center gap-3 px-5 py-4 border-b border-zinc-800/40 ${i%2===0?'':'bg-zinc-800/20'}`}>
                      <span className="text-[11px] text-zinc-600 font-mono min-w-[52px]">{ot.id}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{ot.cliente}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{ot.producto} · {ot.color}</p>
                        {ot.estado === 'Pausado' && ot.observaciones && <p className="text-[11px] text-amber-400 truncate">⚠️ {ot.observaciones}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 min-w-[52px]">
                        <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#C9B99A]/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-600">{pct}%</span>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${color}`}>{ot.estado}</span>
                      <span className="text-[11px] text-zinc-600 hidden md:block">{fmtFecha(ot.fecha_entrega_comprometida)}</span>
                      {ot.origen === 'Tienda Nube' && <span className="text-[9px] text-emerald-400 font-bold">TN</span>}
                    </div>
                    {(ot.estado === 'Pausado' || ot.estado === 'Listo' || ot.estado === 'Entregado') && (
                      <div className={`flex gap-2 px-5 py-2.5 border-b border-zinc-800/40 ${i%2===0?'':'bg-zinc-800/20'}`}>
                        {ot.estado === 'Pausado' && (
                          <button onClick={() => { setModalReanudar(ot); setComentario('') }}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] hover:bg-[#C9B99A]/20 font-bold">
                            ▶ Reanudar
                          </button>
                        )}
                        {ot.estado === 'Listo' && (
                          <button onClick={() => setModalEntrega(ot)}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 font-bold">
                            ✅ Confirmar entrega
                          </button>
                        )}
                        <button onClick={() => verHistorial(ot.id)}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300">
                          Historial →
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* A MEDIDA */}
        {vista === 'medida' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold">Muebles A Medida</h2>
              <button onClick={() => router.push('/relevamiento')}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-purple-950 border border-purple-800 text-purple-300 hover:bg-purple-900 font-bold">
                + Nuevo relevamiento
              </button>
            </div>

            {/* Pipeline visual */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {ESTADOS_MEDIDA.map(estado => {
                const cant = med.filter(o => o.estado === estado).length
                const color = ESTADO_COLOR_MEDIDA[estado]
                return (
                  <button key={estado}
                    onClick={() => setFiltroMed(filtroMed === estado ? null : estado)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border text-center min-w-[90px] transition-all ${
                      filtroMed === estado ? 'border-[#C9B99A]' : 'border-zinc-800 hover:border-zinc-600'
                    } bg-zinc-900`}>
                    <p style={{ fontFamily: 'var(--font-display)' }} className={`text-xl font-bold ${cant > 0 ? 'text-white' : 'text-zinc-700'}`}>{cant}</p>
                    <p className={`text-[9px] mt-0.5 truncate ${color.includes('text-') ? color.split(' ').find(c => c.startsWith('text-')) : 'text-zinc-600'}`}>{estado}</p>
                  </button>
                )
              })}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{filtroMed ?? 'Todos los proyectos'}</p>
                <span className="text-[10px] text-zinc-600">{(filtroMed ? medFiltradas : med).length} proyectos</span>
              </div>
              {(filtroMed ? medFiltradas : med).map((ot, i) => {
                const color = ESTADO_COLOR_MEDIDA[ot.estado] ?? ''
                const idx = ESTADOS_MEDIDA.indexOf(ot.estado as any)
                const pct = idx >= 0 ? Math.round((idx / (ESTADOS_MEDIDA.length - 1)) * 100) : 0
                const puedeAvanzar = idx >= 0 && idx < ESTADOS_MEDIDA.length - 1
                return (
                  <div key={ot.id}>
                    <div className={`flex items-center gap-3 px-5 py-4 border-b border-zinc-800/40 ${i%2===0?'':'bg-zinc-800/20'}`}>
                      <span className="text-[10px] text-[#C9B99A] font-mono min-w-[80px]">{ot.codigo_proyecto}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{ot.cliente}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{ot.producto}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 min-w-[52px]">
                        <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-600">{pct}%</span>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${color}`}>{ot.estado}</span>
                      <span className="text-[11px] text-zinc-600 hidden md:block">{fmtFecha(ot.fecha_entrega_comprometida)}</span>
                      {ot.precio > 0 && <span className="text-[11px] text-[#C9B99A] font-bold hidden lg:block">${(ot.precio/1000).toFixed(0)}k</span>}
                    </div>
                    <div className={`flex gap-2 px-5 py-2.5 border-b border-zinc-800/40 ${i%2===0?'':'bg-zinc-800/20'}`}>
                      {puedeAvanzar && (
                        <button onClick={() => setModalAvanzarMedida(ot)}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] hover:bg-[#C9B99A]/20 font-bold">
                          → {ESTADOS_MEDIDA[idx + 1]}
                        </button>
                      )}
                      {ot.estado === 'Relevamiento' && (
                        <button onClick={() => router.push(`/relevamiento?ot=${ot.id}`)}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-purple-950 border border-purple-800 text-purple-300 hover:bg-purple-900 font-bold">
                          📋 Ver relevamiento
                        </button>
                      )}
                      <button onClick={() => verHistorial(ot.id)}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300">
                        Historial →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ALERTAS */}
        {vista === 'alertas' && (
          <div className="flex flex-col gap-3">
            <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold">Alertas activas</h2>
            {alertas.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <p className="text-emerald-400 font-bold">Sin alertas activas ✓</p>
              </div>
            )}
            {alertas.map(a => {
              const s = ALERTA_STYLE[a.tipo]
              return (
                <div key={a.id} className={`flex gap-4 items-start p-4 rounded-xl border ${s.card}`}>
                  <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${s.dot}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${s.text}`}>{a.mensaje}</p>
                    <p className="text-[11px] text-zinc-600 mt-1">{fmt(a.created_at)} {a.ot_id ? `· ${a.ot_id}` : ''}</p>
                  </div>
                  <button onClick={() => resolverAlerta(a.id)} className={`text-[11px] font-bold border border-zinc-700 px-2 py-1 rounded-lg ${s.badge}`}>
                    Resolver ✓
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
