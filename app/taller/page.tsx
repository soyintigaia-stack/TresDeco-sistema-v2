'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type OrdenTrabajo, type EstadoOT } from '@/lib/supabase'

const ETAPAS: Record<string, string[]> = {
  '01': ['Corte', 'Tapacanto', 'Armado', 'Control calidad'],
  '02': ['Corte', 'CNC', 'Tapacanto', 'Armado', 'Control calidad'],
  '03': ['Corte', 'CNC', 'Tapacanto', 'Armado', 'Control calidad'],
  '04': ['Corte', 'Tapacanto', 'Armado', 'Control calidad'],
}

const MENSAJES_FOTO = [
  { titulo: 'Foto de inicio 🪵', msg: '¡Ya arrancamos con tu pedido! 🪵 Te compartimos una foto de los materiales que vamos a usar. Va a quedar increíble.' },
  { titulo: 'Foto de avance ✂️', msg: '¡Vamos por la mitad! ✂️ El equipo está trabajando con todo. Ya falta menos para que lo tengas en casa. ¡Está quedando genial!' },
  { titulo: 'Foto de calidad ✅', msg: '¡Tu mueble pasó las pruebas de calidad! ✅ Está listo. En breve te contactamos para coordinar la entrega. ¡Gracias por elegirnos!' },
]

const ESTADO_STYLE: Record<EstadoOT, string> = {
  'Pendiente':     'text-zinc-400 border-zinc-700',
  'En producción': 'text-blue-300 border-blue-800',
  'Pausado':       'text-amber-300 border-amber-800',
  'Listo':         'text-[#C9B99A] border-stone-600',
  'Entregado':     'text-emerald-300 border-emerald-800',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getFotoInfo(etapa: number, total: number) {
  if (etapa === 0) return MENSAJES_FOTO[0]
  if (etapa === Math.floor(total / 2)) return MENSAJES_FOTO[1]
  if (etapa === total - 1) return MENSAJES_FOTO[2]
  return null
}

export default function TallerPage() {
  const router = useRouter()
  const [ots, setOts] = useState<OrdenTrabajo[]>([])
  const [sel, setSel] = useState<string>('')
  const [tab, setTab] = useState<'trabajo' | 'proximas' | 'historial'>('trabajo')
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoInfo, setFotoInfo] = useState<{ titulo: string; msg: string } | null>(null)
  const [modalFoto, setModalFoto] = useState(false)
  const [modalProblema, setModalProblema] = useState(false)
  const [modalReanudar, setModalReanudar] = useState(false)
  const [comentario, setComentario] = useState('')
  const [historial, setHistorial] = useState<any[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const cargarOts = useCallback(async () => {
    const { data } = await supabase.from('ordenes_trabajo').select('*')
      .not('estado', 'eq', 'Entregado').order('fecha_entrega_comprometida', { ascending: true })
    if (data) { setOts(data); if (!sel && data.length > 0) setSel(data[0].id) }
    setLoading(false)
  }, [sel])

  const cargarHistorial = useCallback(async (id: string) => {
    const { data } = await supabase.from('actividad').select('*').eq('ot_id', id).order('created_at', { ascending: false })
    if (data) setHistorial(data)
  }, [])

  useEffect(() => {
    cargarOts()
    const c = supabase.channel('taller-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, cargarOts)
      .subscribe()
    return () => { supabase.removeChannel(c) }
  }, [cargarOts])

  useEffect(() => { if (sel) cargarHistorial(sel) }, [sel, cargarHistorial])

  const ot = ots.find(o => o.id === sel)
  const etapas = ot ? (ETAPAS[ot.codigo_producto] ?? []) : []
  const pct = etapas.length > 0 ? Math.round(((ot?.etapa_actual ?? 0) / etapas.length) * 100) : 0
  const fotoReq = ot ? getFotoInfo(ot.etapa_actual, etapas.length) : null

  const registrar = async (otId: string, desc: string) => {
    await supabase.from('actividad').insert({ ot_id: otId, descripcion: desc, usuario: 'Claudio' })
    cargarHistorial(otId)
  }

  const confirmarEtapa = async () => {
    if (!ot || procesando || ot.estado === 'Pausado') return
    if (fotoReq) { setFotoInfo(fotoReq); setModalFoto(true); return }
    await avanzar()
  }

  const avanzar = async () => {
    if (!ot || procesando) return
    setProcesando(true)
    const sig = ot.etapa_actual + 1
    const fin = sig >= etapas.length
    await supabase.from('ordenes_trabajo').update({
      etapa_actual: sig, estado: fin ? 'Listo' : 'En producción', updated_at: new Date().toISOString()
    }).eq('id', ot.id)
    await registrar(ot.id, fin ? `✓ Trabajo completado — ${ot.producto} listo` : `✓ Etapa completada: ${etapas[ot.etapa_actual]}`)
    if (fin) {
      await supabase.from('alertas').insert({ tipo: 'info', mensaje: `OT ${ot.id} (${ot.cliente}) — ${ot.producto} listo para entrega.`, ot_id: ot.id })
      showToast('¡Trabajo completo! Dante recibió la alerta.')
    } else {
      showToast(`Etapa "${etapas[ot.etapa_actual]}" confirmada ✓`)
    }
    setModalFoto(false); setFotoPreview(null); setFotoInfo(null)
    setProcesando(false)
  }

  const reportar = async () => {
    if (!ot || !comentario.trim()) return
    setProcesando(true)
    await supabase.from('ordenes_trabajo').update({ estado: 'Pausado', observaciones: comentario, updated_at: new Date().toISOString() }).eq('id', ot.id)
    await supabase.from('alertas').insert({ tipo: 'danger', mensaje: `⚠️ Problema en OT ${ot.id} (${ot.cliente}) — ${comentario}`, ot_id: ot.id })
    await registrar(ot.id, `⚠️ Problema reportado: ${comentario}`)
    setModalProblema(false); setComentario(''); showToast('Problema reportado. Dante fue notificado.')
    setProcesando(false)
  }

  const reanudar = async () => {
    if (!ot || !comentario.trim()) return
    setProcesando(true)
    await supabase.from('ordenes_trabajo').update({ estado: 'En producción', observaciones: null, updated_at: new Date().toISOString() }).eq('id', ot.id)
    await registrar(ot.id, `▶ Trabajo reanudado: ${comentario}`)
    setModalReanudar(false); setComentario(''); showToast('Trabajo reanudado ▶')
    setProcesando(false)
  }

  const despachar = async () => {
    if (!ot) return
    await registrar(ot.id, '📦 Enviado a despacho — ya no está en el taller')
    await supabase.from('alertas').insert({ tipo: 'info', mensaje: `📦 OT ${ot.id} (${ot.cliente}) enviada a despacho.`, ot_id: ot.id })
    showToast('Enviado a despacho ✓ Dante fue notificado.')
  }

  const enviarFoto = async () => {
    if (!ot || !fotoInfo) return
    const tel = ot.telefono?.replace(/\D/g, '')
    await registrar(ot.id, `📷 ${fotoInfo.titulo} enviada al cliente`)
    if (tel) window.open(`https://wa.me/${tel}?text=${encodeURIComponent(fotoInfo.msg)}`, '_blank')
    await avanzar()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A18]">
      <p className="text-zinc-600 text-sm animate-pulse">Cargando taller...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1A1A18] flex flex-col max-w-md mx-auto relative">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) setFotoPreview(URL.createObjectURL(f)) }} />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 text-white text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Modal Problema */}
      {modalProblema && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-end">
          <div className="bg-[#1A1A18] border-t border-zinc-800 rounded-t-3xl p-6 w-full">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold text-white mb-1">Reportar problema</p>
            <p className="text-zinc-500 text-sm mb-4">Dante recibe la alerta al instante.</p>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Ej: Falta melamina para terminar el armado..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none h-24 mb-4 focus:outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setModalProblema(false); setComentario('') }} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-3.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={reportar} disabled={!comentario.trim() || procesando} className="bg-red-950 border border-red-800 text-red-300 py-3.5 rounded-xl text-sm font-bold disabled:opacity-40">Reportar a Dante</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reanudar */}
      {modalReanudar && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-end">
          <div className="bg-[#1A1A18] border-t border-zinc-800 rounded-t-3xl p-6 w-full">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold text-white mb-1">Reanudar trabajo</p>
            <p className="text-zinc-500 text-sm mb-4">¿Cómo se resolvió el problema?</p>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Ej: Llegó el material, retomamos el armado..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none h-24 mb-4 focus:outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setModalReanudar(false); setComentario('') }} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-3.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={reanudar} disabled={!comentario.trim() || procesando} className="bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-3.5 rounded-xl text-sm font-bold disabled:opacity-40">Reanudar ▶</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Foto */}
      {modalFoto && fotoInfo && (
        <div className="fixed inset-0 z-40 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold text-white">{fotoInfo.titulo}</p>
            <button onClick={() => { setModalFoto(false); setFotoPreview(null) }} className="text-zinc-500 text-sm">Cerrar</button>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Mensaje al cliente</p>
              <p className="text-sm text-zinc-300 leading-relaxed italic">"{fotoInfo.msg}"</p>
            </div>
            {fotoPreview ? (
              <div className="flex flex-col gap-3 flex-1">
                <img src={fotoPreview} alt="preview" className="w-full rounded-2xl object-cover max-h-56" />
                <button onClick={() => setFotoPreview(null)} className="text-[11px] text-zinc-500 text-center">Sacar otra foto</button>
                <button onClick={enviarFoto} disabled={procesando}
                  className="w-full bg-emerald-950 border border-emerald-800 text-emerald-300 py-4 rounded-2xl text-sm font-bold">
                  Enviar al cliente y confirmar →
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full bg-zinc-800 border border-zinc-700 text-white py-10 rounded-2xl flex flex-col items-center gap-2">
                <span className="text-5xl">📷</span>
                <span className="text-sm font-medium">Abrir cámara</span>
              </button>
            )}
            <button onClick={avanzar} className="text-[11px] text-zinc-600 text-center py-2">
              Saltar foto y confirmar igual →
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <button onClick={() => router.push('/')} style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold">
          tres<span className="text-[#C9B99A]">decó</span>
          <span className="text-zinc-600 text-xs font-normal ml-2">taller</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-zinc-500 font-medium">Claudio</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 pt-4 pb-1">
        {(['trabajo', 'proximas', 'historial'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-4 py-2 rounded-full transition-all font-medium ${tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>
            {t === 'trabajo' ? 'Mi trabajo' : t === 'proximas' ? 'Próximas' : 'Historial'}
          </button>
        ))}
      </div>

      {/* TAB TRABAJO */}
      {tab === 'trabajo' && (
        <div className="flex-1 px-5 py-4 flex flex-col gap-3 pb-24">
          {!ot ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <p className="text-zinc-400 text-sm">Sin órdenes activas</p>
            </div>
          ) : (
            <>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                {/* Info OT */}
                <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-600 font-mono mb-1 tracking-wider">{ot.id}</p>
                      <p style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-bold text-white leading-tight">{ot.cliente}</p>
                      <p className="text-zinc-400 text-sm mt-0.5">{ot.producto} · {ot.color} · cant. {ot.cantidad}</p>
                    </div>
                    <span className={`text-[10px] px-3 py-1.5 rounded-full border font-medium mt-1 whitespace-nowrap ${ESTADO_STYLE[ot.estado]}`}>{ot.estado}</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-3">
                    Entrega: <span className="text-[#C9B99A] font-medium">{ot.fecha_entrega_comprometida?.split('-').reverse().join('/')}</span>
                  </p>
                </div>

                {/* Barra progreso */}
                <div className="px-5 py-3 border-b border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Progreso</p>
                    <span className="text-[10px] text-zinc-500">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9B99A] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Etapas secuenciales */}
                <div className="px-5 py-4 border-b border-zinc-800">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Etapas</p>
                  <div className="flex flex-col gap-2">
                    {etapas.map((e, i) => {
                      const done = i < ot.etapa_actual
                      const current = i === ot.etapa_actual
                      const fotoAqui = getFotoInfo(i, etapas.length)
                      return (
                        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          done ? 'bg-emerald-950/30 border-emerald-900' :
                          current ? 'bg-[#C9B99A]/10 border-[#C9B99A]/50' :
                          'bg-zinc-950/50 border-zinc-800'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                            done ? 'bg-emerald-900 text-emerald-300' :
                            current ? 'bg-[#C9B99A]/20 text-[#C9B99A]' :
                            'bg-zinc-800 text-zinc-600'}`}>
                            {done ? '✓' : i + 1}
                          </div>
                          <span className={`text-sm font-medium flex-1 ${
                            done ? 'text-emerald-400 line-through' :
                            current ? 'text-[#C9B99A]' : 'text-zinc-600'}`}>{e}</span>
                          {fotoAqui && <span className="text-[10px] text-zinc-500">{fotoAqui.titulo.split(' ')[2]}</span>}
                          {current && <span className="text-[10px] text-[#C9B99A] font-bold">← actual</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Aviso foto requerida */}
                {fotoReq && ot.estado !== 'Pausado' && ot.estado !== 'Listo' && (
                  <div className="px-5 py-3 border-b border-zinc-800 bg-[#C9B99A]/5">
                    <p className="text-[11px] text-[#C9B99A]">📷 Al confirmar esta etapa se pedirá una foto para el cliente.</p>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="px-5 py-4 flex flex-col gap-2">
                  {ot.estado === 'Pausado' ? (
                    <button onClick={() => { setModalReanudar(true); setComentario('') }}
                      className="w-full bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-4 rounded-xl text-sm font-bold hover:bg-[#C9B99A]/20 transition-all">
                      ▶ Reanudar trabajo
                    </button>
                  ) : ot.estado === 'Listo' ? (
                    <button onClick={despachar}
                      className="w-full bg-emerald-950 border border-emerald-800 text-emerald-300 py-4 rounded-xl text-sm font-bold hover:bg-emerald-900 transition-all">
                      📦 Marcar como despachado
                    </button>
                  ) : (
                    <button onClick={confirmarEtapa} disabled={procesando}
                      className="w-full bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-4 rounded-xl text-sm font-bold hover:bg-[#C9B99A]/20 transition-all disabled:opacity-40">
                      {procesando ? 'Guardando...' : fotoReq ? `${fotoReq.titulo.split(' ')[2]} Sacar foto y confirmar` : 'Confirmar etapa siguiente →'}
                    </button>
                  )}
                  {ot.estado !== 'Pausado' && ot.estado !== 'Listo' && (
                    <button onClick={() => { setModalProblema(true); setComentario('') }}
                      className="w-full bg-zinc-900 border border-red-900/50 text-red-400 py-3 rounded-xl text-xs font-medium hover:bg-red-950/20 transition-all">
                      ⚠️ Reportar problema a Dante
                    </button>
                  )}
                </div>
              </div>

              {/* Otras órdenes */}
              {ots.filter(o => o.id !== sel).length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 px-1">Otras órdenes</p>
                  {ots.filter(o => o.id !== sel).slice(0, 3).map(o => (
                    <button key={o.id} onClick={() => setSel(o.id)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 text-left hover:border-zinc-700 transition-all mb-2">
                      <span className="text-[10px] text-zinc-600 font-mono">{o.id}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{o.cliente}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{o.producto}</p>
                      </div>
                      <span className={`text-[10px] border px-2 py-0.5 rounded-full ${ESTADO_STYLE[o.estado]}`}>{o.estado}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB PRÓXIMAS */}
      {tab === 'proximas' && (
        <div className="flex-1 px-5 py-4">
          {ots.map(o => (
            <button key={o.id} onClick={() => { setSel(o.id); setTab('trabajo') }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 flex items-center gap-3 text-left hover:border-[#C9B99A]/30 transition-all mb-2">
              <span className="text-[10px] text-zinc-600 font-mono min-w-[52px]">{o.id}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-bold truncate">{o.cliente}</p>
                <p className="text-[11px] text-zinc-500 truncate">{o.producto} · {o.color}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Entrega: {o.fecha_entrega_comprometida?.split('-').reverse().join('/')}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full border ${ESTADO_STYLE[o.estado]}`}>{o.estado}</span>
            </button>
          ))}
        </div>
      )}

      {/* TAB HISTORIAL */}
      {tab === 'historial' && (
        <div className="flex-1 px-5 py-4">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-4">Registro completo · {ot?.id}</p>
          {historial.length === 0
            ? <p className="text-zinc-600 text-sm">Sin actividad registrada</p>
            : historial.map((h, i) => (
              <div key={h.id} className="flex gap-3 py-3 border-b border-zinc-800/50 last:border-0">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-2 h-2 rounded-full bg-zinc-600 flex-shrink-0" />
                  {i < historial.length - 1 && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm text-zinc-300 font-medium leading-snug">{h.descripcion}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">{h.usuario} · {fmt(h.created_at)}</p>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Botón flotante cámara */}
      {tab === 'trabajo' && ot && ot.estado !== 'Pausado' && ot.estado !== 'Listo' && (
        <button
          onClick={() => { setFotoInfo(MENSAJES_FOTO[1]); setModalFoto(true) }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center text-2xl shadow-xl z-30 hover:bg-zinc-700 transition-all">
          📷
        </button>
      )}

      <div className="px-5 py-3 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-700 text-center">TresDeco Sistema v1.0</p>
      </div>
    </div>
  )
}
