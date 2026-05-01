'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type OrdenTrabajo, type Alerta, type EstadoOT } from '@/lib/supabase'

const ESTADO_STYLE: Record<EstadoOT, string> = {
  'Pendiente':     'bg-zinc-800 text-zinc-400 border border-zinc-700',
  'En producción': 'bg-blue-950 text-blue-300 border border-blue-800',
  'Pausado':       'bg-amber-950 text-amber-300 border border-amber-800',
  'Listo':         'bg-stone-800 text-[#C9B99A] border border-stone-600',
  'Entregado':     'bg-emerald-950 text-emerald-300 border border-emerald-800',
}

const ALERTA_STYLE: Record<string, { dot: string; card: string; text: string; badge: string }> = {
  danger:  { dot: 'bg-red-400',   card: 'border-red-900 bg-red-950/20',    text: 'text-red-200',   badge: 'text-red-400'   },
  warning: { dot: 'bg-amber-400', card: 'border-amber-900 bg-amber-950/20', text: 'text-amber-200', badge: 'text-amber-400' },
  info:    { dot: 'bg-blue-400',  card: 'border-blue-900 bg-blue-950/20',   text: 'text-blue-200',  badge: 'text-blue-400'  },
}

type FiltroEstado = EstadoOT | null

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function DashboardPage() {
  const router = useRouter()
  const [ots, setOts] = useState<OrdenTrabajo[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroEstado>(null)
  const [modalReanudar, setModalReanudar] = useState<OrdenTrabajo | null>(null)
  const [modalEntrega, setModalEntrega] = useState<OrdenTrabajo | null>(null)
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
    const canal = supabase.channel('dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
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

  const resolverAlerta = async (id: string) => {
    await supabase.from('alertas').update({ resuelta: true }).eq('id', id)
    cargar()
  }

  const activas    = ots.filter(o => o.estado === 'En producción').length
  const listas     = ots.filter(o => o.estado === 'Listo').length
  const pausadas   = ots.filter(o => o.estado === 'Pausado').length
  const pendientes = ots.filter(o => o.estado === 'Pendiente').length
  const entregados = ots.filter(o => o.estado === 'Entregado').length
  const ingresos   = ots.filter(o => o.estado === 'Entregado').reduce((s, o) => s + o.precio, 0)
  const filtradas  = filtro ? ots.filter(o => o.estado === filtro) : []

  const METRICAS = [
    { label: 'En producción', value: activas,    color: 'text-blue-300',    estado: 'En producción' as EstadoOT },
    { label: 'Listos',        value: listas,     color: 'text-[#C9B99A]',   estado: 'Listo'         as EstadoOT },
    { label: 'Pausados',      value: pausadas,   color: 'text-amber-400',   estado: 'Pausado'       as EstadoOT },
    { label: 'Pendientes',    value: pendientes, color: 'text-zinc-400',    estado: 'Pendiente'     as EstadoOT },
    { label: 'Entregados',    value: entregados, color: 'text-emerald-400', estado: 'Entregado'     as EstadoOT },
    { label: 'Ingresos mes',  value: `$${(ingresos/1000).toFixed(0)}k`, color: 'text-emerald-300', estado: null },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A18]">
      <p className="text-zinc-600 text-sm animate-pulse">Cargando sistema...</p>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#1A1A18]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-[#1A1A18] sticky top-0 z-10">
        <button onClick={() => router.push('/')} style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold hover:opacity-80 transition-opacity">
          tres<span className="text-[#C9B99A]">decó</span>
          <span className="text-zinc-600 text-xs font-normal ml-2 tracking-widest">sistema operativo</span>
        </button>
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-[#C9B99A] font-bold">DC</div>
      </div>

      {/* Modal Reanudar */}
      {modalReanudar && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold text-white mb-1">Reanudar OT</p>
            <p className="text-zinc-500 text-sm mb-4">{modalReanudar.id} — <span className="text-zinc-300 font-medium">{modalReanudar.cliente}</span></p>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="¿Cómo se resolvió el problema?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none h-20 mb-4 focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setModalReanudar(null); setComentario('') }} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={reanudar} disabled={!comentario.trim()} className="bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-2.5 rounded-xl text-sm font-bold disabled:opacity-40">Reanudar ▶</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Entrega */}
      {modalEntrega && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold text-white mb-3">Confirmar entrega</p>
            <p className="text-zinc-400 text-sm mb-6">¿El cliente ya retiró su <span className="text-white font-bold">{modalEntrega.producto}</span>?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setModalEntrega(null)} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={confirmarEntrega} className="bg-emerald-950 border border-emerald-800 text-emerald-300 py-2.5 rounded-xl text-sm font-bold">Confirmar ✅</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {modalHistorial && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold text-white">Historial {modalHistorial}</p>
              <button onClick={() => { setModalHistorial(null); setHistorialData([]) }} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {historialData.map(h => (
                <div key={h.id} className="flex gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-zinc-300 font-medium leading-snug">{h.descripcion}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{h.usuario} · {fmt(h.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-5 max-w-5xl mx-auto w-full">
        {/* Métricas como botones clickeables */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {METRICAS.map(m => (
            <button key={m.label}
              onClick={() => m.estado ? setFiltro(filtro === m.estado ? null : m.estado) : null}
              className={`bg-zinc-900 border rounded-xl px-3 py-4 text-center transition-all ${
                filtro === m.estado ? 'border-[#C9B99A]' : 'border-zinc-800 hover:border-zinc-600'
              } ${m.estado ? 'cursor-pointer' : 'cursor-default'}`}>
              <p style={{ fontFamily: 'var(--font-display)' }} className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-zinc-600 mt-1 leading-tight">{m.label}</p>
              {filtro === m.estado && <p className="text-[9px] text-[#C9B99A] mt-1">✕ cerrar</p>}
            </button>
          ))}
        </div>

        {/* Lista filtrada por estado */}
        {filtro && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium">{filtro} · {filtradas.length} órdenes</p>
              <button onClick={() => setFiltro(null)} className="text-[10px] text-zinc-600 hover:text-zinc-400">Cerrar ✕</button>
            </div>
            {filtradas.length === 0
              ? <p className="text-zinc-600 text-sm p-5">Sin órdenes en este estado</p>
              : filtradas.map((ot, i) => {
                const total = ['02','03'].includes(ot.codigo_producto) ? 5 : 4
                const pct = Math.round((ot.etapa_actual / total) * 100)
                return (
                  <div key={ot.id}>
                    <div className={`flex items-center gap-3 px-5 py-4 border-b border-zinc-800/40 ${i%2===0?'':'bg-zinc-800/20'}`}>
                      <span className="text-[11px] text-zinc-600 font-mono min-w-[52px]">{ot.id}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{ot.cliente}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{ot.producto} · {ot.color}</p>
                        {ot.estado === 'Pausado' && ot.observaciones && (
                          <p className="text-[11px] text-amber-400 truncate">⚠️ {ot.observaciones}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 min-w-[52px]">
                        <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#C9B99A]/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-600">{pct}%</span>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${ESTADO_STYLE[ot.estado]}`}>{ot.estado}</span>
                      <span className="text-[11px] text-zinc-600 hidden md:block">{ot.fecha_entrega_comprometida?.split('-').slice(1).join('/')}</span>
                      {ot.origen === 'Tienda Nube' && <span className="text-[9px] text-emerald-400 font-bold">TN</span>}
                    </div>
                    {(ot.estado === 'Pausado' || ot.estado === 'Listo' || ot.estado === 'Entregado') && (
                      <div className={`flex gap-2 px-5 py-2.5 border-b border-zinc-800/40 ${i%2===0?'':'bg-zinc-800/20'}`}>
                        {ot.estado === 'Pausado' && (
                          <button onClick={() => { setModalReanudar(ot); setComentario('') }}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] hover:bg-[#C9B99A]/20 transition-all font-bold">
                            ▶ Reanudar
                          </button>
                        )}
                        {ot.estado === 'Listo' && (
                          <button onClick={() => setModalEntrega(ot)}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 transition-all font-bold">
                            ✅ Confirmar entrega
                          </button>
                        )}
                        <button onClick={() => verHistorial(ot.id)}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300 transition-all">
                          Ver historial →
                        </button>
                        {ot.estado === 'Entregado' && ot.fecha_entrega_real && (
                          <span className="text-[11px] text-emerald-400 font-medium self-center">
                            Entregado {ot.fecha_entrega_real.split('-').reverse().join('/')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        )}

        {/* Sin filtro: alertas + resumen */}
        {!filtro && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium">Alertas activas</p>
                {alertas.length > 0 && <span className="text-[10px] bg-red-900 text-red-300 px-2 py-0.5 rounded-full font-bold">{alertas.length}</span>}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {alertas.length === 0 && <p className="text-zinc-600 text-sm text-center py-4">Sin alertas activas ✓</p>}
                {alertas.map(a => {
                  const s = ALERTA_STYLE[a.tipo]
                  return (
                    <div key={a.id} className={`flex gap-3 items-start p-3 rounded-xl border ${s.card}`}>
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${s.dot}`} />
                      <div className="flex-1">
                        <p className={`text-sm leading-snug font-bold ${s.text}`}>{a.mensaje}</p>
                        <p className="text-[10px] text-zinc-600 mt-1">{fmt(a.created_at)} {a.ot_id ? `· ${a.ot_id}` : ''}</p>
                      </div>
                      <button onClick={() => resolverAlerta(a.id)} className={`text-[11px] font-bold ${s.badge} hover:opacity-70`}>✓</button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-3">Resumen del día</p>
                {[
                  { label: 'Órdenes activas', value: ots.filter(o=>o.estado!=='Entregado').length, color: 'text-white' },
                  { label: 'Requieren atención', value: pausadas, color: pausadas>0?'text-amber-400':'text-zinc-400' },
                  { label: 'Listos para entregar', value: listas, color: listas>0?'text-[#C9B99A]':'text-zinc-400' },
                  { label: 'Entregados', value: entregados, color: 'text-emerald-400' },
                  { label: 'Ingresos mes', value: `$${(ingresos/1000).toFixed(0)}k`, color: 'text-emerald-300' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
                    <span className="text-[11px] text-zinc-500">{r.label}</span>
                    <span className={`text-sm font-bold ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium">Tienda Nube</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[11px] text-zinc-500">Pedidos TN</span>
                    <span className="text-sm text-white font-bold">{ots.filter(o=>o.origen==='Tienda Nube').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-zinc-500">En espera</span>
                    <span className="text-sm text-amber-400 font-bold">{ots.filter(o=>o.origen==='Tienda Nube'&&o.estado==='Pendiente').length}</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-700 mt-3 italic">Conectar API en fase 2</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
