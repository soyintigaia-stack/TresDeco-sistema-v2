'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  type OrdenTrabajo, type Relevamiento, type Operario, type EtapaRegistro,
  ESTADOS_MEDIDA, ESTADO_COLOR_MEDIDA, ETAPAS_PRODUCCION,
  fmt, fmtPeso, isPreVenta,
} from '@/lib/supabase'

type Vista = 'proyectos' | 'detalle' | 'historial'

export default function TallerMedidaPage() {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>('proyectos')
  const [ots, setOts] = useState<OrdenTrabajo[]>([])
  const [relevamientos, setRelevamientos] = useState<Relevamiento[]>([])
  const [operarios, setOperarios] = useState<Operario[]>([])
  const [registros, setRegistros] = useState<EtapaRegistro[]>([])
  const [otSeleccionada, setOtSeleccionada] = useState<OrdenTrabajo | null>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [operarioActual, setOperarioActual] = useState<string>('')
  const [operarioNombre, setOperarioNombre] = useState<string>('')
  const [showSeleccionInicial, setShowSeleccionInicial] = useState(true)

  // Modals
  const [modalAvanzar, setModalAvanzar] = useState<OrdenTrabajo | null>(null)
  const [modalProblema, setModalProblema] = useState<OrdenTrabajo | null>(null)
  const [modalReanudar, setModalReanudar] = useState<OrdenTrabajo | null>(null)
  const [modalOperarioSelect, setModalOperarioSelect] = useState(false)
  const [descripcionProblema, setDescripcionProblema] = useState('')
  const [notasReanudar, setNotasReanudar] = useState('')
  const [notasAvanzar, setNotasAvanzar] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const cargar = useCallback(async () => {
    const [{ data: o }, { data: rel }, { data: ops }, { data: reg }] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').eq('tipo', 'medida').order('updated_at', { ascending: false }),
      supabase.from('relevamientos').select('*'),
      supabase.from('operarios').select('*').eq('activo', true).order('nombre'),
      supabase.from('etapa_registro').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    if (o) setOts(o)
    if (rel) setRelevamientos(rel)
    if (ops) setOperarios(ops)
    if (reg) setRegistros(reg)
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const c = supabase.channel('taller-medida-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(c) }
  }, [cargar])

  const cargarHistorial = async (otId: string) => {
    const { data } = await supabase.from('actividad').select('*').eq('ot_id', otId).order('created_at', { ascending: true })
    if (data) setHistorial(data)
  }

  const verDetalle = (ot: OrdenTrabajo) => {
    setOtSeleccionada(ot)
    setVista('detalle')
    cargarHistorial(ot.id)
  }

  const avanzarEstado = async () => {
    if (!modalAvanzar) return
    if (!operarioActual && !operarioNombre.trim()) { showToast('Seleccioná o ingresá el operario.'); return }

    const idx = ESTADOS_MEDIDA.indexOf(modalAvanzar.estado as any)
    const siguiente = ESTADOS_MEDIDA[idx + 1]
    if (!siguiente) return

    const nombre = operarios.find(o => o.id === operarioActual)?.nombre ?? operarioNombre.trim()

    await supabase.from('ordenes_trabajo').update({
      estado: siguiente,
      updated_at: new Date().toISOString(),
    }).eq('id', modalAvanzar.id)

    await supabase.from('actividad').insert({
      ot_id: modalAvanzar.id,
      descripcion: `→ ${modalAvanzar.estado} → ${siguiente}${notasAvanzar ? ` — ${notasAvanzar}` : ''}`,
      usuario: nombre,
    })

    await supabase.from('etapa_registro').insert({
      ot_id: modalAvanzar.id,
      etapa: modalAvanzar.estado,
      operario_id: operarioActual || null,
      operario_nombre: nombre,
      fecha: new Date().toISOString().split('T')[0],
      notas: notasAvanzar || null,
    })

    if (siguiente === 'Listo') {
      await supabase.from('alertas').insert({
        tipo: 'info',
        mensaje: `✅ ${modalAvanzar.codigo_proyecto ?? modalAvanzar.cliente} — Listo para entrega.`,
        ot_id: modalAvanzar.id,
      })
    }

    if (otSeleccionada?.id === modalAvanzar.id) {
      setOtSeleccionada({ ...modalAvanzar, estado: siguiente })
      cargarHistorial(modalAvanzar.id)
    }

    setModalAvanzar(null); setNotasAvanzar(''); cargar()
    showToast(`Avanzado a: ${siguiente}`)
  }

  const reportarProblema = async () => {
    if (!modalProblema || !descripcionProblema.trim()) return
    const nombre = operarios.find(o => o.id === operarioActual)?.nombre ?? operarioNombre.trim() ?? 'Taller A Medida'
    await supabase.from('ordenes_trabajo').update({
      estado: 'Pausado',
      observaciones: descripcionProblema,
      updated_at: new Date().toISOString(),
    }).eq('id', modalProblema.id)
    await supabase.from('actividad').insert({
      ot_id: modalProblema.id,
      descripcion: `⚠️ Problema reportado: ${descripcionProblema}`,
      usuario: nombre,
    })
    await supabase.from('alertas').insert({
      tipo: 'danger',
      mensaje: `⚠️ ${modalProblema.codigo_proyecto ?? modalProblema.cliente} — ${descripcionProblema}`,
      ot_id: modalProblema.id,
    })
    setModalProblema(null); setDescripcionProblema(''); cargar()
    showToast('Problema reportado — Administración fue notificada')
  }

  const reanudar = async () => {
    if (!modalReanudar) return
    const estadoAnterior = modalReanudar.observaciones ? (ESTADOS_MEDIDA[ESTADOS_MEDIDA.indexOf(modalReanudar.estado as any) - 1] ?? 'Corte') : 'Corte'
    const nombre = operarios.find(o => o.id === operarioActual)?.nombre ?? 'Taller A Medida'
    await supabase.from('ordenes_trabajo').update({
      estado: estadoAnterior,
      observaciones: null,
      updated_at: new Date().toISOString(),
    }).eq('id', modalReanudar.id)
    await supabase.from('actividad').insert({
      ot_id: modalReanudar.id,
      descripcion: `▶ Reanudado — ${notasReanudar || 'Problema resuelto'}`,
      usuario: nombre,
    })
    await supabase.from('alertas').update({ resuelta: true }).eq('ot_id', modalReanudar.id).eq('resuelta', false)
    setModalReanudar(null); setNotasReanudar(''); cargar()
    showToast('Proyecto reanudado')
  }

  // Proyectos activos (en producción o señados)
  const enProduccion = ots.filter(o => ETAPAS_PRODUCCION.includes(o.estado as any) && o.estado !== 'Entregado')
  const enPreventa   = ots.filter(o => isPreVenta(o.estado))
  const entregados   = ots.filter(o => o.estado === 'Entregado')

  const getProgresoPct = (ot: OrdenTrabajo) => {
    const idx = ESTADOS_MEDIDA.indexOf(ot.estado as any)
    return Math.round((idx / (ESTADOS_MEDIDA.length - 1)) * 100)
  }

  const getRel = (otId: string) => relevamientos.find(r => r.ot_id === otId)

  const Tab = ({ id, label, count }: { id: Vista; label: string; count?: number }) => (
    <button onClick={() => setVista(id)}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${vista === id ? 'bg-[#C9B99A] text-[#1A1A18]' : 'text-[#666660] hover:text-white'}`}>
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  )

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center">
      <p className="text-[#666660]">Cargando proyectos…</p>
    </div>
  )

  if (showSeleccionInicial) return (
    <div className="min-h-screen bg-[#1A1A18] flex flex-col px-6">
      <div className="pt-4 pb-2">
        <button onClick={() => router.push('/')} className="text-[#666660] hover:text-white text-sm transition-colors">← Volver</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-bold text-white mb-1">
          tres<span className="text-[#C9B99A]">decó</span>
        </h1>
        <p className="text-[#666660] text-sm mb-8">Taller A Medida</p>
        <div className="w-full max-w-sm bg-[#242421] border border-[#2E2E2B] rounded-2xl p-6">
          <p className="text-white font-medium mb-1">¿Quién sos?</p>
          <p className="text-[#666660] text-xs mb-5">Seleccioná tu nombre para comenzar</p>
          <div className="space-y-2">
            {operarios.filter(o => ['ambos', 'medida', 'diseño', 'instalacion'].includes(o.area)).map(op => (
              <button key={op.id}
                onClick={() => { setOperarioActual(op.id); setOperarioNombre(op.nombre); setShowSeleccionInicial(false) }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#2E2E2B] bg-[#1A1A18] text-left hover:border-[#C9B99A]/40 hover:bg-[#C9B99A]/5 transition-all">
                <div className="w-8 h-8 rounded-full bg-[#C9B99A]/15 flex items-center justify-center text-[#C9B99A] text-sm font-bold">
                  {op.nombre.charAt(0)}
                </div>
                <span className="text-white text-sm font-medium">{op.nombre}</span>
              </button>
            ))}
            {operarios.length === 0 && (
              <p className="text-[#444441] text-sm text-center py-4">Cargando operarios…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 text-white text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap z-[60]">{toast}</div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#1A1A18]/95 backdrop-blur border-b border-[#2E2E2B]">
        <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-[#666660] hover:text-white transition-colors text-sm px-2">← Inicio</button>
            <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-base font-bold">
              tres<span className="text-[#C9B99A]">decó</span>
              <span className="text-[#666660] font-normal text-xs ml-2">A Medida</span>
            </h1>
          </div>
          <button onClick={() => setShowSeleccionInicial(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C9B99A]/40 bg-[#C9B99A]/10 text-[#C9B99A] text-xs">
            <span className="w-4 h-4 rounded-full bg-[#C9B99A]/20 flex items-center justify-center text-[8px] font-bold">{operarioNombre.charAt(0)}</span>
            {operarioNombre}
          </button>
        </div>
        <div className="px-4 pb-2 max-w-lg mx-auto flex gap-2">
          <Tab id="proyectos" label="En producción" count={enProduccion.length} />
          <Tab id="detalle"   label={otSeleccionada ? `${otSeleccionada.codigo_proyecto ?? 'Detalle'}` : 'Detalle'} />
          <Tab id="historial" label="Historial" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">

        {/* ── PROYECTOS ── */}
        {vista === 'proyectos' && (
          <div className="space-y-4">
            {/* En producción */}
            {enProduccion.length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">En producción ({enProduccion.length})</p>
                <div className="space-y-3">
                  {enProduccion.map(ot => {
                    const rel = getRel(ot.id)
                    const pct = getProgresoPct(ot)
                    const enMiEtapa = !isPreVenta(ot.estado) && ot.estado !== 'Listo' && ot.estado !== 'Instalación' && ot.estado !== 'Entregado' && ot.estado !== 'Pausado'
                    return (
                      <div key={ot.id} className={`bg-[#242421] border rounded-xl p-4 ${ot.estado === 'Pausado' ? 'border-amber-900/50' : 'border-[#2E2E2B]'}`}>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            {ot.codigo_proyecto && <p className="text-[#C9B99A] text-xs font-mono mb-0.5">{ot.codigo_proyecto}</p>}
                            <p className="text-white font-medium text-sm">{ot.cliente}</p>
                            <p className="text-[#666660] text-xs">{ot.producto}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${ESTADO_COLOR_MEDIDA[ot.estado] ?? 'bg-zinc-800 text-zinc-400'}`}>{ot.estado}</span>
                        </div>

                        {/* Pipeline mini */}
                        <div className="mb-3">
                          <div className="flex items-center gap-1 mb-1.5">
                            <div className="flex-1 bg-[#1A1A18] rounded-full h-1.5">
                              <div className="bg-[#C9B99A] rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[#444441] text-xs">{pct}%</span>
                          </div>
                          {/* Etapas de producción visualization */}
                          <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {['Señado', 'Corte', 'Tapacanto', 'Armado', 'Control', 'Listo'].map(e => {
                              const idxE = ESTADOS_MEDIDA.indexOf(e as any)
                              const idxA = ESTADOS_MEDIDA.indexOf(ot.estado as any)
                              return (
                                <span key={e} className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                                  idxE < idxA ? 'bg-[#C9B99A]/20 text-[#C9B99A]/60' :
                                  idxE === idxA ? 'bg-[#C9B99A]/30 text-[#C9B99A] font-medium' :
                                  'bg-[#1A1A18] text-[#444441]'
                                }`}>{e}</span>
                              )
                            })}
                          </div>
                        </div>

                        {rel && (
                          <div className="text-xs text-[#444441] mb-3">
                            {rel.ancho_cm}×{rel.alto_cm}×{rel.profundidad_cm} cm · {rel.m2_calculado} m²
                            {rel.color_principal && ` · ${rel.color_principal}`}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={() => verDetalle(ot)} className="flex-1 py-2 rounded-xl bg-[#2E2E2B] border border-[#3a3a37] text-[#666660] text-xs hover:text-white">
                            Ver detalle
                          </button>
                          {ot.estado === 'Pausado' ? (
                            <button onClick={() => setModalReanudar(ot)}
                              className="flex-1 py-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-300 text-xs hover:bg-amber-900">
                              ▶ Reanudar
                            </button>
                          ) : enMiEtapa ? (
                            <button onClick={() => { setModalAvanzar(ot); setNotasAvanzar('') }}
                              className="flex-1 py-2 rounded-xl bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] text-xs hover:bg-[#C9B99A]/20 font-medium">
                              Avanzar →
                            </button>
                          ) : (
                            <button onClick={() => { setModalProblema(ot); setDescripcionProblema('') }}
                              className="flex-1 py-2 rounded-xl bg-red-950 border border-red-900 text-red-300 text-xs hover:bg-red-900">
                              Reportar problema
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pre-venta — resumen simple */}
            {enPreventa.length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Pre-venta / en gestión ({enPreventa.length})</p>
                <div className="space-y-2">
                  {enPreventa.map(ot => (
                    <div key={ot.id} onClick={() => verDetalle(ot)}
                      className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-3 cursor-pointer hover:border-[#3a3a37] flex items-center justify-between">
                      <div>
                        {ot.codigo_proyecto && <p className="text-[#C9B99A] text-[10px] font-mono">{ot.codigo_proyecto}</p>}
                        <p className="text-white text-sm">{ot.cliente}</p>
                        <p className="text-[#444441] text-xs">{ot.producto}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR_MEDIDA[ot.estado] ?? ''}`}>{ot.estado}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {enProduccion.length === 0 && enPreventa.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">◩</p>
                <p className="text-[#666660] text-sm">Sin proyectos activos</p>
              </div>
            )}
          </div>
        )}

        {/* ── DETALLE ── */}
        {vista === 'detalle' && otSeleccionada && (
          <div className="space-y-4">
            <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  {otSeleccionada.codigo_proyecto && <p className="text-[#C9B99A] text-xs font-mono mb-1">{otSeleccionada.codigo_proyecto}</p>}
                  <p className="text-white font-bold text-lg">{otSeleccionada.cliente}</p>
                  <p className="text-[#666660] text-sm">{otSeleccionada.producto}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${ESTADO_COLOR_MEDIDA[otSeleccionada.estado] ?? ''}`}>{otSeleccionada.estado}</span>
              </div>

              {/* Pipeline completo */}
              <div className="space-y-1 mb-4">
                {ESTADOS_MEDIDA.map((e, i) => {
                  const idxA = ESTADOS_MEDIDA.indexOf(otSeleccionada.estado as any)
                  const hecho   = i < idxA
                  const actual  = i === idxA
                  const pendiente = i > idxA
                  const regEtapa = registros.find(r => r.ot_id === otSeleccionada.id && r.etapa === e)
                  return (
                    <div key={e} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg ${actual ? 'bg-[#C9B99A]/10' : ''}`}>
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] ${
                        hecho ? 'bg-[#C9B99A] text-[#1A1A18]' :
                        actual ? 'border-2 border-[#C9B99A] bg-transparent' :
                        'border border-[#3a3a37] bg-transparent'
                      }`}>
                        {hecho && '✓'}
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className={`text-sm ${actual ? 'text-[#C9B99A] font-medium' : hecho ? 'text-[#666660]' : 'text-[#3a3a37]'}`}>{e}</span>
                        {regEtapa && <span className="text-[10px] text-[#444441]">{regEtapa.operario_nombre} · {regEtapa.fecha}</span>}
                      </div>
                      {i === 5 && <div className="w-px h-3 bg-[#3a3a37] mx-1" />}
                    </div>
                  )
                })}
              </div>

              {/* Datos del relevamiento */}
              {(() => {
                const rel = getRel(otSeleccionada.id)
                if (!rel) return null
                return (
                  <div className="border-t border-[#2E2E2B] pt-3 space-y-2">
                    <p className="text-[#666660] text-xs uppercase tracking-wider">Especificaciones</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {[
                        ['Medidas', `${rel.ancho_cm}×${rel.alto_cm}×${rel.profundidad_cm} cm`],
                        ['M²', `${rel.m2_calculado} m²`],
                        ['Color', rel.color_principal],
                        ['Color 2', rel.color_secundario || '—'],
                        ['Cuerpos', String(rel.cantidad_cuerpos)],
                        ['Puertas', String(rel.cantidad_puertas)],
                        ['Cajones', String(rel.cantidad_cajones)],
                        ['Estantes', String(rel.cantidad_estantes)],
                        ['Manijas', rel.manijas ? 'Sí' : 'No'],
                        ['Iluminación', rel.iluminacion ? 'Sí' : 'No'],
                        ['Instalación', rel.requiere_instalacion ? 'Sí' : 'No'],
                        ['Pared', rel.material_pared],
                      ].map(([k, v]) => v && v !== '—' && (
                        <div key={k} className="flex gap-1">
                          <span className="text-[#444441]">{k}:</span>
                          <span className="text-white">{v}</span>
                        </div>
                      ))}
                    </div>
                    {rel.descripcion && (
                      <div className="bg-[#1A1A18] rounded-lg p-2 mt-2">
                        <p className="text-[10px] text-[#666660] mb-1">Descripción</p>
                        <p className="text-xs text-white">{rel.descripcion}</p>
                      </div>
                    )}
                    {rel.notas_condiciones && (
                      <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-2">
                        <p className="text-[10px] text-amber-400 mb-1">⚠ Condiciones del espacio</p>
                        <p className="text-xs text-amber-200">{rel.notas_condiciones}</p>
                      </div>
                    )}
                    {rel.notas_instalacion && (
                      <div className="bg-[#1A1A18] rounded-lg p-2">
                        <p className="text-[10px] text-[#666660] mb-1">Notas de instalación</p>
                        <p className="text-xs text-white">{rel.notas_instalacion}</p>
                      </div>
                    )}
                    {rel.precio_final && (
                      <div className="bg-[#C9B99A]/5 border border-[#C9B99A]/20 rounded-lg p-2 flex justify-between">
                        <span className="text-xs text-[#666660]">Precio aprobado</span>
                        <span className="text-[#C9B99A] font-bold text-sm">{fmtPeso(rel.precio_final)}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Acciones */}
            {otSeleccionada.estado !== 'Entregado' && otSeleccionada.estado !== 'Listo' && (
              <div className="flex gap-3">
                {otSeleccionada.estado === 'Pausado' ? (
                  <button onClick={() => setModalReanudar(otSeleccionada)} className="flex-1 py-3 rounded-xl bg-amber-950 border border-amber-800 text-amber-300 text-sm font-medium">
                    ▶ Reanudar proyecto
                  </button>
                ) : !isPreVenta(otSeleccionada.estado) ? (
                  <>
                    <button onClick={() => { setModalProblema(otSeleccionada); setDescripcionProblema('') }}
                      className="py-3 px-4 rounded-xl bg-[#2E2E2B] border border-[#3a3a37] text-[#666660] text-sm hover:text-red-400">
                      Problema
                    </button>
                    <button onClick={() => { setModalAvanzar(otSeleccionada); setNotasAvanzar('') }}
                      className="flex-1 py-3 rounded-xl bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] text-sm font-bold hover:bg-[#C9B99A]/20">
                      Avanzar etapa →
                    </button>
                  </>
                ) : (
                  <div className="flex-1 bg-[#242421] border border-[#2E2E2B] rounded-xl p-3 text-center">
                    <p className="text-[#666660] text-xs">Este proyecto está en fase comercial</p>
                    <p className="text-[#444441] text-xs">Esperar señado para comenzar producción</p>
                  </div>
                )}
              </div>
            )}

            {otSeleccionada.estado === 'Listo' && (
              <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 text-center">
                <p className="text-emerald-300 font-medium">✅ Listo para entrega</p>
                <p className="text-emerald-400/70 text-xs mt-1">Administración confirma la entrega</p>
              </div>
            )}

            {/* Historial rápido */}
            {historial.length > 0 && (
              <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">Actividad reciente</p>
                <div className="space-y-2">
                  {historial.slice(-5).reverse().map(h => (
                    <div key={h.id} className="flex gap-2 text-xs">
                      <span className="text-[#444441] flex-shrink-0">{fmt(h.created_at)}</span>
                      <span className="text-[#666660]">{h.descripcion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {vista === 'detalle' && !otSeleccionada && (
          <div className="text-center py-16">
            <p className="text-[#666660] text-sm">Seleccioná un proyecto de la lista</p>
            <button onClick={() => setVista('proyectos')} className="mt-3 text-[#C9B99A] text-sm">Ver proyectos →</button>
          </div>
        )}

        {/* ── HISTORIAL GLOBAL ── */}
        {vista === 'historial' && (
          <div className="space-y-3">
            <p className="text-[#666660] text-xs uppercase tracking-wider">Últimas 30 etapas registradas</p>
            {registros.slice(0, 30).map(r => {
              const ot = ots.find(o => o.id === r.ot_id)
              return (
                <div key={r.id} className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white text-sm font-medium">{r.etapa}</span>
                        {ot && <span className="text-[#666660] text-xs">— {ot.cliente}</span>}
                      </div>
                      <p className="text-[#C9B99A] text-xs">{r.operario_nombre}</p>
                    </div>
                    <span className="text-[#444441] text-xs flex-shrink-0">{r.fecha}</span>
                  </div>
                  {r.notas && <p className="text-[#666660] text-xs mt-1">{r.notas}</p>}
                </div>
              )
            })}
            {registros.length === 0 && (
              <p className="text-[#444441] text-sm text-center py-8">Sin etapas registradas aún</p>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════ */}

      {/* Selector de operario */}
      {modalOperarioSelect && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-4">¿Quién está trabajando ahora?</p>
            <div className="space-y-2 mb-4">
              {operarios.filter(o => ['ambos', 'medida'].includes(o.area)).map(op => (
                <button key={op.id}
                  onClick={() => { setOperarioActual(op.id); setOperarioNombre(op.nombre); setModalOperarioSelect(false) }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${operarioActual === op.id ? 'border-[#C9B99A]/50 bg-[#C9B99A]/5' : 'border-[#3a3a37] bg-[#1A1A18]'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${operarioActual === op.id ? 'border-[#C9B99A]' : 'border-[#444441]'}`}>
                    {operarioActual === op.id && <div className="w-2 h-2 rounded-full bg-[#C9B99A]" />}
                  </div>
                  <span className="text-white text-sm">{op.nombre}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setModalOperarioSelect(false)}
              className="w-full py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Avanzar estado */}
      {modalAvanzar && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Confirmar avance de etapa</p>
            <p className="text-[#666660] text-sm mb-4">{modalAvanzar.cliente} — {modalAvanzar.producto}</p>
            {(() => {
              const idx = ESTADOS_MEDIDA.indexOf(modalAvanzar.estado as any)
              const sig = ESTADOS_MEDIDA[idx + 1]
              return (
                <div className="flex items-center gap-3 bg-[#1A1A18] rounded-xl p-3 mb-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${ESTADO_COLOR_MEDIDA[modalAvanzar.estado] ?? ''}`}>{modalAvanzar.estado}</span>
                  <span className="text-[#666660]">→</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${sig ? (ESTADO_COLOR_MEDIDA[sig] ?? '') : ''}`}>{sig}</span>
                </div>
              )
            })()}
            <div className="mb-3">
              <label className="text-[#666660] text-xs mb-1 block">¿Quién completó esta etapa?</label>
              {operarios.filter(o => ['ambos', 'medida'].includes(o.area)).length > 0 ? (
                <select value={operarioActual}
                  onChange={e => { setOperarioActual(e.target.value); setOperarioNombre(operarios.find(o => o.id === e.target.value)?.nombre ?? '') }}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50">
                  <option value="">Seleccionar operario...</option>
                  {operarios.filter(o => ['ambos', 'medida'].includes(o.area)).map(op => (
                    <option key={op.id} value={op.id}>{op.nombre}</option>
                  ))}
                </select>
              ) : (
                <input value={operarioNombre} onChange={e => setOperarioNombre(e.target.value)} placeholder="Nombre del operario"
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
              )}
            </div>
            <div className="mb-4">
              <label className="text-[#666660] text-xs mb-1 block">Notas (opcional)</label>
              <input value={notasAvanzar} onChange={e => setNotasAvanzar(e.target.value)} placeholder="Observaciones de la etapa..."
                className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAvanzar(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={avanzarEstado} className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Reportar problema */}
      {modalProblema && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Reportar problema</p>
            <p className="text-[#666660] text-sm mb-4">{modalProblema.cliente} — {modalProblema.producto}</p>
            <textarea
              value={descripcionProblema} onChange={e => setDescripcionProblema(e.target.value)}
              placeholder="Describí el problema detalladamente para que Administración pueda resolver..."
              className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none resize-none h-28 mb-4"
            />
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 mb-4">
              <p className="text-red-300 text-xs">⚠ El proyecto se pausará y se notificará a Administración.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalProblema(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={reportarProblema} disabled={!descripcionProblema.trim()} className="flex-1 py-2.5 rounded-xl bg-red-900 text-red-100 font-medium text-sm disabled:opacity-40">
                Reportar problema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reanudar */}
      {modalReanudar && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Reanudar proyecto</p>
            <p className="text-[#666660] text-sm mb-4">{modalReanudar.cliente}</p>
            {modalReanudar.observaciones && (
              <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 mb-4">
                <p className="text-[#666660] text-xs mb-0.5">Problema reportado:</p>
                <p className="text-amber-200 text-sm">{modalReanudar.observaciones}</p>
              </div>
            )}
            <textarea value={notasReanudar} onChange={e => setNotasReanudar(e.target.value)}
              placeholder="¿Cómo se resolvió el problema?"
              className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none resize-none h-20 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setModalReanudar(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={reanudar} className="flex-1 py-2.5 rounded-xl bg-amber-700 text-white font-medium text-sm">Reanudar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
