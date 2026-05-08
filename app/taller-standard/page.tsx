'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  type OrdenTrabajo, type Operario, type Despiece,
  ETAPAS_STANDARD, ESTADO_COLOR_STANDARD, ESTADO_COLOR_MEDIDA,
  fmt, fmtFecha, getEtapasParaOT, diasHabilesRestantes,
} from '@/lib/supabase'

type Vista = 'trabajo' | 'checklist' | 'proximas' | 'historial'

export default function TallerStandardPage() {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>('trabajo')
  const [ots, setOts] = useState<OrdenTrabajo[]>([])
  const [otActual, setOtActual] = useState<OrdenTrabajo | null>(null)
  const [operarios, setOperarios] = useState<Operario[]>([])
  const [despieces, setDespieces] = useState<Despiece[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // Estado del operario actual
  const [operarioId, setOperarioId] = useState<string>('')
  const [operarioNombre, setOperarioNombre] = useState<string>('')
  const [equipoHoy, setEquipoHoy] = useState<string[]>([])
  const [showSeleccionInicial, setShowSeleccionInicial] = useState(true)

  // Checklist local (estado de cada ítem)
  const [checkItems, setCheckItems] = useState<Record<string, boolean>>({})

  // Modals
  const [modalFoto, setModalFoto] = useState(false)
  const [modalProblema, setModalProblema] = useState(false)
  const [modalReanudar, setModalReanudar] = useState(false)
  const [modalAvanzar, setModalAvanzar] = useState(false)
  const [modalOperario, setModalOperario] = useState(false)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [descripcionProblema, setDescripcionProblema] = useState('')
  const [notasReanudar, setNotasReanudar] = useState('')
  const [notasAvanzar, setNotasAvanzar] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const cargar = useCallback(async () => {
    const [{ data: o }, { data: ops }] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').eq('tipo', 'standard').order('fecha_entrega_comprometida', { ascending: true }),
      supabase.from('operarios').select('*').eq('activo', true).order('nombre'),
    ])
    if (o) {
      setOts(o)
      setOtActual((prev: OrdenTrabajo | null) => {
        if (!prev) return (o as OrdenTrabajo[]).find((x: OrdenTrabajo) => x.estado === 'En producción') ?? null
        return (o as OrdenTrabajo[]).find((x: OrdenTrabajo) => x.id === prev.id) ?? prev
      })
    }
    if (ops) setOperarios(ops)
    setLoading(false)
  }, [])

  const cargarDespieces = useCallback(async (codigoProducto: string) => {
    // Buscar el producto por código y traer su despiece
    const { data: prod } = await supabase.from('productos_catalogo').select('id').eq('codigo', codigoProducto).single()
    if (!prod) return
    const { data: dp } = await supabase.from('despieces').select('*').eq('producto_id', prod.id).order('orden')
    if (dp) {
      setDespieces(dp)
      // Resetear checklist
      const init: Record<string, boolean> = {}
      dp.forEach((d: Despiece) => { init[d.id] = false })
      setCheckItems(init)
    }
  }, [])

  useEffect(() => {
    cargar()
    const c = supabase.channel('taller-std-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(c) }
  }, [cargar])

  useEffect(() => {
    if (otActual?.codigo_producto) cargarDespieces(otActual.codigo_producto)
  }, [otActual?.id, cargarDespieces])

  const cargarHistorial = async (otId: string) => {
    const { data } = await supabase.from('actividad').select('*').eq('ot_id', otId).order('created_at', { ascending: true })
    if (data) setHistorial(data)
  }

  useEffect(() => {
    if (otActual && vista === 'historial') cargarHistorial(otActual.id)
  }, [vista, otActual?.id])

  const seleccionarOT = (ot: OrdenTrabajo) => {
    setOtActual(ot)
    setVista('trabajo')
  }

  const nombreOperario = operarios.find(o => o.id === operarioId)?.nombre ?? operarioNombre.trim()

  const comenzarProduccion = async () => {
    if (!otActual) return
    if (!nombreOperario) { showToast('Seleccioná quién sos primero.'); return }
    await supabase.from('ordenes_trabajo').update({
      estado: 'En producción',
      updated_at: new Date().toISOString(),
    }).eq('id', otActual.id)
    await supabase.from('actividad').insert({
      ot_id: otActual.id,
      descripcion: `▶ Producción iniciada — ${otActual.producto} para ${otActual.cliente}`,
      usuario: nombreOperario,
    })
    cargar()
    showToast('Producción iniciada')
  }

  const avanzarEtapa = async () => {
    if (!otActual) return
    if (!nombreOperario) { showToast('Seleccioná quién sos primero.'); return }

    const etapas = getEtapasParaOT(otActual)
    const etapaActual = etapas[otActual.etapa_actual]
    const esUltima = otActual.etapa_actual >= etapas.length - 1

    if (esUltima) {
      // Completar todas las etapas → Listo
      await supabase.from('ordenes_trabajo').update({
        estado: 'Listo',
        etapa_actual: etapas.length,
        updated_at: new Date().toISOString(),
      }).eq('id', otActual.id)
      await supabase.from('actividad').insert({
        ot_id: otActual.id,
        descripcion: `✅ Control de calidad OK — ${otActual.cliente} listo para entrega`,
        usuario: nombreOperario,
      })
      await supabase.from('alertas').insert({
        tipo: 'info',
        mensaje: `✅ ${otActual.producto} de ${otActual.cliente} — LISTO para entrega.`,
        ot_id: otActual.id,
      })
      showToast('¡Producto listo para entrega! 🎉')
    } else {
      const siguienteEtapa = etapas[otActual.etapa_actual + 1]
      await supabase.from('ordenes_trabajo').update({
        etapa_actual: otActual.etapa_actual + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', otActual.id)
      await supabase.from('actividad').insert({
        ot_id: otActual.id,
        descripcion: `✓ ${etapaActual} completado${notasAvanzar ? ` — ${notasAvanzar}` : ''} → ${siguienteEtapa}`,
        usuario: nombreOperario,
      })
      await supabase.from('etapa_registro').insert({
        ot_id: otActual.id,
        etapa: etapaActual,
        operario_id: operarioId || null,
        operario_nombre: nombreOperario,
        fecha: new Date().toISOString().split('T')[0],
        notas: notasAvanzar || null,
      })
      showToast(`${etapaActual} completado ✓`)
    }
    setModalAvanzar(false); setNotasAvanzar(''); cargar()
  }

  const reportarProblema = async () => {
    if (!otActual || !descripcionProblema.trim()) return
    const nombre = nombreOperario || 'Taller'
    await supabase.from('ordenes_trabajo').update({
      estado: 'Pausado',
      observaciones: descripcionProblema,
      updated_at: new Date().toISOString(),
    }).eq('id', otActual.id)
    await supabase.from('actividad').insert({
      ot_id: otActual.id,
      descripcion: `⚠️ Problema: ${descripcionProblema}`,
      usuario: nombre,
    })
    await supabase.from('alertas').insert({
      tipo: 'danger',
      mensaje: `⚠️ ${otActual.producto} (${otActual.cliente}) — ${descripcionProblema}`,
      ot_id: otActual.id,
    })
    setModalProblema(false); setDescripcionProblema(''); cargar()
    showToast('Problema reportado — Administración fue notificada')
  }

  const reanudar = async () => {
    if (!otActual) return
    const nombre = nombreOperario || 'Taller'
    await supabase.from('ordenes_trabajo').update({
      estado: 'En producción',
      observaciones: null,
      updated_at: new Date().toISOString(),
    }).eq('id', otActual.id)
    await supabase.from('actividad').insert({
      ot_id: otActual.id,
      descripcion: `▶ Reanudado — ${notasReanudar || 'Problema resuelto'}`,
      usuario: nombre,
    })
    await supabase.from('alertas').update({ resuelta: true }).eq('ot_id', otActual.id).eq('resuelta', false)
    setModalReanudar(false); setNotasReanudar(''); cargar()
    showToast('Orden reanudada')
  }

  const enviarFotoWhatsApp = () => {
    if (!otActual) return
    const etapas = getEtapasParaOT(otActual)
    const etapaActual = etapas[otActual.etapa_actual] ?? 'producción'
    const mensajes: Record<number, string> = {
      0: `Hola ${otActual.cliente}! 👋 Empezamos a trabajar en tu ${otActual.producto}. Te vamos a ir contando el avance! 🪵`,
      1: `Hola ${otActual.cliente}! 📐 Ya terminamos el corte de tu ${otActual.producto}. Seguimos con el siguiente paso!`,
      2: `Hola ${otActual.cliente}! El tapacanto está listo en tu ${otActual.producto}. Queda muy bien ✨`,
      3: `Hola ${otActual.cliente}! 🛠 Tu ${otActual.producto} está en armado final. Ya casi!`,
    }
    const texto = mensajes[otActual.etapa_actual] ?? `Hola ${otActual.cliente}! Te avisamos del avance en tu ${otActual.producto}: etapa de ${etapaActual} completada ✓`
    const telefono = otActual.telefono?.replace(/\D/g, '') ?? ''
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`, '_blank')
    setModalFoto(false)
  }

  const enProd = ots.filter(o => o.estado === 'En producción')
  const pendientes = ots.filter(o => o.estado === 'Pendiente')
  const pausadas = ots.filter(o => o.estado === 'Pausado')
  const listas = ots.filter(o => o.estado === 'Listo')

  const etapas = otActual ? getEtapasParaOT(otActual) : []
  const etapaActualNombre = otActual ? (etapas[otActual.etapa_actual] ?? '—') : '—'
  const checklistCompleto = despieces.filter(d => d.es_checklist).every(d => checkItems[d.id])
  const todoDespiece = despieces.filter(d => d.es_checklist)

  const Tab = ({ id, label, badge }: { id: Vista; label: string; badge?: number }) => (
    <button onClick={() => setVista(id)}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors relative ${vista === id ? 'bg-[#C9B99A] text-[#1A1A18]' : 'text-[#666660] hover:text-white'}`}>
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5 align-top">{badge}</span>
      )}
    </button>
  )

  const confirmarPresencia = (op: Operario) => {
    setOperarioId(op.id)
    setOperarioNombre(op.nombre)
    setEquipoHoy(prev => prev.includes(op.nombre) ? prev : [...prev, op.nombre])
    setShowSeleccionInicial(false)
  }

  const agregarAlEquipo = (nombre: string) => {
    if (nombre && !equipoHoy.includes(nombre)) {
      setEquipoHoy(prev => [...prev, nombre])
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center">
      <p className="text-[#666660]">Cargando órdenes…</p>
    </div>
  )

  // Pantalla obligatoria de identificación
  if (showSeleccionInicial) return (
    <div className="min-h-screen bg-[#1A1A18] flex flex-col px-6">
      <div className="pt-4 pb-2">
        <button onClick={() => router.push('/')} className="text-[#666660] hover:text-white text-sm transition-colors">← Volver</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-bold text-white mb-1">
          tres<span className="text-[#C9B99A]">decó</span>
        </h1>
        <p className="text-[#666660] text-sm mb-8">Taller Standard</p>
        <div className="w-full max-w-sm bg-[#242421] border border-[#2E2E2B] rounded-2xl p-6">
          <p className="text-white font-medium mb-1">¿Quién sos?</p>
          <p className="text-[#666660] text-xs mb-5">Seleccioná tu nombre para comenzar el turno</p>
          <div className="space-y-2">
            {operarios.filter(o => ['ambos', 'standard'].includes(o.area)).map(op => (
              <button key={op.id} onClick={() => confirmarPresencia(op)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#2E2E2B] bg-[#1A1A18] text-left hover:border-[#C9B99A]/40 hover:bg-[#C9B99A]/5 transition-all">
                <div className="w-8 h-8 rounded-full bg-[#C9B99A]/15 flex items-center justify-center text-[#C9B99A] text-sm font-bold">
                  {op.nombre.charAt(0)}
                </div>
                <span className="text-white text-sm font-medium">{op.nombre}</span>
              </button>
            ))}
            {operarios.filter(o => ['ambos', 'standard'].includes(o.area)).length === 0 && (
              <p className="text-[#444441] text-sm text-center py-4">Cargando operarios…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white pb-28">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-zinc-800 border border-zinc-600 text-white text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">{toast}</div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#1A1A18]/95 backdrop-blur border-b border-[#2E2E2B]">
        <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-[#666660] hover:text-white">←</button>
            <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-base font-bold">
              tres<span className="text-[#C9B99A]">decó</span>
              <span className="text-[#666660] font-normal text-xs ml-2">Taller Standard</span>
            </h1>
          </div>
          <button onClick={() => setModalOperario(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C9B99A]/40 bg-[#C9B99A]/10 text-[#C9B99A] text-xs">
            <span className="w-4 h-4 rounded-full bg-[#C9B99A]/20 flex items-center justify-center text-[8px] font-bold">{operarioNombre.charAt(0)}</span>
            {operarioNombre}
            {equipoHoy.length > 1 && <span className="text-[#C9B99A]/60">+{equipoHoy.length - 1}</span>}
          </button>
        </div>

        <div className="px-4 pb-2 max-w-lg mx-auto flex gap-2 overflow-x-auto no-scrollbar">
          <Tab id="trabajo"   label="Mi trabajo" />
          <Tab id="checklist" label="Checklist" badge={todoDespiece.length > 0 && !checklistCompleto ? todoDespiece.filter(d => !checkItems[d.id]).length : 0} />
          <Tab id="proximas"  label="Próximas" badge={pendientes.length + pausadas.length} />
          <Tab id="historial" label="Historial" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">

        {/* ── MI TRABAJO ── */}
        {vista === 'trabajo' && (
          <div className="space-y-4">
            {/* Selector de OT activa si hay varias */}
            {enProd.length > 1 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Seleccionar orden activa</p>
                <div className="space-y-1.5">
                  {enProd.map(ot => (
                    <button key={ot.id} onClick={() => seleccionarOT(ot)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${otActual?.id === ot.id ? 'border-[#C9B99A]/50 bg-[#C9B99A]/5' : 'border-[#2E2E2B] bg-[#242421] hover:border-[#3a3a37]'}`}>
                      <div>
                        <p className="text-white text-sm font-medium">{ot.cliente}</p>
                        <p className="text-[#666660] text-xs">{ot.producto} · {ot.color}</p>
                      </div>
                      <span className="text-[#666660] text-xs">Entrega: {fmtFecha(ot.fecha_entrega_comprometida)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* OT activa */}
            {otActual ? (
              <div className="space-y-3">
                {/* Tarjeta principal */}
                <div className={`bg-[#242421] border rounded-2xl p-5 ${otActual.estado === 'Pausado' ? 'border-amber-900/60' : 'border-[#2E2E2B]'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[#666660] text-xs uppercase tracking-wider mb-1">{otActual.estado === 'Pausado' ? '⏸ PAUSADO' : 'EN PRODUCCIÓN'}</p>
                      <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold text-white">{otActual.cliente}</p>
                      <p className="text-[#666660] text-sm mt-0.5">
                        {otActual.producto}
                        {otActual.color && ` · ${otActual.color}`}
                        {otActual.cantidad > 1 && ` · x${otActual.cantidad}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#444441] text-xs">Entrega</p>
                      <p className="text-white text-sm font-medium">{fmtFecha(otActual.fecha_entrega_comprometida)}</p>
                      {(() => {
                        const d = diasHabilesRestantes(otActual.fecha_entrega_comprometida)
                        if (d < 0) return <p className="text-red-400 text-xs font-bold">⚠ {Math.abs(d)}d vencido</p>
                        if (d === 0) return <p className="text-amber-400 text-xs font-bold">⚠ Vence hoy</p>
                        if (d <= 2) return <p className="text-amber-300 text-xs font-medium">{d}d hábiles</p>
                        return <p className="text-[#666660] text-xs">{d}d hábiles</p>
                      })()}
                    </div>
                  </div>

                  {/* Progreso de etapas */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white font-medium text-sm">
                        {otActual.estado === 'Listo' ? '✅ Listo para entrega' : `Etapa: ${etapaActualNombre}`}
                      </p>
                      <span className="text-[#666660] text-xs">{otActual.etapa_actual}/{etapas.length}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {etapas.map((e, i) => (
                        <div key={e} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full h-1.5 rounded-full transition-all ${
                            i < otActual.etapa_actual ? 'bg-[#C9B99A]' :
                            i === otActual.etapa_actual ? 'bg-[#C9B99A]/50' :
                            'bg-[#3a3a37]'
                          }`} />
                          <span className={`text-[9px] text-center leading-tight ${i === otActual.etapa_actual ? 'text-[#C9B99A]' : 'text-[#444441]'}`}>{e}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Problema reportado */}
                  {otActual.estado === 'Pausado' && otActual.observaciones && (
                    <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 mb-4">
                      <p className="text-amber-400 text-xs font-medium mb-0.5">Problema reportado:</p>
                      <p className="text-amber-200 text-sm">{otActual.observaciones}</p>
                    </div>
                  )}

                  {/* Checklist rápido */}
                  {todoDespiece.length > 0 && !checklistCompleto && otActual.estado !== 'Pausado' && (
                    <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 mb-4">
                      <p className="text-red-300 text-xs">
                        ⚠ Checklist de materiales incompleto — verificá antes de continuar
                      </p>
                      <button onClick={() => setVista('checklist')} className="text-red-400 text-xs underline mt-1">
                        Ir al checklist →
                      </button>
                    </div>
                  )}

                  {/* Botones de acción */}
                  {otActual.estado === 'Pausado' ? (
                    <button onClick={() => setModalReanudar(true)}
                      className="w-full py-3.5 rounded-xl bg-amber-950 border border-amber-800 text-amber-300 font-medium text-sm hover:bg-amber-900">
                      ▶ Reanudar trabajo
                    </button>
                  ) : otActual.estado === 'Listo' ? (
                    <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 text-center">
                      <p className="text-emerald-300 text-sm font-medium">✅ Listo para entrega</p>
                      <p className="text-emerald-400/70 text-xs mt-1">Administración confirma la entrega al cliente</p>
                    </div>
                  ) : otActual.estado === 'Pendiente' ? (
                    <button onClick={comenzarProduccion}
                      className="w-full py-3.5 rounded-xl bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] font-bold text-sm hover:bg-[#C9B99A]/20 transition-all">
                      ▶ Comenzar producción — {etapaActualNombre}
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => setModalProblema(true)}
                        className="py-3.5 px-4 rounded-xl bg-[#2E2E2B] border border-[#3a3a37] text-[#666660] text-sm hover:text-red-400 transition-colors">
                        ⚠
                      </button>
                      <button onClick={() => setModalFoto(true)}
                        className="py-3.5 px-4 rounded-xl bg-[#2E2E2B] border border-[#3a3a37] text-[#666660] text-sm hover:text-white transition-colors">
                        📷
                      </button>
                      <button onClick={() => setModalAvanzar(true)} disabled={!checklistCompleto && todoDespiece.length > 0}
                        className="flex-1 py-3.5 rounded-xl bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] font-bold text-sm hover:bg-[#C9B99A]/20 disabled:opacity-30 transition-all">
                        {otActual.etapa_actual >= etapas.length - 1 ? '✅ Control OK' : `Confirmar ${etapaActualNombre} →`}
                      </button>
                    </div>
                  )}
                </div>

                {/* Otras órdenes activas */}
                {(pendientes.length > 0 || pausadas.length > 0 || listas.length > 0) && (
                  <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
                    <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">También en el taller</p>
                    <div className="space-y-2">
                      {[...pausadas, ...listas, ...pendientes].slice(0, 4).map(ot => (
                        <button key={ot.id} onClick={() => seleccionarOT(ot)}
                          className="w-full flex items-center justify-between text-left hover:bg-[#2E2E2B] rounded-lg px-2 py-1.5 transition-colors">
                          <div>
                            <p className="text-white text-sm">{ot.cliente}</p>
                            <p className="text-[#444441] text-xs">{ot.producto}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR_STANDARD[ot.estado] ?? ''}`}>{ot.estado}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                {pendientes.length > 0 ? (
                  <>
                    <p className="text-[#666660] text-sm mb-3">No hay órdenes en producción</p>
                    <p className="text-[#444441] text-xs mb-4">Hay {pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''} por comenzar</p>
                    <button onClick={() => setVista('proximas')} className="text-[#C9B99A] text-sm">Ver próximas →</button>
                  </>
                ) : (
                  <p className="text-[#666660] text-sm">Sin órdenes activas</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CHECKLIST DE MATERIALES ── */}
        {vista === 'checklist' && (
          <div className="space-y-4">
            {otActual ? (
              <>
                <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
                  <p className="text-white font-medium mb-0.5">{otActual.producto}</p>
                  <p className="text-[#666660] text-xs">{otActual.cliente}</p>
                </div>

                {todoDespiece.length > 0 ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[#666660] text-xs uppercase tracking-wider">Verificar antes de comenzar</p>
                        <span className="text-[#C9B99A] text-xs">{Object.values(checkItems).filter(Boolean).length}/{todoDespiece.length}</span>
                      </div>
                      <div className="space-y-2">
                        {todoDespiece.map(item => (
                          <button key={item.id}
                            onClick={() => setCheckItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                              checkItems[item.id]
                                ? 'border-[#C9B99A]/40 bg-[#C9B99A]/5'
                                : 'border-[#2E2E2B] bg-[#242421] hover:border-[#3a3a37]'
                            }`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              checkItems[item.id] ? 'bg-[#C9B99A] border-[#C9B99A]' : 'border-[#444441]'
                            }`}>
                              {checkItems[item.id] && <span className="text-[#1A1A18] text-xs font-bold">✓</span>}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${checkItems[item.id] ? 'text-[#666660] line-through' : 'text-white'}`}>
                                {item.material}
                              </p>
                              <p className="text-[#444441] text-xs mt-0.5">
                                {item.cantidad} {item.unidad}
                                {item.descripcion && ` · ${item.descripcion}`}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {checklistCompleto ? (
                      <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 text-center">
                        <p className="text-emerald-300 font-medium">✅ Todo verificado</p>
                        <p className="text-emerald-400/70 text-xs mt-1">Podés avanzar con la producción</p>
                        <button onClick={() => setVista('trabajo')} className="text-emerald-300 text-sm underline mt-2">
                          Ir a mi trabajo →
                        </button>
                      </div>
                    ) : (
                      <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-3 text-center">
                        <p className="text-[#666660] text-xs">Tachá cada ítem a medida que lo verificás</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[#666660] text-sm mb-1">Sin despiece cargado para este producto</p>
                    <p className="text-[#444441] text-xs">Administración puede cargarlo desde el sistema</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[#444441] text-sm text-center py-8">Seleccioná una orden primero</p>
            )}
          </div>
        )}

        {/* ── PRÓXIMAS ── */}
        {vista === 'proximas' && (
          <div className="space-y-4">
            {pausadas.length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Pausadas ({pausadas.length})</p>
                <div className="space-y-2">
                  {pausadas.map(ot => (
                    <div key={ot.id} onClick={() => seleccionarOT(ot)}
                      className="bg-[#242421] border border-amber-900/40 rounded-xl p-4 cursor-pointer hover:border-amber-800/60">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-white font-medium text-sm">{ot.cliente}</p>
                          <p className="text-[#666660] text-xs">{ot.producto}{ot.color && ` · ${ot.color}`}</p>
                        </div>
                        <span className="text-amber-300 text-xs">⏸ Pausado</span>
                      </div>
                      {ot.observaciones && <p className="text-amber-400/80 text-xs">{ot.observaciones}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendientes.length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Pendientes ({pendientes.length})</p>
                <div className="space-y-2">
                  {pendientes.map(ot => (
                    <div key={ot.id} onClick={() => seleccionarOT(ot)}
                      className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4 cursor-pointer hover:border-[#3a3a37]">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{ot.cliente}</p>
                          <p className="text-[#666660] text-xs">{ot.producto}{ot.color && ` · ${ot.color}`} {ot.cantidad > 1 ? `· x${ot.cantidad}` : ''}</p>
                          <p className="text-[#444441] text-xs mt-1">Entrega: {fmtFecha(ot.fecha_entrega_comprometida)}</p>
                        </div>
                        <span className="text-[#666660] text-xs border border-[#3a3a37] px-2 py-0.5 rounded-full">Pendiente</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {listas.length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Listas para entrega ({listas.length})</p>
                <div className="space-y-2">
                  {listas.map(ot => (
                    <div key={ot.id} className="bg-[#242421] border border-emerald-900/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{ot.cliente}</p>
                          <p className="text-[#666660] text-xs">{ot.producto}</p>
                        </div>
                        <span className="text-emerald-300 text-xs">✅ Lista</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendientes.length === 0 && pausadas.length === 0 && listas.length === 0 && (
              <p className="text-[#444441] text-sm text-center py-8">Sin órdenes pendientes</p>
            )}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {vista === 'historial' && (
          <div className="space-y-3">
            {otActual ? (
              <>
                <p className="text-[#666660] text-xs uppercase tracking-wider">Historial — {otActual.cliente}</p>
                {historial.map(h => (
                  <div key={h.id} className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-3 flex gap-3">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C9B99A]/50 mt-1.5" />
                    </div>
                    <div>
                      <p className="text-white text-sm">{h.descripcion}</p>
                      <p className="text-[#444441] text-xs mt-0.5">{h.usuario} · {fmt(h.created_at)}</p>
                    </div>
                  </div>
                ))}
                {historial.length === 0 && <p className="text-[#444441] text-sm text-center py-8">Sin actividad registrada</p>}
              </>
            ) : (
              <p className="text-[#444441] text-sm text-center py-8">Seleccioná una orden para ver su historial</p>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════ */}

      {/* Equipo del turno */}
      {modalOperario && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Equipo de hoy</p>
            <p className="text-[#666660] text-xs mb-4">Marcá a todos los que están trabajando en este turno</p>

            {/* Equipo activo */}
            {equipoHoy.length > 0 && (
              <div className="mb-4">
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Trabajando ahora</p>
                <div className="flex flex-wrap gap-2">
                  {equipoHoy.map(nombre => (
                    <div key={nombre} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs ${nombre === operarioNombre ? 'border-[#C9B99A]/50 bg-[#C9B99A]/10 text-[#C9B99A]' : 'border-[#3a3a37] text-white'}`}>
                      <span className="w-4 h-4 rounded-full bg-[#C9B99A]/20 flex items-center justify-center text-[8px] font-bold text-[#C9B99A]">{nombre.charAt(0)}</span>
                      {nombre}
                      {nombre === operarioNombre && <span className="text-[#C9B99A]/60 text-[9px]">vos</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agregar al equipo */}
            <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Agregar al turno</p>
            <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
              {operarios.filter(o => ['ambos', 'standard'].includes(o.area) && !equipoHoy.includes(o.nombre)).map(op => (
                <button key={op.id}
                  onClick={() => { agregarAlEquipo(op.nombre); setOperarioId(op.id); setOperarioNombre(op.nombre) }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#3a3a37] bg-[#1A1A18] text-left hover:border-[#C9B99A]/30 hover:bg-[#C9B99A]/5 transition-all">
                  <div className="w-6 h-6 rounded-full bg-[#3a3a37] flex items-center justify-center text-xs text-[#666660] font-bold">{op.nombre.charAt(0)}</div>
                  <span className="text-white text-sm">{op.nombre}</span>
                  <span className="ml-auto text-[#444441] text-xs">+ Agregar</span>
                </button>
              ))}
              {operarios.filter(o => ['ambos', 'standard'].includes(o.area) && !equipoHoy.includes(o.nombre)).length === 0 && (
                <p className="text-[#444441] text-xs text-center py-3">Todo el equipo ya está registrado</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowSeleccionInicial(true); setOperarioId(''); setOperarioNombre(''); setEquipoHoy([]) }}
                className="py-2.5 px-4 rounded-xl border border-[#3a3a37] text-[#666660] text-xs hover:text-white">
                Cambiar turno
              </button>
              <button onClick={() => setModalOperario(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm">
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avanzar etapa */}
      {modalAvanzar && otActual && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Confirmar etapa completada</p>
            <p className="text-[#666660] text-sm mb-4">{otActual.cliente} — {otActual.producto}</p>
            <div className="bg-[#1A1A18] rounded-xl p-3 mb-4 text-center">
              <p className="text-[#C9B99A] font-bold text-lg">{etapaActualNombre}</p>
              <p className="text-[#666660] text-xs mt-1">
                {otActual.etapa_actual >= etapas.length - 1 ? '→ Producto LISTO para entrega' : `→ ${etapas[otActual.etapa_actual + 1]}`}
              </p>
            </div>
            <div className="mb-4">
              <label className="text-[#666660] text-xs mb-1 block">¿Quién completó esta etapa?</label>
              {operarios.filter(o => ['ambos', 'standard'].includes(o.area)).length > 0 ? (
                <select value={operarioId} onChange={e => { setOperarioId(e.target.value); setOperarioNombre(operarios.find(o => o.id === e.target.value)?.nombre ?? '') }}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50">
                  <option value="">Seleccionar...</option>
                  {operarios.filter(o => ['ambos', 'standard'].includes(o.area)).map(op => (
                    <option key={op.id} value={op.id}>{op.nombre}</option>
                  ))}
                </select>
              ) : (
                <input value={operarioNombre} onChange={e => setOperarioNombre(e.target.value)}
                  placeholder="Nombre"
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
              )}
            </div>
            <div className="mb-4">
              <label className="text-[#666660] text-xs mb-1 block">Notas (opcional)</label>
              <input value={notasAvanzar} onChange={e => setNotasAvanzar(e.target.value)}
                placeholder="Ej: se ajustó la medida del cajón..."
                className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAvanzar(false)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={avanzarEtapa} disabled={!nombreOperario}
                className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm disabled:opacity-40">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Foto / WhatsApp */}
      {modalFoto && otActual && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Foto de avance</p>
            <p className="text-[#666660] text-sm mb-4">{otActual.cliente} — {etapaActualNombre}</p>
            <div className="bg-[#1A1A18] rounded-xl p-3 mb-4">
              <p className="text-[#666660] text-xs mb-1">Mensaje que se enviará al cliente:</p>
              <p className="text-white text-sm italic">
                {(() => {
                  const mensajes: Record<number, string> = {
                    0: `Hola ${otActual.cliente}! 👋 Empezamos a trabajar en tu ${otActual.producto}. Te vamos a ir contando el avance!`,
                    1: `Hola ${otActual.cliente}! El corte de tu ${otActual.producto} está listo 📐`,
                    2: `Hola ${otActual.cliente}! El tapacanto de tu ${otActual.producto} está perfecto ✨`,
                    3: `Hola ${otActual.cliente}! Tu ${otActual.producto} está en armado final 🛠`,
                  }
                  return mensajes[otActual.etapa_actual] ?? `Avance de ${etapaActualNombre} completado ✓`
                })()}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalFoto(false)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={enviarFotoWhatsApp}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white font-medium text-sm hover:bg-emerald-600">
                📱 Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reportar problema */}
      {modalProblema && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Reportar problema</p>
            <p className="text-[#666660] text-sm mb-4">{otActual?.cliente} — {otActual?.producto}</p>
            <textarea value={descripcionProblema} onChange={e => setDescripcionProblema(e.target.value)}
              placeholder="Describí el problema: qué falta, qué está mal, qué bloqueó el trabajo..."
              className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none resize-none h-28 mb-4 placeholder-[#444441]"
            />
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 mb-4">
              <p className="text-red-300 text-xs">⚠ El trabajo se pausará y se notificará a Administración.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalProblema(false)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={reportarProblema} disabled={!descripcionProblema.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-900 text-red-100 font-medium text-sm disabled:opacity-40">
                Reportar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reanudar */}
      {modalReanudar && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-5">
            <p className="font-medium text-white mb-1">Reanudar trabajo</p>
            {otActual?.observaciones && (
              <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 mb-4">
                <p className="text-[#666660] text-xs mb-0.5">Problema anterior:</p>
                <p className="text-amber-200 text-sm">{otActual.observaciones}</p>
              </div>
            )}
            <textarea value={notasReanudar} onChange={e => setNotasReanudar(e.target.value)}
              placeholder="¿Cómo se resolvió el problema?"
              className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none resize-none h-20 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setModalReanudar(false)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={reanudar} className="flex-1 py-2.5 rounded-xl bg-amber-700 text-white font-medium text-sm hover:bg-amber-600">Reanudar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
