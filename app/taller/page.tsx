'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type OrdenTrabajo, ETAPAS_STANDARD, ESTADOS_MEDIDA, ESTADO_COLOR_STANDARD, ESTADO_COLOR_MEDIDA, fmt, fmtFecha } from '@/lib/supabase'

const MENSAJES_FOTO = [
  { titulo: '🪵 Foto de inicio', msg: '¡Ya arrancamos con tu pedido! 🪵 Te compartimos una foto de los materiales que vamos a usar. Va a quedar increíble.' },
  { titulo: '✂️ Foto de avance', msg: '¡Vamos por la mitad! ✂️ El equipo está trabajando con todo. Ya falta menos para que lo tengas en casa. ¡Está quedando genial!' },
  { titulo: '✅ Foto de calidad', msg: '¡Tu mueble pasó las pruebas de calidad! ✅ Está listo. En breve te contactamos para coordinar la entrega. ¡Gracias por elegirnos!' },
]

function getFotoInfo(etapa: number, total: number) {
  if (etapa === 0) return MENSAJES_FOTO[0]
  if (etapa === Math.floor(total / 2)) return MENSAJES_FOTO[1]
  if (etapa === total - 1) return MENSAJES_FOTO[2]
  return null
}

export default function TallerPage() {
  const router = useRouter()
  const [area, setArea] = useState<'standard' | 'medida'>('standard')
  const [ots, setOts] = useState<OrdenTrabajo[]>([])
  const [sel, setSel] = useState<string>('')
  const [tabStd, setTabStd] = useState<'trabajo' | 'proximas' | 'historial'>('trabajo')
  const [tabMed, setTabMed] = useState<'activos' | 'detalle' | 'historial'>('activos')
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
  const [relevamientoData, setRelevamientoData] = useState<any>(null)
  const [expandirRel, setExpandirRel] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const cargarOts = useCallback(async () => {
    const { data } = await supabase.from('ordenes_trabajo').select('*')
      .not('estado', 'eq', 'Entregado').order('fecha_entrega_comprometida', { ascending: true })
    if (data) {
      setOts(data)
      const std = data.filter((o: OrdenTrabajo) => o.tipo === 'standard')
      const med = data.filter((o: OrdenTrabajo) => o.tipo === 'medida')
      if (area === 'standard' && !sel && std.length > 0) setSel(std[0].id)
      if (area === 'medida' && !sel && med.length > 0) setSel(med[0].id)
    }
    setLoading(false)
  }, [sel, area])

  const cargarHistorial = useCallback(async (id: string) => {
    const { data } = await supabase.from('actividad').select('*').eq('ot_id', id).order('created_at', { ascending: false })
    if (data) setHistorial(data)
  }, [])

  const cargarRelevamiento = useCallback(async (otId: string) => {
    const { data } = await supabase.from('relevamientos').select('*').eq('ot_id', otId).order('created_at', { ascending: false }).limit(1).single()
    if (data) setRelevamientoData(data)
    else setRelevamientoData(null)
  }, [])

  useEffect(() => {
    cargarOts()
    const c = supabase.channel('taller-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, cargarOts)
      .subscribe()
    return () => { supabase.removeChannel(c) }
  }, [cargarOts])

  useEffect(() => {
    if (sel) {
      cargarHistorial(sel)
      const ot = ots.find(o => o.id === sel)
      if (ot?.tipo === 'medida') cargarRelevamiento(sel)
    }
  }, [sel, cargarHistorial, cargarRelevamiento, ots])

  // Cambiar área resetea selección
  useEffect(() => {
    const lista = ots.filter(o => o.tipo === area)
    if (lista.length > 0) setSel(lista[0].id)
    else setSel('')
  }, [area])

  const stdOts = ots.filter(o => o.tipo === 'standard')
  const medOts = ots.filter(o => o.tipo === 'medida')
  const ot = ots.find(o => o.id === sel)
  const etapas = ot?.tipo === 'standard' ? (ETAPAS_STANDARD[ot.codigo_producto ?? ''] ?? []) : []
  const pct = etapas.length > 0 ? Math.round(((ot?.etapa_actual ?? 0) / etapas.length) * 100) : 0
  const fotoReq = ot?.tipo === 'standard' ? getFotoInfo(ot.etapa_actual, etapas.length) : null

  const registrar = async (otId: string, desc: string) => {
    await supabase.from('actividad').insert({ ot_id: otId, descripcion: desc, usuario: 'Claudio' })
    cargarHistorial(otId)
  }

  // Acciones estándar
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
      await supabase.from('alertas').insert({ tipo: 'info', mensaje: `OT ${ot.id} (${ot.cliente}) — listo para entrega.`, ot_id: ot.id })
      showToast('¡Listo! Dante fue notificado.')
    } else showToast(`Etapa "${etapas[ot.etapa_actual]}" confirmada ✓`)
    setModalFoto(false); setFotoPreview(null); setFotoInfo(null)
    setProcesando(false)
  }

  const reportar = async () => {
    if (!ot || !comentario.trim()) return
    setProcesando(true)
    await supabase.from('ordenes_trabajo').update({ estado: 'Pausado', observaciones: comentario, updated_at: new Date().toISOString() }).eq('id', ot.id)
    await supabase.from('alertas').insert({ tipo: 'danger', mensaje: `⚠️ Problema en ${ot.id} (${ot.cliente}) — ${comentario}`, ot_id: ot.id })
    await registrar(ot.id, `⚠️ Problema: ${comentario}`)
    setModalProblema(false); setComentario(''); showToast('Problema reportado.')
    setProcesando(false)
  }

  const reanudar = async () => {
    if (!ot || !comentario.trim()) return
    setProcesando(true)
    await supabase.from('ordenes_trabajo').update({ estado: 'En producción', observaciones: null, updated_at: new Date().toISOString() }).eq('id', ot.id)
    await registrar(ot.id, `▶ Reanudado: ${comentario}`)
    setModalReanudar(false); setComentario(''); showToast('Reanudado ▶')
    setProcesando(false)
  }

  const despachar = async () => {
    if (!ot) return
    await registrar(ot.id, '📦 Enviado a despacho')
    await supabase.from('alertas').insert({ tipo: 'info', mensaje: `📦 ${ot.id} (${ot.cliente}) enviado a despacho.`, ot_id: ot.id })
    showToast('Enviado a despacho ✓')
  }

  const avanzarMedida = async () => {
    if (!ot) return
    const idx = ESTADOS_MEDIDA.indexOf(ot.estado as any)
    if (idx < 0 || idx >= ESTADOS_MEDIDA.length - 1) return
    const siguiente = ESTADOS_MEDIDA[idx + 1]
    await supabase.from('ordenes_trabajo').update({ estado: siguiente, updated_at: new Date().toISOString() }).eq('id', ot.id)
    await registrar(ot.id, `→ Avanzó a: ${siguiente}`)
    showToast(`Estado actualizado: ${siguiente}`)
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

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 text-white text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">{toast}</div>
      )}

      {/* Modales estándar */}
      {modalProblema && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-end">
          <div className="bg-[#1A1A18] border-t border-zinc-800 rounded-t-3xl p-6 w-full">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold mb-1">Reportar problema</p>
            <p className="text-zinc-500 text-sm mb-4">Dante recibe la alerta al instante.</p>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="¿Qué pasó?"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm resize-none h-24 mb-4 focus:outline-none text-white placeholder-zinc-600" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setModalProblema(false); setComentario('') }} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-3.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={reportar} disabled={!comentario.trim()} className="bg-red-950 border border-red-800 text-red-300 py-3.5 rounded-xl text-sm font-bold disabled:opacity-40">Reportar</button>
            </div>
          </div>
        </div>
      )}

      {modalReanudar && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-end">
          <div className="bg-[#1A1A18] border-t border-zinc-800 rounded-t-3xl p-6 w-full">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold mb-1">Reanudar trabajo</p>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="¿Cómo se resolvió?"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm resize-none h-24 mb-4 focus:outline-none text-white placeholder-zinc-600" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setModalReanudar(false); setComentario('') }} className="bg-zinc-800 border border-zinc-700 text-zinc-400 py-3.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={reanudar} disabled={!comentario.trim()} className="bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-3.5 rounded-xl text-sm font-bold disabled:opacity-40">Reanudar ▶</button>
            </div>
          </div>
        </div>
      )}

      {modalFoto && fotoInfo && (
        <div className="fixed inset-0 z-40 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold">{fotoInfo.titulo}</p>
            <button onClick={() => { setModalFoto(false); setFotoPreview(null) }} className="text-zinc-500">Cerrar</button>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Mensaje al cliente</p>
              <p className="text-sm text-zinc-300 italic leading-relaxed">"{fotoInfo.msg}"</p>
            </div>
            {fotoPreview ? (
              <div className="flex flex-col gap-3 flex-1">
                <img src={fotoPreview} alt="preview" className="w-full rounded-2xl object-cover max-h-56" />
                <button onClick={() => setFotoPreview(null)} className="text-[11px] text-zinc-500 text-center">Sacar otra</button>
                <button onClick={enviarFoto} disabled={procesando} className="w-full bg-emerald-950 border border-emerald-800 text-emerald-300 py-4 rounded-2xl text-sm font-bold">Enviar y confirmar →</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="w-full bg-zinc-800 border border-zinc-700 py-10 rounded-2xl flex flex-col items-center gap-2">
                <span className="text-5xl">📷</span>
                <span className="text-sm font-medium text-white">Abrir cámara</span>
              </button>
            )}
            <button onClick={avanzar} className="text-[11px] text-zinc-600 text-center py-2">Saltar foto →</button>
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
          <span className="text-xs text-zinc-500">Claudio</span>
        </div>
      </div>

      {/* Selector de área — MUY VISIBLE */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex gap-2">
          <button onClick={() => setArea('standard')}
            className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${area === 'standard' ? 'bg-[#C9B99A]/10 border-[#C9B99A]/40 text-[#C9B99A]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
            Estándar
            {stdOts.length > 0 && <span className="ml-1.5 text-[10px] opacity-70">({stdOts.length})</span>}
          </button>
          <button onClick={() => setArea('medida')}
            className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${area === 'medida' ? 'bg-purple-950 border-purple-800 text-purple-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
            A Medida
            {medOts.length > 0 && <span className="ml-1.5 text-[10px] opacity-70">({medOts.length})</span>}
          </button>
        </div>
      </div>

      {/* ========== ÁREA ESTÁNDAR ========== */}
      {area === 'standard' && (
        <>
          <div className="flex gap-1 px-5 pt-2 pb-1">
            {(['trabajo', 'proximas', 'historial'] as const).map(t => (
              <button key={t} onClick={() => setTabStd(t)}
                className={`text-xs px-3 py-2 rounded-full font-medium ${tabStd === t ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>
                {t === 'trabajo' ? 'Mi trabajo' : t === 'proximas' ? 'Próximas' : 'Historial'}
              </button>
            ))}
          </div>

          {tabStd === 'trabajo' && (
            <div className="flex-1 px-5 py-4 flex flex-col gap-3 pb-24">
              {!ot || ot.tipo !== 'standard' ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                  <p className="text-zinc-400 text-sm">Sin órdenes estándar activas</p>
                </div>
              ) : (
                <>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] text-zinc-600 font-mono mb-1">{ot.id}</p>
                          <p style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-bold leading-tight">{ot.cliente}</p>
                          <p className="text-zinc-400 text-sm mt-0.5">{ot.producto} · {ot.color} · cant. {ot.cantidad}</p>
                        </div>
                        <span className={`text-[10px] px-3 py-1.5 rounded-full border font-medium mt-1 ${ESTADO_COLOR_STANDARD[ot.estado] ?? ''}`}>{ot.estado}</span>
                      </div>
                      <p className="text-[11px] text-zinc-600 mt-3">
                        Entrega: <span className="text-[#C9B99A] font-medium">{fmtFecha(ot.fecha_entrega_comprometida)}</span>
                      </p>
                    </div>

                    <div className="px-5 py-3 border-b border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Progreso</p>
                        <span className="text-[10px] text-zinc-500">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#C9B99A] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="px-5 py-4 border-b border-zinc-800">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Etapas</p>
                      <div className="flex flex-col gap-2">
                        {etapas.map((e, i) => {
                          const done = i < ot.etapa_actual
                          const current = i === ot.etapa_actual
                          const fotoAqui = getFotoInfo(i, etapas.length)
                          return (
                            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${done ? 'bg-emerald-950/30 border-emerald-900' : current ? 'bg-[#C9B99A]/10 border-[#C9B99A]/50' : 'bg-zinc-950/50 border-zinc-800'}`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-emerald-900 text-emerald-300' : current ? 'bg-[#C9B99A]/20 text-[#C9B99A]' : 'bg-zinc-800 text-zinc-600'}`}>
                                {done ? '✓' : i + 1}
                              </div>
                              <span className={`text-sm font-medium flex-1 ${done ? 'text-emerald-400 line-through' : current ? 'text-[#C9B99A]' : 'text-zinc-600'}`}>{e}</span>
                              {fotoAqui && <span className="text-[10px] text-zinc-600">📷</span>}
                              {current && <span className="text-[10px] text-[#C9B99A] font-bold">← actual</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {fotoReq && ot.estado !== 'Pausado' && ot.estado !== 'Listo' && (
                      <div className="px-5 py-3 border-b border-zinc-800 bg-[#C9B99A]/5">
                        <p className="text-[11px] text-[#C9B99A]">📷 Al confirmar se pedirá foto para el cliente.</p>
                      </div>
                    )}

                    <div className="px-5 py-4 flex flex-col gap-2">
                      {ot.estado === 'Pausado' ? (
                        <button onClick={() => { setModalReanudar(true); setComentario('') }}
                          className="w-full bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-4 rounded-xl text-sm font-bold hover:bg-[#C9B99A]/20">
                          ▶ Reanudar trabajo
                        </button>
                      ) : ot.estado === 'Listo' ? (
                        <button onClick={despachar} className="w-full bg-emerald-950 border border-emerald-800 text-emerald-300 py-4 rounded-xl text-sm font-bold">
                          📦 Marcar como despachado
                        </button>
                      ) : (
                        <button onClick={confirmarEtapa} disabled={procesando}
                          className="w-full bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-4 rounded-xl text-sm font-bold disabled:opacity-40">
                          {procesando ? 'Guardando...' : fotoReq ? `📷 Foto y confirmar etapa` : 'Confirmar etapa siguiente →'}
                        </button>
                      )}
                      {ot.estado !== 'Pausado' && ot.estado !== 'Listo' && (
                        <button onClick={() => { setModalProblema(true); setComentario('') }}
                          className="w-full bg-zinc-900 border border-red-900/50 text-red-400 py-3 rounded-xl text-xs font-medium">
                          ⚠️ Reportar problema
                        </button>
                      )}
                    </div>
                  </div>

                  {stdOts.filter(o => o.id !== sel).length > 0 && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Otras estándar</p>
                      {stdOts.filter(o => o.id !== sel).slice(0, 3).map(o => (
                        <button key={o.id} onClick={() => setSel(o.id)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 text-left hover:border-zinc-700 mb-2">
                          <span className="text-[10px] text-zinc-600 font-mono">{o.id}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-bold truncate">{o.cliente}</p>
                            <p className="text-[11px] text-zinc-500 truncate">{o.producto}</p>
                          </div>
                          <span className={`text-[10px] border px-2 py-0.5 rounded-full ${ESTADO_COLOR_STANDARD[o.estado] ?? ''}`}>{o.estado}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tabStd === 'proximas' && (
            <div className="flex-1 px-5 py-4">
              {stdOts.map(o => (
                <button key={o.id} onClick={() => { setSel(o.id); setTabStd('trabajo') }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 flex items-center gap-3 text-left hover:border-[#C9B99A]/30 mb-2">
                  <span className="text-[10px] text-zinc-600 font-mono min-w-[52px]">{o.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-bold truncate">{o.cliente}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{o.producto} · {o.color}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">Entrega: {fmtFecha(o.fecha_entrega_comprometida)}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full border ${ESTADO_COLOR_STANDARD[o.estado] ?? ''}`}>{o.estado}</span>
                </button>
              ))}
            </div>
          )}

          {tabStd === 'historial' && (
            <div className="flex-1 px-5 py-4">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-4">Registro · {ot?.id}</p>
              {historial.map((h, i) => (
                <div key={h.id} className="flex gap-3 py-3 border-b border-zinc-800/50 last:border-0">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2 h-2 rounded-full bg-zinc-600 flex-shrink-0" />
                    {i < historial.length - 1 && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm text-zinc-300 font-medium">{h.descripcion}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{h.usuario} · {fmt(h.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========== ÁREA A MEDIDA ========== */}
      {area === 'medida' && (
        <>
          <div className="flex gap-1 px-5 pt-2 pb-1">
            {(['activos', 'detalle', 'historial'] as const).map(t => (
              <button key={t} onClick={() => setTabMed(t)}
                className={`text-xs px-3 py-2 rounded-full font-medium ${tabMed === t ? 'bg-purple-950 text-purple-200' : 'text-zinc-500'}`}>
                {t === 'activos' ? 'Proyectos' : t === 'detalle' ? 'Detalle' : 'Historial'}
              </button>
            ))}
          </div>

          {tabMed === 'activos' && (
            <div className="flex-1 px-5 py-4">
              {medOts.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                  <p className="text-zinc-400 text-sm">Sin proyectos a medida activos</p>
                </div>
              ) : medOts.map(o => {
                const idx = ESTADOS_MEDIDA.indexOf(o.estado as any)
                const pctMed = idx >= 0 ? Math.round((idx / (ESTADOS_MEDIDA.length - 1)) * 100) : 0
                const color = ESTADO_COLOR_MEDIDA[o.estado] ?? ''
                const enProduccion = o.estado === 'Producción'
                return (
                  <div key={o.id} className={`bg-zinc-900 border rounded-xl mb-3 overflow-hidden ${sel === o.id ? 'border-purple-700' : 'border-zinc-800'}`}>
                    <button onClick={() => { setSel(o.id); setTabMed('detalle') }} className="w-full px-4 py-4 flex items-center gap-3 text-left">
                      <span className="text-[10px] text-[#C9B99A] font-mono min-w-[80px]">{o.codigo_proyecto}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{o.cliente}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{o.producto}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${pctMed}%` }} />
                          </div>
                          <span className="text-[10px] text-zinc-600">{pctMed}%</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${color}`}>{o.estado}</span>
                    </button>
                    {enProduccion && (
                      <div className="px-4 pb-3 flex gap-2 border-t border-zinc-800 pt-3">
                        <button onClick={() => { setSel(o.id); avanzarMedida() }}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] font-bold">
                          → Avanzar estado
                        </button>
                        <button onClick={() => { setSel(o.id); setModalProblema(true); setComentario('') }}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800 border border-red-900/50 text-red-400">
                          ⚠️ Problema
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {tabMed === 'detalle' && ot?.tipo === 'medida' && (
            <div className="flex-1 px-5 py-4 flex flex-col gap-3 pb-24">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-[10px] text-[#C9B99A] font-mono mb-1">{ot.codigo_proyecto}</p>
                <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold">{ot.cliente}</p>
                <p className="text-zinc-400 text-sm">{ot.producto}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR_MEDIDA[ot.estado] ?? ''}`}>{ot.estado}</span>
                  {ot.requiere_instalacion && <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">Con instalación</span>}
                </div>
              </div>

              {/* Relevamiento expandible */}
              {relevamientoData && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandirRel(!expandirRel)} className="w-full px-4 py-3 flex items-center justify-between">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-widest">📋 Datos del relevamiento</p>
                    <span className="text-zinc-500 text-xs">{expandirRel ? '▲ cerrar' : '▼ ver'}</span>
                  </button>
                  {expandirRel && (
                    <div className="px-4 pb-4 border-t border-zinc-800 pt-3 flex flex-col gap-2">
                      {[
                        ['Dirección', relevamientoData.direccion],
                        ['Mueble', relevamientoData.tipo_mueble],
                        ['Ancho', `${relevamientoData.ancho_cm} cm`],
                        ['Alto', `${relevamientoData.alto_cm} cm`],
                        ['Profundidad', `${relevamientoData.profundidad_cm} cm`],
                        ['M² estimados', `${relevamientoData.m2_calculado} m²`],
                        ['Cuerpos', relevamientoData.cantidad_cuerpos],
                        ['Puertas', relevamientoData.cantidad_puertas],
                        ['Cajones', relevamientoData.cantidad_cajones],
                        ['Color', relevamientoData.color_principal],
                        ['Material pared', relevamientoData.material_pared],
                        ['Instalación', relevamientoData.requiere_instalacion ? 'Sí' : 'No'],
                        ['Realizado por', relevamientoData.realizado_por],
                      ].map(([k, v]) => v ? (
                        <div key={k as string} className="flex justify-between text-xs">
                          <span className="text-zinc-500">{k}</span>
                          <span className="text-white font-medium">{v}</span>
                        </div>
                      ) : null)}
                      {relevamientoData.notas_condiciones && (
                        <div className="bg-zinc-800 rounded-lg p-2 mt-1">
                          <p className="text-[10px] text-zinc-500 mb-1">Notas</p>
                          <p className="text-xs text-zinc-300">{relevamientoData.notas_condiciones}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Pipeline de estados */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Flujo del proyecto</p>
                <div className="flex flex-col gap-1">
                  {ESTADOS_MEDIDA.map((estado, i) => {
                    const actual = ot.estado === estado
                    const pasado = ESTADOS_MEDIDA.indexOf(ot.estado as any) > i
                    return (
                      <div key={estado} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${actual ? 'bg-purple-950/40' : ''}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          pasado ? 'bg-purple-900 text-purple-300' : actual ? 'bg-purple-700 text-white' : 'bg-zinc-800 text-zinc-600'}`}>
                          {pasado ? '✓' : i + 1}
                        </div>
                        <span className={`text-sm ${actual ? 'text-white font-bold' : pasado ? 'text-purple-400' : 'text-zinc-600'}`}>{estado}</span>
                        {actual && <span className="text-[10px] text-purple-400 font-bold ml-auto">← actual</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Acciones */}
              {ot.estado !== 'Entregado' && (
                <div className="flex flex-col gap-2">
                  <button onClick={avanzarMedida}
                    className="w-full bg-purple-950 border border-purple-800 text-purple-300 py-4 rounded-xl text-sm font-bold hover:bg-purple-900">
                    → Avanzar a: {ESTADOS_MEDIDA[ESTADOS_MEDIDA.indexOf(ot.estado as any) + 1]}
                  </button>
                  <button onClick={() => { setModalProblema(true); setComentario('') }}
                    className="w-full bg-zinc-900 border border-red-900/50 text-red-400 py-3 rounded-xl text-xs font-medium">
                    ⚠️ Reportar problema
                  </button>
                </div>
              )}
            </div>
          )}

          {tabMed === 'historial' && (
            <div className="flex-1 px-5 py-4">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-4">Registro · {ot?.codigo_proyecto ?? ot?.id}</p>
              {historial.map((h, i) => (
                <div key={h.id} className="flex gap-3 py-3 border-b border-zinc-800/50 last:border-0">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2 h-2 rounded-full bg-purple-700 flex-shrink-0" />
                    {i < historial.length - 1 && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm text-zinc-300 font-medium">{h.descripcion}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{h.usuario} · {fmt(h.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Botón flotante cámara (solo en estándar trabajando) */}
      {area === 'standard' && tabStd === 'trabajo' && ot && ot.tipo === 'standard' && ot.estado !== 'Pausado' && ot.estado !== 'Listo' && (
        <button onClick={() => { setFotoInfo(MENSAJES_FOTO[1]); setModalFoto(true) }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center text-2xl shadow-xl z-30 hover:bg-zinc-700">
          📷
        </button>
      )}

      <div className="px-5 py-3 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-700 text-center">TresDeco Sistema v2.0</p>
      </div>
    </div>
  )
}
