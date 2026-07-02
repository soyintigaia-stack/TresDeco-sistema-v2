'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  type OrdenTrabajo, type Alerta, type Operario, type EtapaRegistro,
  type Relevamiento, type PrecioMedida, type ProductoCatalogo, type Despiece,
  type Lead, type EstadoLead, type FuenteLead,
  ESTADO_COLOR_STANDARD, ESTADO_COLOR_MEDIDA, ESTADOS_MEDIDA,
  ETAPAS_PREVENTA, ESTADO_LEAD_CONFIG, FUENTE_LABEL,
  fmt, fmtFecha, fmtPeso, isPreVenta,
  COLORES_DISPONIBLES,
} from '@/lib/supabase'

type Vista = 'resumen' | 'standard' | 'medida' | 'cotizador' | 'catalogo' | 'crm' | 'remarketing' | 'contenido' | 'ads' | 'operarios' | 'alertas'

const BADGE_ALERTA: Record<string, { dot: string; card: string; text: string }> = {
  danger:  { dot: 'bg-red-400',   card: 'border-red-900 bg-red-950/20',    text: 'text-red-200'   },
  warning: { dot: 'bg-amber-400', card: 'border-amber-900 bg-amber-950/20', text: 'text-amber-200' },
  info:    { dot: 'bg-blue-400',  card: 'border-blue-900 bg-blue-950/20',   text: 'text-blue-200'  },
}

export default function AdminPage() {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>('resumen')
  const [ots, setOts] = useState<OrdenTrabajo[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [operarios, setOperarios] = useState<Operario[]>([])
  const [precios, setPrecios] = useState<PrecioMedida[]>([])
  const [registros, setRegistros] = useState<EtapaRegistro[]>([])
  const [relevamientos, setRelevamientos] = useState<Relevamiento[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [modalHistorial, setModalHistorial] = useState<string | null>(null)
  const [historialData, setHistorialData] = useState<any[]>([])
  const [modalReanudar, setModalReanudar] = useState<OrdenTrabajo | null>(null)
  const [modalEntrega, setModalEntrega] = useState<OrdenTrabajo | null>(null)
  const [modalAvanzar, setModalAvanzar] = useState<OrdenTrabajo | null>(null)
  const [modalPresupuesto, setModalPresupuesto] = useState<Relevamiento | null>(null)
  const [modalOperario, setModalOperario] = useState<Operario | null | 'nuevo'>(null)
  const [modalPrecio, setModalPrecio] = useState<PrecioMedida | null>(null)
  const [modalAlerta, setModalAlerta] = useState<Alerta | null>(null)
  const [notaAlerta, setNotaAlerta] = useState('')
  const [comentario, setComentario] = useState('')

  // CRM / Leads
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtroLead, setFiltroLead] = useState<EstadoLead | null>(null)
  const [modalLead, setModalLead] = useState<Lead | null | 'nuevo'>(null)
  const [leadForm, setLeadForm] = useState({
    nombre: '', telefono: '', barrio: '', producto: 'Zapatero Slim',
    color: '', cantidad: '1', metodo_pago: '', fuente: 'manual' as FuenteLead, notas: '',
  })
  const [leadEstadoEdit, setLeadEstadoEdit] = useState<EstadoLead>('nuevo')

  // Remarketing
  const [convs, setConvs] = useState<any[]>([])
  const [enviandoRemark, setEnviandoRemark] = useState<string | null>(null)
  const [remarkMsg, setRemarkMsg] = useState<Record<string, string>>({})

  // Contenido IA
  const [contForm, setContForm] = useState({ producto: '', tipo: 'post', red: 'Instagram', info_extra: '' })
  const [contTexto, setContTexto] = useState('')
  const [contGenerando, setContGenerando] = useState(false)
  const [contCopiado, setContCopiado] = useState(false)

  // Catálogo / Despieces
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([])
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoCatalogo | null>(null)
  const [despieces, setDespieces] = useState<Despiece[]>([])
  const [modalDespiece, setModalDespiece] = useState<Despiece | null | 'nuevo'>(null)
  const [despForm, setDespForm] = useState({ material: '', cantidad: '', unidad: 'm²', descripcion: '', es_checklist: true, orden: '' })

  // Form states
  const [opForm, setOpForm] = useState({ nombre: '', area: 'ambos', telefono: '' })
  const [precioForm, setPrecioForm] = useState({
    precio_m2_materiales: '',
    precio_m2_mano_obra: '',
    precio_instalacion_base: '',
    precio_instalacion_m2: '',
  })
  const [presForm, setPresForm] = useState({ precio_final: '', notas: '' })
  const [filtroStd, setFiltroStd] = useState<string | null>(null)
  const [filtroMed, setFiltroMed] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [
      { data: o }, { data: a }, { data: ops }, { data: pr }, { data: reg }, { data: rel }, { data: cat }, { data: lds }, { data: cv }
    ] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').order('fecha_entrega_comprometida', { ascending: true }),
      supabase.from('alertas').select('*').eq('resuelta', false).order('created_at', { ascending: false }),
      supabase.from('operarios').select('*').order('nombre'),
      supabase.from('precios_medida').select('*').order('tipo_mueble'),
      supabase.from('etapa_registro').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('relevamientos').select('*').order('created_at', { ascending: false }),
      supabase.from('productos_catalogo').select('*').order('codigo'),
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('conversaciones_bot').select('telefono,nombre,updated_at,mensajes').order('updated_at', { ascending: false }).limit(300),
    ])
    if (o) setOts(o)
    if (a) setAlertas(a)
    if (ops) setOperarios(ops)
    if (pr) setPrecios(pr)
    if (reg) setRegistros(reg)
    if (rel) setRelevamientos(rel)
    if (cat) setCatalogo(cat)
    if (lds) setLeads(lds)
    if (cv) setConvs(cv)
    setLoading(false)
  }, [])

  const cargarDespieces = useCallback(async (productoId: string) => {
    const { data } = await supabase.from('despieces').select('*').eq('producto_id', productoId).order('orden')
    if (data) setDespieces(data)
  }, [])

  useEffect(() => {
    cargar()
    const c = supabase.channel('admin-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relevamientos' }, cargar)
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
    await supabase.from('actividad').insert({ ot_id: modalReanudar.id, descripcion: `▶ Reanudado — Admin: ${comentario}`, usuario: 'Administración' })
    await supabase.from('alertas').update({ resuelta: true }).eq('ot_id', modalReanudar.id).eq('resuelta', false)
    setModalReanudar(null); setComentario(''); cargar()
  }

  const confirmarEntrega = async () => {
    if (!modalEntrega) return
    await supabase.from('ordenes_trabajo').update({ estado: 'Entregado', fecha_entrega_real: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() }).eq('id', modalEntrega.id)
    await supabase.from('actividad').insert({ ot_id: modalEntrega.id, descripcion: '✅ Entrega confirmada — Cliente retiró el pedido', usuario: 'Administración' })
    await supabase.from('alertas').update({ resuelta: true }).eq('ot_id', modalEntrega.id).eq('resuelta', false)
    setModalEntrega(null); cargar()
  }

  const avanzarMedida = async () => {
    if (!modalAvanzar) return
    const idx = ESTADOS_MEDIDA.indexOf(modalAvanzar.estado as any)
    const siguiente = ESTADOS_MEDIDA[idx + 1]
    if (!siguiente) return
    await supabase.from('ordenes_trabajo').update({ estado: siguiente, updated_at: new Date().toISOString() }).eq('id', modalAvanzar.id)
    await supabase.from('actividad').insert({ ot_id: modalAvanzar.id, descripcion: `→ Estado: ${modalAvanzar.estado} → ${siguiente}`, usuario: 'Administración' })
    if (siguiente === 'Corte') {
      await supabase.from('alertas').insert({ tipo: 'info', mensaje: `${modalAvanzar.codigo_proyecto ?? modalAvanzar.id} — ${modalAvanzar.cliente} pasó a Producción (Corte).`, ot_id: modalAvanzar.id })
    }
    setModalAvanzar(null); cargar()
  }

  const resolverAlerta = async () => {
    if (!modalAlerta) return
    await supabase.from('alertas').update({ resuelta: true }).eq('id', modalAlerta.id)
    if (modalAlerta.ot_id && notaAlerta.trim()) {
      await supabase.from('actividad').insert({
        ot_id: modalAlerta.ot_id,
        descripcion: `✔ Alerta resuelta — ${notaAlerta.trim()}`,
        usuario: 'Administración',
      })
    }
    setModalAlerta(null); setNotaAlerta(''); cargar()
  }

  // Operarios CRUD
  const guardarOperario = async () => {
    if (!opForm.nombre.trim()) return
    const datos = { nombre: opForm.nombre.trim(), area: opForm.area, telefono: opForm.telefono.trim() || null }
    if (modalOperario === 'nuevo') {
      await supabase.from('operarios').insert(datos)
    } else if (modalOperario) {
      await supabase.from('operarios').update(datos).eq('id', modalOperario.id)
    }
    setModalOperario(null); setOpForm({ nombre: '', area: 'ambos', telefono: '' }); cargar()
  }

  const toggleOperario = async (op: Operario) => {
    await supabase.from('operarios').update({ activo: !op.activo }).eq('id', op.id)
    cargar()
  }

  // Cotizador — guardar precios
  const guardarPrecio = async () => {
    if (!modalPrecio) return
    await supabase.from('precios_medida').update({
      precio_m2_materiales:    parseFloat(precioForm.precio_m2_materiales) || 0,
      precio_m2_mano_obra:     parseFloat(precioForm.precio_m2_mano_obra) || 0,
      precio_instalacion_base: parseFloat(precioForm.precio_instalacion_base) || 0,
      precio_instalacion_m2:   parseFloat(precioForm.precio_instalacion_m2) || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', modalPrecio.id)
    setModalPrecio(null); cargar()
  }

  // Presupuesto — aprobar y fijar precio final
  const aprobarPresupuesto = async () => {
    if (!modalPresupuesto) return
    const precioFinal = parseFloat(presForm.precio_final)
    if (!precioFinal || precioFinal <= 0) {
      alert('Ingresá el precio final antes de aprobar.')
      return
    }
    await supabase.from('relevamientos').update({
      precio_final: precioFinal,
      aprobado_admin: true,
      notas_presupuesto: presForm.notas || modalPresupuesto.notas_presupuesto,
    }).eq('id', modalPresupuesto.id)
    // Avanzar la OT a "Presupuesto" si está en Relevamiento o Diseño y Despiece
    const ot = ots.find(o => o.id === modalPresupuesto.ot_id)
    if (ot && (ot.estado === 'Relevamiento' || ot.estado === 'Diseño y Despiece')) {
      await supabase.from('ordenes_trabajo').update({ estado: 'Presupuesto', updated_at: new Date().toISOString() }).eq('id', ot.id)
      await supabase.from('actividad').insert({ ot_id: ot.id, descripcion: `💰 Presupuesto aprobado — $${precioFinal.toLocaleString('es-AR')}`, usuario: 'Administración' })
    }
    setModalPresupuesto(null); setPresForm({ precio_final: '', notas: '' }); cargar()
  }

  // CRM — CRUD de leads
  const guardarLead = async () => {
    if (!leadForm.nombre.trim()) return
    const datos = {
      nombre: leadForm.nombre.trim(),
      telefono: leadForm.telefono.trim() || null,
      barrio: leadForm.barrio.trim() || null,
      producto: leadForm.producto,
      color: leadForm.color || null,
      cantidad: parseInt(leadForm.cantidad) || 1,
      metodo_pago: leadForm.metodo_pago || null,
      fuente: leadForm.fuente,
      notas: leadForm.notas.trim() || null,
      estado: leadEstadoEdit,
    }
    if (modalLead === 'nuevo') {
      await supabase.from('leads').insert(datos)
    } else if (modalLead) {
      await supabase.from('leads').update({ ...datos, updated_at: new Date().toISOString() }).eq('id', modalLead.id)
    }
    setModalLead(null)
    cargar()
  }

  const cambiarEstadoLead = async (id: string, estado: EstadoLead) => {
    await supabase.from('leads').update({ estado, updated_at: new Date().toISOString() }).eq('id', id)
    cargar()
  }

  const convertirLeadEnOT = async (lead: Lead) => {
    const prod = catalogo.find(p => p.nombre === lead.producto) ?? catalogo[0]
    if (!prod) return
    const { addDiasHabiles } = await import('@/lib/supabase')
    const fechaEntrega = addDiasHabiles(new Date(), prod.dias_produccion).toISOString().split('T')[0]
    const id = `STD-${Date.now()}`
    const { error } = await supabase.from('ordenes_trabajo').insert({
      id,
      tipo: 'standard',
      cliente: lead.nombre,
      telefono: lead.telefono ?? '',
      codigo_producto: prod.codigo,
      producto: prod.nombre,
      color: lead.color ?? 'Blanco',
      cantidad: lead.cantidad,
      estado: 'Pendiente',
      etapa_actual: 0,
      fecha_ingreso: new Date().toISOString().split('T')[0],
      fecha_entrega_comprometida: fechaEntrega,
      origen: lead.fuente === 'instagram' ? 'Instagram' : lead.fuente === 'whatsapp' ? 'WhatsApp' : 'Manual',
      precio: prod.precio_base ?? 0,
      precio_sena: prod.precio_sena ?? 0,
    })
    if (!error) {
      await supabase.from('leads').update({ convertido: true, ot_id: id, estado: 'cerrado', updated_at: new Date().toISOString() }).eq('id', lead.id)
      await supabase.from('actividad').insert({ ot_id: id, descripcion: `📦 OT creada desde CRM — lead de ${FUENTE_LABEL[lead.fuente]}`, usuario: 'Administración' })
      cargar()
    }
  }

  const convertirLeadEnOTMedida = async (lead: Lead) => {
    const id = `MED-${Date.now()}`
    const hoy = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('ordenes_trabajo').insert({
      id,
      tipo: 'medida',
      cliente: lead.nombre,
      telefono: lead.telefono ?? '',
      producto: lead.producto,
      color: lead.color ?? null,
      cantidad: lead.cantidad,
      estado: 'Consulta',
      etapa_actual: 0,
      fecha_ingreso: hoy,
      fecha_entrega_comprometida: hoy,
      origen: lead.fuente === 'instagram' ? 'Instagram' : lead.fuente === 'whatsapp' ? 'WhatsApp' : 'Manual',
      precio: 0,
      observaciones: lead.notas ?? '',
    })
    if (!error) {
      await supabase.from('leads').update({ convertido: true, ot_id: id, estado: 'cerrado', updated_at: new Date().toISOString() }).eq('id', lead.id)
      await supabase.from('actividad').insert({ ot_id: id, descripcion: `📐 OT A Medida creada desde CRM — ${lead.producto}`, usuario: 'Administración' })
      cargar()
    }
  }

  // Despieces CRUD
  const guardarDespiece = async () => {
    if (!productoSeleccionado || !despForm.material.trim()) return
    const datos = {
      producto_id: productoSeleccionado.id,
      material: despForm.material.trim(),
      cantidad: parseFloat(despForm.cantidad) || 1,
      unidad: despForm.unidad,
      descripcion: despForm.descripcion.trim(),
      es_checklist: despForm.es_checklist,
      orden: parseInt(despForm.orden) || despieces.length + 1,
    }
    if (modalDespiece === 'nuevo') {
      await supabase.from('despieces').insert(datos)
    } else if (modalDespiece) {
      await supabase.from('despieces').update(datos).eq('id', modalDespiece.id)
    }
    setModalDespiece(null)
    setDespForm({ material: '', cantidad: '', unidad: 'm²', descripcion: '', es_checklist: true, orden: '' })
    cargarDespieces(productoSeleccionado.id)
  }

  const eliminarDespiece = async (id: string) => {
    if (!productoSeleccionado) return
    await supabase.from('despieces').delete().eq('id', id)
    cargarDespieces(productoSeleccionado.id)
  }

  const seleccionarProductoCatalogo = (p: ProductoCatalogo) => {
    setProductoSeleccionado(p)
    cargarDespieces(p.id)
  }

  // Derivaciones
  const std = ots.filter(o => o.tipo === 'standard')
  const med = ots.filter(o => o.tipo === 'medida')
  const stdFiltradas = filtroStd ? std.filter(o => o.estado === filtroStd) : std
  const medFiltradas = filtroMed ? med.filter(o => o.estado === filtroMed) : med

  // Presupuestos pendientes de aprobación
  const presupuestosPendientes = relevamientos.filter(r => !r.aprobado_admin)

  // Métricas operarios — trabajos por persona (últimos 30 días)
  const hoy = new Date()
  const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const registrosRecientes = registros.filter(r => r.fecha >= hace30)
  const metricasOp = operarios.map(op => ({
    ...op,
    etapas: registrosRecientes.filter(r => r.operario_id === op.id).length,
  })).sort((a, b) => b.etapas - a.etapas)

  const KPI = ({ label, value, sub, onClick }: { label: string; value: string | number; sub?: string; onClick?: () => void }) => (
    <div onClick={onClick} className={`bg-[#2E2E2B] rounded-xl p-4 border border-[#3a3a37] transition-all ${onClick ? 'cursor-pointer hover:border-[#C9B99A]/40 hover:bg-[#C9B99A]/5' : ''}`}>
      <p className="text-[#666660] text-xs uppercase tracking-wider mb-1">{label}</p>
      <p style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[#666660] text-xs mt-1">{sub}</p>}
      {onClick && <p className="text-[#C9B99A]/50 text-[10px] mt-1">Ver detalle →</p>}
    </div>
  )

  const Tab = ({ id, label, badge }: { id: Vista; label: string; badge?: number }) => (
    <button
      onClick={() => setVista(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors relative whitespace-nowrap ${
        vista === id ? 'bg-[#C9B99A] text-[#1A1A18]' : 'text-[#666660] hover:text-white'
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{badge}</span>
      )}
    </button>
  )

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center">
      <p className="text-[#666660]">Cargando…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1A1A18] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#1A1A18]/95 backdrop-blur border-b border-[#2E2E2B]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-base font-bold">
              tres<span className="text-[#C9B99A]">decó</span>
              <span className="text-[#666660] font-normal text-xs ml-2">Sistema</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 ml-auto mr-2 shrink-0">
            <a
              href="https://tresdecoamoblamientos.com/p"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#C9B99A] hover:text-white transition-colors hidden sm:block"
            >Ver catálogo →</a>
            <button
              onClick={async () => {
                const { createClient } = await import('@supabase/supabase-js')
                const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
                await sb.auth.signOut()
                window.location.href = '/login'
              }}
              className="text-xs text-[#666660] hover:text-red-400 transition-colors"
            >Salir</button>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <Tab id="resumen"   label="Resumen" />
            <Tab id="standard"  label="Standard" />
            <Tab id="medida"    label="A Medida" />
            <Tab id="cotizador" label="Cotizador" badge={presupuestosPendientes.length} />
            <Tab id="crm"          label="CRM" badge={leads.filter(l => l.estado === 'nuevo').length} />
            <Tab id="remarketing"  label="Remarketing" badge={leads.filter(l => ['nuevo','contactado','interesado'].includes(l.estado) && convs.find(c => c.telefono === l.telefono && new Date(c.updated_at) < new Date(Date.now() - 24*60*60*1000))).length || undefined} />
            <Tab id="contenido"    label="Contenido IA" />
            <Tab id="ads"          label="Meta Ads" />
            <Tab id="catalogo"     label="Catálogo" />
            <Tab id="operarios"    label="Operarios" />
            <Tab id="alertas"   label="Alertas" badge={alertas.length} />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ─── RESUMEN ─── */}
        {vista === 'resumen' && (
          <div className="space-y-6">
            <div>
              <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">Standard</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="En producción" value={std.filter(o => o.estado === 'En producción').length}
                  onClick={() => { setVista('standard'); setFiltroStd('En producción') }} />
                <KPI label="Listos" value={std.filter(o => o.estado === 'Listo').length}
                  onClick={() => { setVista('standard'); setFiltroStd('Listo') }} />
                <KPI label="Pausados" value={std.filter(o => o.estado === 'Pausado').length}
                  onClick={() => { setVista('standard'); setFiltroStd('Pausado') }} />
                <KPI label="Entregados" value={std.filter(o => o.estado === 'Entregado').length} sub="histórico total"
                  onClick={() => { setVista('standard'); setFiltroStd('Entregado') }} />
              </div>
            </div>
            <div>
              <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">A Medida</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Pre-venta" value={med.filter(o => ETAPAS_PREVENTA.includes(o.estado as any)).length} sub="consulta→esperando seña"
                  onClick={() => { setVista('medida'); setFiltroMed(null) }} />
                <KPI label="Señados" value={med.filter(o => o.estado === 'Señado').length} sub="venta confirmada"
                  onClick={() => { setVista('medida'); setFiltroMed('Señado') }} />
                <KPI label="En producción" value={med.filter(o => ['Corte','Tapacanto','Armado','Control'].includes(o.estado)).length}
                  onClick={() => { setVista('medida'); setFiltroMed('Corte') }} />
                <KPI label="Entregados" value={med.filter(o => o.estado === 'Entregado').length} sub="histórico total"
                  onClick={() => { setVista('medida'); setFiltroMed('Entregado') }} />
              </div>
            </div>
            {presupuestosPendientes.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-4">
                <p className="text-amber-300 text-sm font-medium mb-2">
                  ⚠ {presupuestosPendientes.length} presupuesto{presupuestosPendientes.length > 1 ? 's' : ''} pendiente{presupuestosPendientes.length > 1 ? 's' : ''} de aprobación
                </p>
                <button onClick={() => setVista('cotizador')} className="text-amber-400 text-xs underline">
                  Ir al cotizador →
                </button>
              </div>
            )}
            {leads.length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">CRM — Leads</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI label="Nuevos" value={leads.filter(l => l.estado === 'nuevo').length}
                    onClick={() => { setVista('crm'); setFiltroLead('nuevo') }} />
                  <KPI label="En seguimiento" value={leads.filter(l => ['contactado','interesado','presupuestado'].includes(l.estado)).length}
                    onClick={() => { setVista('crm'); setFiltroLead(null) }} />
                  <KPI label="Cerrados" value={leads.filter(l => l.estado === 'cerrado').length} sub="convertidos en OT"
                    onClick={() => { setVista('crm'); setFiltroLead('cerrado') }} />
                  <KPI label="Perdidos" value={leads.filter(l => l.estado === 'perdido').length}
                    onClick={() => { setVista('crm'); setFiltroLead('perdido') }} />
                </div>
              </div>
            )}
            {/* Top operarios del mes */}
            {metricasOp.filter(o => o.etapas > 0).length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">Operarios — últimos 30 días</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {metricasOp.filter(o => o.etapas > 0).slice(0, 6).map(op => (
                    <div key={op.id} className="bg-[#2E2E2B] rounded-xl p-4 border border-[#3a3a37]">
                      <p className="text-white font-medium text-sm">{op.nombre}</p>
                      <p className="text-[#C9B99A] text-xl font-bold mt-1">{op.etapas}</p>
                      <p className="text-[#666660] text-xs">etapas completadas</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STANDARD ─── */}
        {vista === 'standard' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {[null, 'Pendiente', 'En producción', 'Pausado', 'Listo', 'Entregado'].map(f => (
                <button key={f ?? 'todos'} onClick={() => setFiltroStd(f)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${filtroStd === f ? 'bg-[#C9B99A] text-[#1A1A18] font-medium' : 'bg-[#2E2E2B] text-[#666660] hover:text-white'}`}>
                  {f ?? 'Todos'} {f ? `(${std.filter(o => o.estado === f).length})` : `(${std.length})`}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {stdFiltradas.map(ot => (
                <div key={ot.id} className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-medium text-sm">{ot.cliente}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR_STANDARD[ot.estado] ?? 'bg-zinc-800 text-zinc-400'}`}>{ot.estado}</span>
                      </div>
                      <p className="text-[#666660] text-xs">{ot.producto} · {ot.color} · x{ot.cantidad}</p>
                      <p className="text-[#444441] text-xs mt-1">Entrega: {fmtFecha(ot.fecha_entrega_comprometida)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {ot.estado === 'Pausado' && (
                        <button onClick={() => { setModalReanudar(ot); setComentario('') }}
                          className="text-xs bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-900">
                          Reanudar
                        </button>
                      )}
                      {ot.estado === 'Listo' && (
                        <button onClick={() => setModalEntrega(ot)}
                          className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1.5 rounded-lg hover:bg-emerald-900">
                          Confirmar entrega
                        </button>
                      )}
                      <button onClick={() => verHistorial(ot.id)}
                        className="text-xs bg-[#2E2E2B] text-[#666660] border border-[#3a3a37] px-3 py-1.5 rounded-lg hover:text-white">
                        Historial
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {stdFiltradas.length === 0 && (
                <p className="text-[#444441] text-sm text-center py-8">Sin órdenes en este estado</p>
              )}
            </div>
          </div>
        )}

        {/* ─── A MEDIDA ─── */}
        {vista === 'medida' && (
          <div className="space-y-4">
            {/* Pipeline visual */}
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-2 min-w-max">
                {ESTADOS_MEDIDA.map(estado => {
                  const count = med.filter(o => o.estado === estado).length
                  return (
                    <button key={estado} onClick={() => setFiltroMed(filtroMed === estado ? null : estado)}
                      className={`flex flex-col items-center px-3 py-2 rounded-lg border transition-all min-w-[90px] ${
                        filtroMed === estado
                          ? 'border-[#C9B99A] bg-[#C9B99A]/10'
                          : 'border-[#2E2E2B] bg-[#242421] hover:border-[#444441]'
                      }`}>
                      <span className="text-white font-bold text-lg">{count}</span>
                      <span className="text-[#666660] text-[10px] text-center leading-tight mt-0.5">{estado}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              {medFiltradas.map(ot => {
                const idxActual = ESTADOS_MEDIDA.indexOf(ot.estado as any)
                const pct = Math.round((idxActual / (ESTADOS_MEDIDA.length - 1)) * 100)
                const rel = relevamientos.find(r => r.ot_id === ot.id)
                return (
                  <div key={ot.id} className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {ot.codigo_proyecto && <span className="text-[#C9B99A] text-xs font-mono">{ot.codigo_proyecto}</span>}
                          <span className="text-white font-medium text-sm">{ot.cliente}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR_MEDIDA[ot.estado] ?? 'bg-zinc-800 text-zinc-400'}`}>{ot.estado}</span>
                        </div>
                        <p className="text-[#666660] text-xs">{ot.producto}</p>
                        {rel && rel.precio_final && (
                          <p className="text-[#C9B99A] text-xs mt-1">{fmtPeso(rel.precio_final)}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-[#1A1A18] rounded-full h-1">
                            <div className="bg-[#C9B99A] rounded-full h-1 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[#444441] text-xs">{pct}%</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {ot.estado !== 'Entregado' && (
                          <button onClick={() => setModalAvanzar(ot)}
                            className="text-xs bg-[#C9B99A]/10 text-[#C9B99A] border border-[#C9B99A]/30 px-3 py-1.5 rounded-lg hover:bg-[#C9B99A]/20">
                            Avanzar →
                          </button>
                        )}
                        {rel && !rel.aprobado_admin && (
                          <button onClick={() => { setModalPresupuesto(rel); setPresForm({ precio_final: String(rel.precio_estimado || ''), notas: rel.notas_presupuesto || '' }) }}
                            className="text-xs bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-900">
                            Aprobar $
                          </button>
                        )}
                        <button onClick={() => router.push(`/relevamiento?ot=${ot.id}`)}
                          className="text-xs bg-[#2E2E2B] text-[#666660] border border-[#3a3a37] px-3 py-1.5 rounded-lg hover:text-white">
                          Relevamiento
                        </button>
                        <button onClick={() => verHistorial(ot.id)}
                          className="text-xs bg-[#2E2E2B] text-[#666660] border border-[#3a3a37] px-3 py-1.5 rounded-lg hover:text-white">
                          Historial
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {medFiltradas.length === 0 && (
                <p className="text-[#444441] text-sm text-center py-8">Sin proyectos en este estado</p>
              )}
            </div>
          </div>
        )}

        {/* ─── COTIZADOR ─── */}
        {vista === 'cotizador' && (
          <div className="space-y-6">
            {/* Presupuestos pendientes */}
            {presupuestosPendientes.length > 0 && (
              <div>
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">Pendientes de aprobación</p>
                <div className="space-y-3">
                  {presupuestosPendientes.map(rel => {
                    const ot = ots.find(o => o.id === rel.ot_id)
                    return (
                      <div key={rel.id} className="bg-[#242421] border border-amber-900/40 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {ot?.codigo_proyecto && <span className="text-[#C9B99A] text-xs font-mono">{ot.codigo_proyecto}</span>}
                              <span className="text-white font-medium text-sm">{rel.cliente}</span>
                            </div>
                            <p className="text-[#666660] text-xs">{rel.tipo_mueble} · {rel.m2_calculado} m²</p>
                            <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                              <div>
                                <p className="text-[#444441]">Materiales</p>
                                <p className="text-white">{fmtPeso(rel.precio_materiales || 0)}</p>
                              </div>
                              <div>
                                <p className="text-[#444441]">Mano de obra</p>
                                <p className="text-white">{fmtPeso(rel.precio_mano_obra || 0)}</p>
                              </div>
                              <div>
                                <p className="text-[#444441]">Instalación</p>
                                <p className="text-white">{fmtPeso(rel.precio_instalacion || 0)}</p>
                              </div>
                            </div>
                            <p className="text-[#C9B99A] font-bold mt-2">Total estimado: {fmtPeso(rel.precio_estimado || 0)}</p>
                          </div>
                          <button
                            onClick={() => { setModalPresupuesto(rel); setPresForm({ precio_final: String(rel.precio_estimado || ''), notas: rel.notas_presupuesto || '' }) }}
                            className="text-xs bg-[#C9B99A] text-[#1A1A18] font-medium px-4 py-2 rounded-lg hover:bg-[#b5a688] flex-shrink-0">
                            Aprobar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tabla de precios */}
            <div>
              <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">Tabla de precios — A Medida</p>
              <p className="text-[#444441] text-xs mb-3">Hacé click en cualquier fila para editar los precios. Son usados automáticamente al calcular el cotizador del relevamiento.</p>
              <div className="space-y-2">
                {precios.map(p => (
                  <div key={p.id}
                    onClick={() => { setModalPrecio(p); setPrecioForm({ precio_m2_materiales: String(p.precio_m2_materiales), precio_m2_mano_obra: String(p.precio_m2_mano_obra), precio_instalacion_base: String(p.precio_instalacion_base), precio_instalacion_m2: String(p.precio_instalacion_m2) }) }}
                    className="bg-[#242421] border border-[#2E2E2B] hover:border-[#C9B99A]/40 rounded-xl p-4 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">{p.tipo_mueble}</span>
                      <span className="text-[#444441] text-xs">editar →</span>
                    </div>
                    {(p.precio_m2_materiales + p.precio_m2_mano_obra) > 0 ? (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div><p className="text-[#444441]">Mat/m²</p><p className="text-[#C9B99A]">{fmtPeso(p.precio_m2_materiales)}</p></div>
                        <div><p className="text-[#444441]">MO/m²</p><p className="text-[#C9B99A]">{fmtPeso(p.precio_m2_mano_obra)}</p></div>
                        <div><p className="text-[#444441]">Inst. base</p><p className="text-[#C9B99A]">{fmtPeso(p.precio_instalacion_base)}</p></div>
                        <div><p className="text-[#444441]">Inst/m²</p><p className="text-[#C9B99A]">{fmtPeso(p.precio_instalacion_m2)}</p></div>
                      </div>
                    ) : (
                      <p className="text-[#444441] text-xs mt-1">Sin precios cargados — click para configurar</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── CRM ─── */}
        {vista === 'crm' && (() => {
          const columnas: { estado: EstadoLead; titulo: string }[] = [
            { estado: 'nuevo',        titulo: 'Nuevos'        },
            { estado: 'contactado',   titulo: 'Contactados'   },
            { estado: 'interesado',   titulo: 'Interesados'   },
            { estado: 'presupuestado',titulo: 'Presupuestados'},
          ]

          const diasSinMovimiento = (lead: Lead) =>
            Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)

          const esStandard = (lead: Lead) => catalogo.some(p => p.nombre === lead.producto)

          const accionPrimaria = (lead: Lead): { texto: string; accion: () => void } => {
            const std = esStandard(lead)
            if (std) {
              if (lead.estado === 'nuevo') return { texto: '→ Marcar contactado', accion: () => cambiarEstadoLead(lead.id, 'contactado') }
              if (lead.estado === 'contactado') return { texto: '→ Confirmar interés', accion: () => cambiarEstadoLead(lead.id, 'interesado') }
              return { texto: 'Seña confirmada → OT', accion: () => convertirLeadEnOT(lead) }
            } else {
              if (lead.estado === 'nuevo') return { texto: '→ Coordinar relevamiento', accion: () => cambiarEstadoLead(lead.id, 'contactado') }
              if (lead.estado === 'contactado') return { texto: '→ Relevamiento hecho', accion: () => cambiarEstadoLead(lead.id, 'interesado') }
              if (lead.estado === 'interesado') return { texto: '→ Presupuesto enviado', accion: () => cambiarEstadoLead(lead.id, 'presupuestado') }
              return { texto: 'Seña confirmada → OT Medida', accion: () => convertirLeadEnOTMedida(lead) }
            }
          }

          const urgenciaClase = (dias: number) =>
            dias >= 4 ? 'text-red-500' : dias >= 2 ? 'text-amber-500' : 'text-[#555552]'

          const urgenciaTexto = (dias: number) =>
            dias === 0 ? 'Hoy' : dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`

          const showArchivo = filtroLead === 'cerrado' || filtroLead === 'perdido'

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setFiltroLead(null)}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${filtroLead === null ? 'bg-[#C9B99A] text-[#1A1A18] font-medium' : 'bg-[#2E2E2B] text-[#666660] hover:text-white'}`}>
                    Pipeline
                  </button>
                  <button onClick={() => setFiltroLead('cerrado')}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${filtroLead === 'cerrado' ? 'bg-[#C9B99A] text-[#1A1A18] font-medium' : 'bg-[#2E2E2B] text-[#666660] hover:text-white'}`}>
                    Cerrados ({leads.filter(l => l.estado === 'cerrado').length})
                  </button>
                  <button onClick={() => setFiltroLead('perdido')}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${filtroLead === 'perdido' ? 'bg-[#C9B99A] text-[#1A1A18] font-medium' : 'bg-[#2E2E2B] text-[#666660] hover:text-white'}`}>
                    Perdidos ({leads.filter(l => l.estado === 'perdido').length})
                  </button>
                </div>
                <div className="flex gap-2">
                  <a href="https://docs.google.com/spreadsheets/d/1TaaG04ZHAKara64_1XmyIM8NABWX78uZvgkp7phQntE/edit" target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-[#2E2E2B] text-[#C9B99A] border border-[#3a3a37] font-medium px-3 py-2 rounded-lg hover:bg-[#3a3a37] flex items-center gap-1.5">
                    📊 Precios / Catálogo
                  </a>
                  <button onClick={() => { setModalLead('nuevo'); setLeadEstadoEdit('nuevo'); setLeadForm({ nombre: '', telefono: '', barrio: '', producto: 'Zapatero Slim', color: '', cantidad: '1', metodo_pago: '', fuente: 'manual', notas: '' }) }}
                    className="text-xs bg-[#C9B99A] text-[#1A1A18] font-medium px-4 py-2 rounded-lg hover:bg-[#b5a688]">
                    + Agregar lead
                  </button>
                </div>
              </div>

              {/* Archivo: cerrados / perdidos */}
              {showArchivo && (
                <div className="space-y-2">
                  {leads.filter(l => l.estado === filtroLead).map(lead => (
                    <div key={lead.id} className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white text-sm font-medium">{lead.nombre}</span>
                          {lead.convertido && <span className="text-xs text-emerald-400">✓ OT creada</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-[#666660]">
                          <span>{lead.producto}{lead.color ? ` · ${lead.color}` : ''}</span>
                          {lead.barrio && <span>📍 {lead.barrio}</span>}
                          <span>{fmt(lead.created_at)}</span>
                        </div>
                      </div>
                      <button onClick={() => { setModalLead(lead); setLeadEstadoEdit(lead.estado); setLeadForm({ nombre: lead.nombre, telefono: lead.telefono ?? '', barrio: lead.barrio ?? '', producto: lead.producto, color: lead.color ?? '', cantidad: String(lead.cantidad), metodo_pago: lead.metodo_pago ?? '', fuente: lead.fuente, notas: lead.notas ?? '' }) }}
                        className="text-xs text-[#666660] border border-[#3a3a37] px-3 py-1.5 rounded-lg hover:text-white flex-shrink-0">
                        Editar
                      </button>
                    </div>
                  ))}
                  {leads.filter(l => l.estado === filtroLead).length === 0 && (
                    <div className="text-center py-10 text-[#666660] text-sm">Sin leads en este estado</div>
                  )}
                </div>
              )}

              {/* Kanban */}
              {!showArchivo && (
                <div className="grid grid-cols-4 gap-3">
                  {columnas.map(col => {
                    const colLeads = leads.filter(l => l.estado === col.estado)
                    return (
                      <div key={col.estado} className="bg-[#1E1E1B] rounded-xl p-3 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[#666660] text-xs font-medium uppercase tracking-wider">{col.titulo}</span>
                          <span className="text-[11px] bg-[#2E2E2B] text-[#666660] px-2 py-0.5 rounded-full">{colLeads.length}</span>
                        </div>
                        <div className="space-y-2">
                          {colLeads.map(lead => {
                            const dias = diasSinMovimiento(lead)
                            const std = esStandard(lead)
                            const { texto: textoAccion, accion } = accionPrimaria(lead)
                            return (
                              <div key={lead.id} className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-3">
                                {/* Nombre + badge tipo */}
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <span className="text-white text-sm font-medium leading-tight">{lead.nombre}</span>
                                  {!std && (
                                    <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-900 px-1.5 py-0.5 rounded-full flex-shrink-0">medida</span>
                                  )}
                                </div>
                                {/* Producto */}
                                <p className="text-xs text-[#999994] mb-1 leading-snug">
                                  {lead.producto}{lead.color ? ` · ${lead.color}` : ''}{lead.cantidad > 1 ? ` · x${lead.cantidad}` : ''}
                                </p>
                                {/* Meta */}
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[#888780] mb-1">
                                  {lead.barrio && <span>📍 {lead.barrio}</span>}
                                  {lead.telefono && <span>📱 {lead.telefono}</span>}
                                  <span>{FUENTE_LABEL[lead.fuente]}</span>
                                </div>
                                {/* Urgencia */}
                                <p className={`text-[11px] mb-2 ${urgenciaClase(dias)}`}>🕐 {urgenciaTexto(dias)}</p>
                                {/* Notas */}
                                {lead.notas && (
                                  <p className="text-[#888780] text-[11px] italic mb-2 leading-snug line-clamp-2">{lead.notas}</p>
                                )}
                                {/* WhatsApp */}
                                {lead.telefono && (
                                  <a href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 w-full text-xs text-emerald-400 bg-emerald-950 border border-emerald-900 px-3 py-1.5 rounded-lg hover:bg-emerald-900 mb-1.5">
                                    💬 WhatsApp
                                  </a>
                                )}
                                {/* Acción primaria */}
                                {lead.convertido ? (
                                  <span className="block text-center text-xs text-emerald-400 py-1.5">✓ OT creada</span>
                                ) : (
                                  <button onClick={accion}
                                    className="w-full text-xs bg-[#C9B99A] text-[#1A1A18] font-medium px-3 py-1.5 rounded-lg hover:bg-[#b5a688] mb-1.5">
                                    {textoAccion}
                                  </button>
                                )}
                                {/* Acciones secundarias */}
                                <div className="flex gap-1">
                                  <button onClick={() => { setModalLead(lead); setLeadEstadoEdit(lead.estado); setLeadForm({ nombre: lead.nombre, telefono: lead.telefono ?? '', barrio: lead.barrio ?? '', producto: lead.producto, color: lead.color ?? '', cantidad: String(lead.cantidad), metodo_pago: lead.metodo_pago ?? '', fuente: lead.fuente, notas: lead.notas ?? '' }) }}
                                    className="flex-1 text-[11px] text-[#888780] border border-[#3a3a37] px-2 py-1 rounded-lg hover:text-white transition-colors">
                                    Editar
                                  </button>
                                  <button onClick={() => cambiarEstadoLead(lead.id, 'perdido')}
                                    className="flex-1 text-[11px] text-[#888780] border border-[#3a3a37] px-2 py-1 rounded-lg hover:text-red-400 transition-colors">
                                    Perdido
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                          {colLeads.length === 0 && (
                            <div className="text-center py-6 text-[#333330] text-xs border border-dashed border-[#2A2A27] rounded-xl">
                              Sin leads
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {/* ─── REMARKETING ─── */}
        {vista === 'remarketing' && (() => {
          const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const abandonados = leads
            .filter(l => ['nuevo', 'contactado', 'interesado'].includes(l.estado))
            .map(l => {
              const conv = convs.find(c => c.telefono === l.telefono)
              if (!conv) return null
              const ultima = new Date(conv.updated_at)
              if (ultima >= hace24h) return null
              const msgs: any[] = conv.mensajes ?? []
              const ultimoMsg = msgs.filter(m => m.role === 'user').slice(-1)[0]?.content ?? ''
              const horasDesde = Math.floor((Date.now() - ultima.getTime()) / 3600000)
              return { lead: l, conv, ultimoMsg, horasDesde }
            })
            .filter(Boolean) as { lead: Lead; conv: any; ultimoMsg: string; horasDesde: number }[]

          const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-lg">Remarketing</h2>
                  <p className="text-[#666] text-xs mt-0.5">Clientes que mostraron interés y no completaron la compra — sin actividad hace más de 24hs</p>
                </div>
                <span className="text-xs bg-[#2E2E2B] px-3 py-1 rounded-full text-[#C9B99A]">{abandonados.length} pendientes</span>
              </div>

              {abandonados.length === 0 && (
                <div className="text-center py-16 text-[#555]">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="text-sm">No hay conversaciones abandonadas. ¡Todo al día!</p>
                </div>
              )}

              <div className="space-y-3">
                {abandonados.map(({ lead, ultimoMsg, horasDesde }) => {
                  const msgPredeterminado = remarkMsg[lead.id] ?? `Hola ${lead.nombre?.split(' ')[0] || ''}! 👋 Soy Valentina de TresDeco. Vi que estuviste consultando por el *${lead.producto}*. ¿Pudiste pensarlo? Estoy acá para cualquier duda o para ayudarte a reservarlo.`
                  return (
                    <div key={lead.id} className="bg-[#2E2E2B] rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{lead.nombre || 'Sin nombre'}</span>
                            <span className="text-xs text-[#C9B99A] bg-[#C9B99A]/10 px-2 py-0.5 rounded-full">{lead.producto}</span>
                          </div>
                          <p className="text-[#888] text-xs mt-0.5">
                            {lead.telefono} · {lead.barrio || 'sin barrio'} · hace {horasDesde}hs sin actividad
                          </p>
                          {ultimoMsg && (
                            <p className="text-[#666] text-xs mt-1 italic truncate max-w-xs">"{ultimoMsg}"</p>
                          )}
                        </div>
                        <a
                          href={`https://wa.me/${lead.telefono}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#25D366] hover:underline shrink-0"
                        >
                          Abrir chat
                        </a>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-[#888]">Mensaje a enviar:</p>
                        <textarea
                          value={msgPredeterminado}
                          onChange={e => setRemarkMsg(prev => ({ ...prev, [lead.id]: e.target.value }))}
                          rows={3}
                          className="w-full bg-[#1A1A18] text-sm text-white rounded-lg px-3 py-2 border border-[#3a3a37] resize-none focus:outline-none focus:border-[#C9B99A]"
                        />
                        <div className="flex gap-2 justify-end">
                          {lead.producto && (
                            <a
                              href={`${APP_URL}/p/${lead.producto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1.5 rounded-lg border border-[#3a3a37] text-[#C9B99A] hover:bg-[#3a3a37]"
                            >
                              Ver página
                            </a>
                          )}
                          <button
                            disabled={enviandoRemark === lead.id}
                            onClick={async () => {
                              setEnviandoRemark(lead.id)
                              try {
                                await fetch('/api/remarketing', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ telefono: lead.telefono, mensaje: msgPredeterminado }),
                                })
                                alert(`Mensaje enviado a ${lead.nombre}`)
                              } catch { alert('Error al enviar') }
                              setEnviandoRemark(null)
                            }}
                            className="text-xs bg-[#C9B99A] text-[#1A1A18] font-medium px-4 py-1.5 rounded-lg hover:bg-[#b5a688] disabled:opacity-50"
                          >
                            {enviandoRemark === lead.id ? 'Enviando...' : 'Enviar por WhatsApp'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ─── CATÁLOGO ─── */}
        {vista === 'catalogo' && (
          <div className="space-y-4">
            {!productoSeleccionado ? (
              <>
                <p className="text-[#666660] text-xs uppercase tracking-wider">Seleccioná un producto para ver o editar su despiece</p>
                <div className="space-y-2">
                  {catalogo.map(p => (
                    <div key={p.id}
                      onClick={() => seleccionarProductoCatalogo(p)}
                      className="bg-[#242421] border border-[#2E2E2B] hover:border-[#C9B99A]/40 rounded-xl p-4 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{p.nombre}</p>
                          <p className="text-[#666660] text-xs">{p.categoria} · {p.dias_produccion} días hábiles</p>
                        </div>
                        <div className="text-right">
                          {p.precio_base > 0
                            ? <p className="text-[#C9B99A] text-sm font-medium">{fmtPeso(p.precio_base)}</p>
                            : <p className="text-[#444441] text-xs">Sin precio</p>
                          }
                          <p className="text-[#444441] text-xs">→ ver despiece</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setProductoSeleccionado(null); setDespieces([]) }}
                    className="text-[#666660] hover:text-white text-sm transition-colors">←</button>
                  <div>
                    <p className="text-white font-medium">{productoSeleccionado.nombre}</p>
                    <p className="text-[#666660] text-xs">
                      {productoSeleccionado.precio_base > 0 ? fmtPeso(productoSeleccionado.precio_base) : 'Sin precio'}{' '}
                      {productoSeleccionado.precio_sena > 0 && `· Seña ${fmtPeso(productoSeleccionado.precio_sena)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[#666660] text-xs uppercase tracking-wider">Materiales / Despiece</p>
                  <button
                    onClick={() => {
                      setModalDespiece('nuevo')
                      setDespForm({ material: '', cantidad: '', unidad: 'm²', descripcion: '', es_checklist: true, orden: String(despieces.length + 1) })
                    }}
                    className="text-xs bg-[#C9B99A] text-[#1A1A18] font-medium px-4 py-2 rounded-lg hover:bg-[#b5a688]">
                    + Agregar material
                  </button>
                </div>

                {despieces.length > 0 ? (
                  <div className="space-y-2">
                    {despieces.map(d => (
                      <div key={d.id} className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-3 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium">{d.material}</p>
                            {d.es_checklist && (
                              <span className="text-[10px] bg-[#C9B99A]/15 text-[#C9B99A] px-1.5 py-0.5 rounded">checklist</span>
                            )}
                          </div>
                          <p className="text-[#666660] text-xs mt-0.5">
                            {d.cantidad} {d.unidad}{d.descripcion && ` · ${d.descripcion}`}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setModalDespiece(d)
                              setDespForm({ material: d.material, cantidad: String(d.cantidad), unidad: d.unidad, descripcion: d.descripcion ?? '', es_checklist: d.es_checklist, orden: String(d.orden) })
                            }}
                            className="text-xs text-[#666660] border border-[#3a3a37] px-2.5 py-1 rounded-lg hover:text-white">
                            Editar
                          </button>
                          <button onClick={() => eliminarDespiece(d.id)}
                            className="text-xs text-[#666660] border border-[#3a3a37] px-2.5 py-1 rounded-lg hover:text-red-400">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-[#242421] border border-dashed border-[#3a3a37] rounded-xl">
                    <p className="text-[#666660] text-sm mb-1">Sin materiales cargados</p>
                    <p className="text-[#444441] text-xs">Agregá los materiales necesarios para fabricar este producto</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── OPERARIOS ─── */}
        {vista === 'operarios' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[#666660] text-xs uppercase tracking-wider">Personal registrado</p>
              <button
                onClick={() => { setModalOperario('nuevo'); setOpForm({ nombre: '', area: 'ambos', telefono: '' }) }}
                className="text-xs bg-[#C9B99A] text-[#1A1A18] font-medium px-4 py-2 rounded-lg hover:bg-[#b5a688]">
                + Agregar operario
              </button>
            </div>

            {metricasOp.length > 0 && (
              <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
                <p className="text-[#666660] text-xs uppercase tracking-wider mb-3">Rendimiento — últimos 30 días</p>
                <div className="space-y-2">
                  {metricasOp.map(op => (
                    <div key={op.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white">{op.nombre}</span>
                          <span className="text-xs text-[#C9B99A] font-medium">{op.etapas} etapas</span>
                        </div>
                        <div className="bg-[#1A1A18] rounded-full h-1.5">
                          <div className="bg-[#C9B99A] rounded-full h-1.5" style={{ width: `${metricasOp[0]?.etapas ? (op.etapas / metricasOp[0].etapas) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {operarios.map(op => (
                <div key={op.id} className={`bg-[#242421] border rounded-xl p-4 flex items-center justify-between transition-opacity ${op.activo ? 'border-[#2E2E2B]' : 'border-[#2E2E2B] opacity-50'}`}>
                  <div>
                    <p className="text-white font-medium text-sm">{op.nombre}</p>
                    <p className="text-[#666660] text-xs capitalize mt-0.5">{op.area}{op.telefono && ` · ${op.telefono}`}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setModalOperario(op); setOpForm({ nombre: op.nombre, area: op.area, telefono: op.telefono ?? '' }) }}
                      className="text-xs bg-[#2E2E2B] text-[#666660] border border-[#3a3a37] px-3 py-1.5 rounded-lg hover:text-white">
                      Editar
                    </button>
                    <button onClick={() => toggleOperario(op)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${op.activo ? 'bg-[#2E2E2B] text-[#666660] border-[#3a3a37] hover:text-red-400' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}`}>
                      {op.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── CONTENIDO IA ─── */}
        {vista === 'contenido' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold mb-1">Generador de contenido</h2>
              <p className="text-[#666660] text-xs">Generá copy para Instagram, Facebook o WhatsApp con IA. Revisalo y ajustalo antes de publicar.</p>
            </div>

            <div className="space-y-4 bg-[#242421] border border-[#2E2E2B] rounded-xl p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#666660] text-xs mb-1.5 block">Producto</label>
                  <select
                    value={contForm.producto}
                    onChange={e => setContForm(p => ({ ...p, producto: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  >
                    <option value="">— elegí un producto —</option>
                    {catalogo.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                    <option value="Camabox en general">Camabox (en general)</option>
                    <option value="Zapatero Slim">Zapatero Slim</option>
                    <option value="Muebles a medida">Muebles a medida</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#666660] text-xs mb-1.5 block">Tipo de contenido</label>
                  <select
                    value={contForm.tipo}
                    onChange={e => setContForm(p => ({ ...p, tipo: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  >
                    <option value="post">Post de feed</option>
                    <option value="historia">Historia</option>
                    <option value="oferta">Oferta especial</option>
                    <option value="tip">Tip de decoración</option>
                    <option value="whatsapp">Mensaje WhatsApp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#666660] text-xs mb-1.5 block">Red social</label>
                <div className="flex gap-2">
                  {['Instagram', 'Facebook', 'WhatsApp'].map(r => (
                    <button
                      key={r}
                      onClick={() => setContForm(p => ({ ...p, red: r }))}
                      className={`px-4 py-1.5 rounded-lg text-xs transition-colors border ${contForm.red === r ? 'bg-[#C9B99A] text-[#1A1A18] border-[#C9B99A] font-medium' : 'border-[#3a3a37] text-[#666660] hover:text-white'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[#666660] text-xs mb-1.5 block">Info adicional <span className="text-[#444441]">(opcional)</span></label>
                <input
                  value={contForm.info_extra}
                  onChange={e => setContForm(p => ({ ...p, info_extra: e.target.value }))}
                  placeholder="Ej: hay descuento esta semana, el color disponible es Blanco Tundra..."
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                />
              </div>

              <button
                disabled={!contForm.producto || contGenerando}
                onClick={async () => {
                  setContGenerando(true)
                  setContTexto('')
                  setContCopiado(false)
                  try {
                    const res = await fetch('/api/contenido/generar', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(contForm),
                    })
                    const data = await res.json()
                    setContTexto(data.texto ?? 'Error generando contenido')
                  } catch { setContTexto('Error al conectar') }
                  setContGenerando(false)
                }}
                className="w-full py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm disabled:opacity-40 hover:bg-[#b5a688] transition-colors"
              >
                {contGenerando ? 'Generando con IA…' : 'Generar contenido'}
              </button>
            </div>

            {contTexto && (
              <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[#666660] text-xs uppercase tracking-wider">Resultado</p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setContGenerando(true)
                        setContCopiado(false)
                        try {
                          const res = await fetch('/api/contenido/generar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(contForm),
                          })
                          const data = await res.json()
                          setContTexto(data.texto ?? '')
                        } catch { /* */ }
                        setContGenerando(false)
                      }}
                      disabled={contGenerando}
                      className="text-xs text-[#666660] border border-[#3a3a37] px-3 py-1 rounded-lg hover:text-white disabled:opacity-40"
                    >
                      Regenerar
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(contTexto)
                        setContCopiado(true)
                        setTimeout(() => setContCopiado(false), 2000)
                      }}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors ${contCopiado ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'border-[#3a3a37] text-[#C9B99A] hover:bg-[#3a3a37]'}`}
                    >
                      {contCopiado ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={contTexto}
                  onChange={e => setContTexto(e.target.value)}
                  rows={10}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50 resize-none leading-relaxed"
                />
                <p className="text-[#444441] text-xs">Podés editar el texto antes de copiarlo. Siempre revisarlo antes de publicar.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── META ADS ─── */}
        {vista === 'ads' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold mb-1">Dashboard Meta Ads</h2>
              <p className="text-[#666660] text-xs">Métricas automáticas de tus campañas de Facebook e Instagram.</p>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-5 space-y-3">
              <p className="text-amber-300 text-sm font-medium">Conexión pendiente</p>
              <p className="text-[#888880] text-sm">Para activar el dashboard necesitamos acceso de lectura a tu Meta Business Manager. Esto permite ver CPL, ROAS y volumen de leads por campaña de forma automática.</p>
              <div className="space-y-2 pt-1">
                <p className="text-[#666660] text-xs font-medium uppercase tracking-wider">Pasos para conectar:</p>
                <ol className="space-y-1.5 text-sm text-[#888880]">
                  <li className="flex gap-2"><span className="text-amber-400 font-medium flex-shrink-0">1.</span> Dante entra a Meta Business Manager → Configuración → Usuarios</li>
                  <li className="flex gap-2"><span className="text-amber-400 font-medium flex-shrink-0">2.</span> Agrega al estratega con acceso de Analista (solo lectura)</li>
                  <li className="flex gap-2"><span className="text-amber-400 font-medium flex-shrink-0">3.</span> El estratega genera un token de acceso y lo carga en Vercel</li>
                  <li className="flex gap-2"><span className="text-amber-400 font-medium flex-shrink-0">4.</span> El dashboard se activa automáticamente</li>
                </ol>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'CPL promedio', value: '—', sub: 'Costo por lead' },
                { label: 'Leads esta semana', value: '—', sub: 'Desde campañas activas' },
                { label: 'Invertido este mes', value: '—', sub: 'Presupuesto ejecutado' },
                { label: 'ROAS estimado', value: '—', sub: 'Retorno sobre inversión' },
              ].map(m => (
                <div key={m.label} className="bg-[#2E2E2B] rounded-xl p-4 border border-[#3a3a37] opacity-50">
                  <p className="text-[#666660] text-xs uppercase tracking-wider mb-1">{m.label}</p>
                  <p style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-bold text-white">{m.value}</p>
                  <p className="text-[#666660] text-xs mt-1">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#242421] border border-[#2E2E2B] rounded-xl p-4">
              <p className="text-[#666660] text-xs uppercase tracking-wider mb-2">Mientras tanto</p>
              <p className="text-sm text-[#888880]">Podés revisar tus métricas manualmente en el panel de Meta Ads. Una vez conectado, este dashboard las mostrará acá de forma automática cada semana.</p>
              <a
                href="https://adsmanager.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-xs text-[#C9B99A] border border-[#C9B99A]/30 px-4 py-2 rounded-lg hover:bg-[#C9B99A]/10 transition-colors"
              >
                Ir al Ads Manager →
              </a>
            </div>
          </div>
        )}

        {/* ─── ALERTAS ─── */}
        {vista === 'alertas' && (
          <div className="space-y-2">
            {alertas.length === 0 && <p className="text-[#444441] text-sm text-center py-8">Sin alertas activas</p>}
            {alertas.map(a => {
              const s = BADGE_ALERTA[a.tipo] ?? BADGE_ALERTA.info
              return (
                <div key={a.id} className={`border rounded-xl p-4 ${s.card}`}>
                  <div className="flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
                    <div className="flex-1">
                      <p className={`text-sm ${s.text}`}>{a.mensaje}</p>
                      <p className="text-[#444441] text-xs mt-1">{fmt(a.created_at)}</p>
                    </div>
                    <button onClick={() => { setModalAlerta(a); setNotaAlerta('') }}
                      className="text-xs text-[#666660] hover:text-white border border-[#3a3a37] px-3 py-1 rounded-lg flex-shrink-0">
                      Ver / Resolver
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════ */}

      {/* Historial */}
      {modalHistorial && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#3a3a37] flex items-center justify-between">
              <p className="font-medium text-white">Historial de actividad</p>
              <button onClick={() => setModalHistorial(null)} className="text-[#666660] hover:text-white">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {historialData.map(h => (
                <div key={h.id} className="flex gap-3">
                  <div className="w-px bg-[#3a3a37] ml-1" />
                  <div className="pb-3">
                    <p className="text-sm text-white">{h.descripcion}</p>
                    <p className="text-[#444441] text-xs mt-0.5">{h.usuario} · {fmt(h.created_at)}</p>
                  </div>
                </div>
              ))}
              {historialData.length === 0 && <p className="text-[#444441] text-sm">Sin actividad registrada</p>}
            </div>
          </div>
        </div>
      )}

      {/* Reanudar */}
      {modalReanudar && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-1">Reanudar orden</p>
            <p className="text-[#666660] text-sm mb-4">{modalReanudar.cliente} — {modalReanudar.producto}</p>
            <textarea
              value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Motivo o resolución del problema…"
              className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-sm text-white placeholder-[#444441] resize-none focus:outline-none focus:border-[#C9B99A]/50 h-24"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModalReanudar(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={reanudar} disabled={!comentario.trim()} className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm disabled:opacity-40">Reanudar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar entrega */}
      {modalEntrega && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-1">Confirmar entrega</p>
            <p className="text-[#666660] text-sm mb-4">{modalEntrega.cliente} — {modalEntrega.producto}</p>
            <p className="text-sm text-white">¿Confirmás que el cliente ya retiró el pedido?</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalEntrega(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={confirmarEntrega} className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white font-medium text-sm hover:bg-emerald-600">Confirmar entrega</button>
            </div>
          </div>
        </div>
      )}

      {/* Avanzar A Medida */}
      {modalAvanzar && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-1">Avanzar estado</p>
            <p className="text-[#666660] text-sm mb-4">{modalAvanzar.cliente} — {modalAvanzar.producto}</p>
            {(() => {
              const idx = ESTADOS_MEDIDA.indexOf(modalAvanzar.estado as any)
              const siguiente = ESTADOS_MEDIDA[idx + 1]
              return (
                <>
                  <div className="flex items-center gap-3 bg-[#1A1A18] rounded-xl p-3 mb-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${ESTADO_COLOR_MEDIDA[modalAvanzar.estado] ?? ''}`}>{modalAvanzar.estado}</span>
                    <span className="text-[#666660]">→</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${siguiente ? (ESTADO_COLOR_MEDIDA[siguiente] ?? '') : ''}`}>{siguiente ?? '—'}</span>
                  </div>
                  {siguiente === 'Corte' && (
                    <div className="bg-teal-950/30 border border-teal-900/50 rounded-xl p-3 mb-4">
                      <p className="text-teal-300 text-xs">⚡ Al avanzar a Corte, el proyecto pasa a producción y se notifica al Taller A Medida.</p>
                    </div>
                  )}
                </>
              )
            })()}
            <div className="flex gap-3">
              <button onClick={() => setModalAvanzar(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={avanzarMedida} className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm">Avanzar</button>
            </div>
          </div>
        </div>
      )}

      {/* Aprobar presupuesto */}
      {modalPresupuesto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-1">Aprobar presupuesto</p>
            <p className="text-[#666660] text-sm mb-4">{modalPresupuesto.cliente} — {modalPresupuesto.tipo_mueble} ({modalPresupuesto.m2_calculado} m²)</p>
            <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
              <div className="bg-[#1A1A18] rounded-lg p-2">
                <p className="text-[#444441]">Materiales</p>
                <p className="text-white">{fmtPeso(modalPresupuesto.precio_materiales || 0)}</p>
              </div>
              <div className="bg-[#1A1A18] rounded-lg p-2">
                <p className="text-[#444441]">Mano obra</p>
                <p className="text-white">{fmtPeso(modalPresupuesto.precio_mano_obra || 0)}</p>
              </div>
              <div className="bg-[#1A1A18] rounded-lg p-2">
                <p className="text-[#444441]">Instalación</p>
                <p className="text-white">{fmtPeso(modalPresupuesto.precio_instalacion || 0)}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[#666660] text-xs mb-1 block">Precio final aprobado ($)</label>
              <input
                type="number" value={presForm.precio_final} onChange={e => setPresForm(p => ({ ...p, precio_final: e.target.value }))}
                className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
              />
            </div>
            <div className="mb-4">
              <label className="text-[#666660] text-xs mb-1 block">Notas internas</label>
              <textarea value={presForm.notas} onChange={e => setPresForm(p => ({ ...p, notas: e.target.value }))}
                className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50 resize-none h-20"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalPresupuesto(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={aprobarPresupuesto} className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm">Aprobar presupuesto</button>
            </div>
          </div>
        </div>
      )}

      {/* Ver / Resolver alerta */}
      {modalAlerta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-1">Detalle de alerta</p>
            <p className="text-[#444441] text-xs mb-4">{new Date(modalAlerta.created_at).toLocaleString('es-AR')}</p>
            <div className={`rounded-xl p-4 mb-4 ${BADGE_ALERTA[modalAlerta.tipo]?.card ?? BADGE_ALERTA.info.card}`}>
              <div className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${BADGE_ALERTA[modalAlerta.tipo]?.dot ?? BADGE_ALERTA.info.dot}`} />
                <p className={`text-sm ${BADGE_ALERTA[modalAlerta.tipo]?.text ?? BADGE_ALERTA.info.text}`}>{modalAlerta.mensaje}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[#666660] text-xs mb-1 block">¿Cómo se resolvió? <span className="text-[#444441]">(requerido)</span></label>
              <textarea
                value={notaAlerta} onChange={e => setNotaAlerta(e.target.value)}
                placeholder="Describí la solución aplicada…"
                className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-sm text-white placeholder-[#444441] resize-none focus:outline-none focus:border-[#C9B99A]/50 h-20"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAlerta(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={resolverAlerta} disabled={!notaAlerta.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm disabled:opacity-40">
                Marcar como resuelta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operario — crear/editar */}
      {modalOperario && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-4">{modalOperario === 'nuevo' ? 'Agregar operario' : 'Editar operario'}</p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Nombre</label>
                <input value={opForm.nombre} onChange={e => setOpForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  placeholder="Nombre y apellido" />
              </div>
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Área</label>
                <select value={opForm.area} onChange={e => setOpForm(p => ({ ...p, area: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50">
                  <option value="ambos">Taller (Standard + A Medida)</option>
                  <option value="standard">Solo Taller Standard</option>
                  <option value="medida">Solo Taller A Medida</option>
                  <option value="diseño">Diseño y Despiece</option>
                  <option value="instalacion">Instalación</option>
                </select>
              </div>
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Teléfono (WhatsApp)</label>
                <input value={opForm.telefono} onChange={e => setOpForm(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  placeholder="Ej: 2616001122" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalOperario(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={guardarOperario} disabled={!opForm.nombre.trim()} className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead — crear/editar */}
      {modalLead && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <p className="font-medium text-white mb-4">{modalLead === 'nuevo' ? 'Nuevo lead' : 'Editar lead'}</p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Nombre *</label>
                <input value={leadForm.nombre} onChange={e => setLeadForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  placeholder="Nombre del cliente" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Teléfono</label>
                  <input value={leadForm.telefono} onChange={e => setLeadForm(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                    placeholder="2616001122" />
                </div>
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Barrio / Zona</label>
                  <input value={leadForm.barrio} onChange={e => setLeadForm(p => ({ ...p, barrio: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                    placeholder="Villa Cabrera" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Color</label>
                  <select value={leadForm.color} onChange={e => setLeadForm(p => ({ ...p, color: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50">
                    <option value="">Sin definir</option>
                    {COLORES_DISPONIBLES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Cantidad</label>
                  <input type="number" min="1" value={leadForm.cantidad} onChange={e => setLeadForm(p => ({ ...p, cantidad: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50" />
                </div>
              </div>
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Método de pago</label>
                <input value={leadForm.metodo_pago} onChange={e => setLeadForm(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  placeholder="Efectivo / Go Cuotas / Transferencia" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Fuente</label>
                  <select value={leadForm.fuente} onChange={e => setLeadForm(p => ({ ...p, fuente: e.target.value as FuenteLead }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50">
                    <option value="manual">Manual</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="web">Web</option>
                    <option value="manychat">ManyChat</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Estado</label>
                  <select value={leadEstadoEdit} onChange={e => setLeadEstadoEdit(e.target.value as EstadoLead)}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50">
                    <option value="nuevo">Nuevo</option>
                    <option value="contactado">Contactado</option>
                    <option value="interesado">Interesado</option>
                    <option value="presupuestado">Presupuestado</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="perdido">Perdido</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Notas internas</label>
                <textarea value={leadForm.notas} onChange={e => setLeadForm(p => ({ ...p, notas: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50 resize-none h-16"
                  placeholder="Obs del cliente, condiciones, etc." />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalLead(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={guardarLead} disabled={!leadForm.nombre.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Despiece — crear/editar */}
      {modalDespiece && productoSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-1">{modalDespiece === 'nuevo' ? 'Agregar material' : 'Editar material'}</p>
            <p className="text-[#666660] text-xs mb-4">{productoSeleccionado.nombre}</p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Material *</label>
                <input value={despForm.material} onChange={e => setDespForm(p => ({ ...p, material: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  placeholder="Ej: MDF 18mm FAPLAC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Cantidad *</label>
                  <input type="number" value={despForm.cantidad} onChange={e => setDespForm(p => ({ ...p, cantidad: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                    placeholder="1" />
                </div>
                <div>
                  <label className="text-[#666660] text-xs mb-1 block">Unidad</label>
                  <select value={despForm.unidad} onChange={e => setDespForm(p => ({ ...p, unidad: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50">
                    <option value="m²">m²</option>
                    <option value="ml">ml</option>
                    <option value="unidad">unidad</option>
                    <option value="kg">kg</option>
                    <option value="par">par</option>
                    <option value="juego">juego</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Descripción / nota (opcional)</label>
                <input value={despForm.descripcion} onChange={e => setDespForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  placeholder="Ej: tablero principal, color a elección" />
              </div>
              <div>
                <label className="text-[#666660] text-xs mb-1 block">Orden de verificación</label>
                <input type="number" value={despForm.orden} onChange={e => setDespForm(p => ({ ...p, orden: e.target.value }))}
                  className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  placeholder="1" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setDespForm(p => ({ ...p, es_checklist: !p.es_checklist }))}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${despForm.es_checklist ? 'bg-[#C9B99A]' : 'bg-[#3a3a37]'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${despForm.es_checklist ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-white">Aparece en checklist del taller</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalDespiece(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={guardarDespiece} disabled={!despForm.material.trim() || !despForm.cantidad}
                className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Editar precio */}
      {modalPrecio && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="bg-[#242421] border border-[#3a3a37] rounded-2xl w-full max-w-md p-6">
            <p className="font-medium text-white mb-1">Precios — {modalPrecio.tipo_mueble}</p>
            <p className="text-[#666660] text-xs mb-4">Estos valores se usan automáticamente en el cotizador del relevamiento</p>
            <div className="space-y-3 mb-6">
              {[
                { key: 'precio_m2_materiales', label: 'Materiales por m² ($)' },
                { key: 'precio_m2_mano_obra', label: 'Mano de obra por m² ($)' },
                { key: 'precio_instalacion_base', label: 'Instalación — precio base ($)' },
                { key: 'precio_instalacion_m2', label: 'Instalación — adicional por m² ($)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[#666660] text-xs mb-1 block">{label}</label>
                  <input
                    type="number" value={(precioForm as any)[key]}
                    onChange={e => setPrecioForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-[#1A1A18] border border-[#3a3a37] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C9B99A]/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalPrecio(null)} className="flex-1 py-2.5 rounded-xl border border-[#3a3a37] text-[#666660] text-sm hover:text-white">Cancelar</button>
              <button onClick={guardarPrecio} className="flex-1 py-2.5 rounded-xl bg-[#C9B99A] text-[#1A1A18] font-medium text-sm">Guardar precios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
