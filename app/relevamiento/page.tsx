'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, type Operario, type PrecioMedida, TIPOS_MUEBLE, fmtPeso } from '@/lib/supabase'

function RelevamientoForm() {
  const router = useRouter()
  const params = useSearchParams()
  const otId = params.get('ot')

  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [operarios, setOperarios] = useState<Operario[]>([])
  const [precios, setPrecios] = useState<PrecioMedida[]>([])
  const [cotizando, setCotizando] = useState(false)

  const fotoRef1 = useRef<HTMLInputElement>(null)
  const fotoRef2 = useRef<HTMLInputElement>(null)
  const fotoRef3 = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    // Paso 1: Responsable + fecha
    realizado_por: '',
    operario_id: '',
    realizado_por_cliente: false,
    fecha: new Date().toISOString().split('T')[0],
    // Paso 2: Cliente
    cliente: '',
    telefono: '',
    direccion: '',
    // Paso 3: Mueble
    tipo_mueble: '',
    descripcion: '',
    // Paso 4: Medidas
    ancho_cm: '',
    alto_cm: '',
    profundidad_cm: '',
    ancho_abertura_cm: '',
    // Paso 5: Condiciones
    material_pared: 'Ladrillo',
    estado_pared: 'Bueno',
    piso_irregular: false,
    techo_irregular: false,
    notas_condiciones: '',
    // Paso 6: Configuración
    cantidad_cuerpos: '1',
    cantidad_puertas: '0',
    cantidad_cajones: '0',
    cantidad_estantes: '0',
    color_principal: 'Blanco',
    color_secundario: '',
    manijas: false,
    tipo_manija: '',
    iluminacion: false,
    // Paso 7: Instalación
    requiere_instalacion: true,
    dificultad_acceso: 'Normal',
    notas_instalacion: '',
    // Paso 8: Fotos
    foto_general: null as string | null,
    foto_medidas: null as string | null,
    foto_detalle: null as string | null,
    // Paso 9: Cotizador (calculado automáticamente)
    precio_materiales: 0,
    precio_mano_obra: 0,
    precio_instalacion: 0,
    precio_estimado: 0,
    notas_presupuesto: '',
  })

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    const cargar = async () => {
      const [{ data: ops }, { data: prec }] = await Promise.all([
        supabase.from('operarios').select('*').eq('activo', true).order('nombre'),
        supabase.from('precios_medida').select('*').eq('activo', true),
      ])
      if (ops) setOperarios(ops)
      if (prec) setPrecios(prec)
    }
    cargar()
  }, [])

  const calcularM2 = () => {
    const a = parseFloat(form.ancho_cm) || 0
    const h = parseFloat(form.alto_cm) || 0
    const p = parseFloat(form.profundidad_cm) || 0
    if (!a || !h) return 0
    const frente = (a * h) / 10000
    const lados = (p * h * 2) / 10000
    const estantes = parseInt(form.cantidad_estantes) * (a * p) / 10000
    return Math.round((frente + lados + estantes) * 100) / 100
  }

  const calcularCotizacion = () => {
    if (!form.tipo_mueble) return
    setCotizando(true)
    const precio = precios.find(p => p.tipo_mueble === form.tipo_mueble)
    const m2 = calcularM2()
    if (precio && m2 > 0) {
      const mat  = Math.round(precio.precio_m2_materiales * m2)
      const mo   = Math.round(precio.precio_m2_mano_obra * m2)
      const inst = form.requiere_instalacion
        ? Math.round(precio.precio_instalacion_base + precio.precio_instalacion_m2 * m2)
        : 0
      setForm(prev => ({
        ...prev,
        precio_materiales: mat,
        precio_mano_obra: mo,
        precio_instalacion: inst,
        precio_estimado: mat + mo + inst,
      }))
    }
    setCotizando(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, campo: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    set(campo, url)
  }

  const guardar = async () => {
    if (!form.cliente || !form.tipo_mueble) {
      showToast('Completá al menos el cliente y tipo de mueble.')
      return
    }
    setGuardando(true)

    const m2 = calcularM2()
    const nombreResponsable = form.realizado_por_cliente
      ? 'Cliente'
      : (operarios.find(o => o.id === form.operario_id)?.nombre ?? form.realizado_por ?? 'Equipo TresDeco')

    let otFinal = otId
    if (!otFinal) {
      const { data: conf } = await supabase.from('configuracion').select('valor').eq('clave', 'contador_proyectos').single()
      const num = parseInt(conf?.valor ?? '0') + 1
      const año = new Date().getFullYear()
      const codigo = `TR-${año}-${String(num).padStart(3, '0')}`

      const { data: nuevaOT } = await supabase.from('ordenes_trabajo').insert({
        id: crypto.randomUUID(),
        tipo: 'medida',
        cliente: form.cliente,
        telefono: form.telefono,
        producto: form.tipo_mueble,
        estado: 'Relevamiento',
        etapa_actual: 1,
        fecha_ingreso: form.fecha,
        fecha_entrega_comprometida: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        origen: 'Manual',
        precio: 0,
        codigo_proyecto: codigo,
        requiere_instalacion: form.requiere_instalacion,
        cantidad: 1,
      }).select().single()

      if (nuevaOT) {
        otFinal = nuevaOT.id
        await supabase.from('configuracion').upsert({ clave: 'contador_proyectos', valor: String(num), descripcion: 'Contador de proyectos a medida' }, { onConflict: 'clave' })
      }
    }

    if (!otFinal) { setGuardando(false); showToast('Error al crear el proyecto.'); return }

    const { error } = await supabase.from('relevamientos').insert({
      ot_id: otFinal,
      fecha: form.fecha,
      realizado_por: nombreResponsable,
      realizado_por_cliente: form.realizado_por_cliente,
      cliente: form.cliente,
      telefono: form.telefono,
      direccion: form.direccion,
      tipo_mueble: form.tipo_mueble,
      descripcion: form.descripcion,
      ancho_cm: parseFloat(form.ancho_cm) || null,
      alto_cm: parseFloat(form.alto_cm) || null,
      profundidad_cm: parseFloat(form.profundidad_cm) || null,
      ancho_abertura_cm: parseFloat(form.ancho_abertura_cm) || null,
      material_pared: form.material_pared,
      estado_pared: form.estado_pared,
      piso_irregular: form.piso_irregular,
      techo_irregular: form.techo_irregular,
      notas_condiciones: form.notas_condiciones,
      cantidad_cuerpos: parseInt(form.cantidad_cuerpos),
      cantidad_puertas: parseInt(form.cantidad_puertas),
      cantidad_cajones: parseInt(form.cantidad_cajones),
      cantidad_estantes: parseInt(form.cantidad_estantes),
      color_principal: form.color_principal,
      color_secundario: form.color_secundario,
      manijas: form.manijas,
      iluminacion: form.iluminacion,
      requiere_instalacion: form.requiere_instalacion,
      dificultad_acceso: form.dificultad_acceso,
      notas_instalacion: form.notas_instalacion,
      m2_calculado: m2,
      precio_m2: 0,
      precio_materiales: form.precio_materiales,
      precio_mano_obra: form.precio_mano_obra,
      precio_instalacion: form.precio_instalacion,
      precio_estimado: form.precio_estimado,
      aprobado_admin: false,
      presupuesto_enviado: false,
      notas_presupuesto: form.notas_presupuesto,
    })

    if (error) { setGuardando(false); showToast('Error al guardar. Verificá la conexión.'); console.error(error); return }

    // Registrar quién hizo el relevamiento
    if (form.operario_id) {
      await supabase.from('etapa_registro').insert({
        ot_id: otFinal,
        etapa: 'Relevamiento',
        operario_id: form.operario_id,
        operario_nombre: nombreResponsable,
        fecha: form.fecha,
      })
    }

    await supabase.from('actividad').insert({
      ot_id: otFinal,
      descripcion: `📋 Relevamiento completado por ${nombreResponsable} — ${m2} m²`,
      usuario: nombreResponsable,
    })

    await supabase.from('alertas').insert({
      tipo: 'info',
      mensaje: `📋 Relevamiento de ${form.cliente} (${form.tipo_mueble}) — ${m2} m². Pendiente de diseño y presupuesto.`,
      ot_id: otFinal,
    })

    setGuardando(false)
    showToast('Relevamiento guardado ✓')
    setTimeout(() => router.push('/administracion'), 1500)
  }

  const PASOS = ['Responsable', 'Cliente', 'Mueble', 'Medidas', 'Condiciones', 'Configuración', 'Instalación', 'Fotos', 'Cotización']
  const m2 = calcularM2()

  const Input = ({ label, campo, placeholder, type = 'text' }: { label: string; campo: string; placeholder?: string; type?: string }) => (
    <div>
      <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">{label}</label>
      <input type={type} value={(form as any)[campo]} onChange={e => set(campo, e.target.value)} placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 placeholder-zinc-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1A1A18] flex flex-col max-w-md mx-auto">
      <input ref={fotoRef1} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileChange(e, 'foto_general')} />
      <input ref={fotoRef2} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileChange(e, 'foto_medidas')} />
      <input ref={fotoRef3} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileChange(e, 'foto_detalle')} />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 text-white text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">{toast}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <button onClick={() => router.push('/')} style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold">
          tres<span className="text-[#C9B99A]">decó</span>
          <span className="text-zinc-600 text-xs font-normal ml-2">relevamiento</span>
        </button>
        <span className="text-xs text-zinc-500">{paso}/{PASOS.length}</span>
      </div>

      {/* Barra de progreso */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex gap-1">
          {PASOS.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < paso ? 'bg-[#C9B99A]' : i === paso - 1 ? 'bg-[#C9B99A]/50' : 'bg-zinc-800'}`} />
          ))}
        </div>
        <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-bold text-white mt-3">{PASOS[paso - 1]}</p>
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-4">

        {/* ── PASO 1: RESPONSABLE ── */}
        {paso === 1 && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-3">¿Quién realiza el relevamiento?</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => set('realizado_por_cliente', false)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${!form.realizado_por_cliente ? 'border-[#C9B99A]/50 bg-[#C9B99A]/5' : 'border-zinc-700 bg-zinc-800/50'}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${!form.realizado_por_cliente ? 'border-[#C9B99A]' : 'border-zinc-600'}`}>
                    {!form.realizado_por_cliente && <div className="w-2 h-2 rounded-full bg-[#C9B99A]" />}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Equipo TresDeco</p>
                    <p className="text-[11px] text-zinc-500">Profesional en domicilio del cliente</p>
                  </div>
                </button>
                <button
                  onClick={() => { set('realizado_por_cliente', true); set('operario_id', ''); set('realizado_por', 'Cliente') }}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${form.realizado_por_cliente ? 'border-amber-500/50 bg-amber-950/10' : 'border-zinc-700 bg-zinc-800/50'}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.realizado_por_cliente ? 'border-amber-400' : 'border-zinc-600'}`}>
                    {form.realizado_por_cliente && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Realizado por el cliente</p>
                    <p className="text-[11px] text-amber-500">⚠️ TresDeco no se responsabiliza por medidas incorrectas</p>
                  </div>
                </button>
              </div>
            </div>

            {!form.realizado_por_cliente && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-3">Seleccionar operario</p>
                {operarios.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {operarios.filter(o => ['ambos', 'medida', 'diseño'].includes(o.area)).map(op => (
                      <button key={op.id} onClick={() => { set('operario_id', op.id); set('realizado_por', op.nombre) }}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${form.operario_id === op.id ? 'border-[#C9B99A]/50 bg-[#C9B99A]/5' : 'border-zinc-700 bg-zinc-800/50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.operario_id === op.id ? 'border-[#C9B99A]' : 'border-zinc-600'}`}>
                          {form.operario_id === op.id && <div className="w-2 h-2 rounded-full bg-[#C9B99A]" />}
                        </div>
                        <div>
                          <p className="text-sm text-white">{op.nombre}</p>
                          <p className="text-[10px] text-zinc-500 capitalize">{op.area}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-zinc-500 text-xs mb-2">No hay operarios cargados. Ingresá el nombre:</p>
                    <input value={form.realizado_por} onChange={e => set('realizado_por', e.target.value)}
                      placeholder="Nombre del relevador"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none" />
                  </div>
                )}
              </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-2">Fecha del relevamiento</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none" />
            </div>
          </>
        )}

        {/* ── PASO 2: CLIENTE ── */}
        {paso === 2 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <Input label="Nombre del cliente" campo="cliente" placeholder="Ej: García, Lucía" />
            <Input label="Teléfono" campo="telefono" placeholder="351-555-0000" type="tel" />
            <Input label="Dirección del domicilio" campo="direccion" placeholder="Calle y número, barrio" />
          </div>
        )}

        {/* ── PASO 3: MUEBLE ── */}
        {paso === 3 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">Tipo de mueble</label>
              <select value={form.tipo_mueble} onChange={e => set('tipo_mueble', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                <option value="">Seleccionar...</option>
                {TIPOS_MUEBLE.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">Descripción / notas</label>
              <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                placeholder="Detalles del proyecto, requerimientos especiales..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none resize-none h-24 placeholder-zinc-600" />
            </div>
          </div>
        )}

        {/* ── PASO 4: MEDIDAS ── */}
        {paso === 4 && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Medidas del espacio (en cm)</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: 'Ancho total', k: 'ancho_cm', p: '240' },
                  { l: 'Alto total', k: 'alto_cm', p: '240' },
                  { l: 'Profundidad', k: 'profundidad_cm', p: '60' },
                  { l: 'Ancho abertura', k: 'ancho_abertura_cm', p: '0' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-[10px] text-zinc-600 block mb-1">{f.l}</label>
                    <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                      <input type="number" value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.p}
                        className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none" />
                      <span className="text-[10px] text-zinc-600 pr-3">cm</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {m2 > 0 && (
              <div className="bg-[#C9B99A]/10 border border-[#C9B99A]/30 rounded-xl p-4">
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-1">M² estimados</p>
                <p style={{ fontFamily: 'var(--font-display)' }} className="text-3xl font-bold text-[#C9B99A]">{m2} m²</p>
                <p className="text-[10px] text-zinc-500 mt-1">Incluye frente, laterales y estantes</p>
              </div>
            )}
          </>
        )}

        {/* ── PASO 5: CONDICIONES ── */}
        {paso === 5 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">Material de la pared</label>
              <select value={form.material_pared} onChange={e => set('material_pared', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                {['Ladrillo', 'Durlock', 'Hormigón', 'Madera', 'Cerámica', 'Otro'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">Estado de la pared</label>
              <select value={form.estado_pared} onChange={e => set('estado_pared', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                {['Bueno', 'Regular', 'Malo', 'Necesita reparación'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              {[{ l: 'Piso irregular', k: 'piso_irregular' }, { l: 'Techo irregular', k: 'techo_irregular' }].map(c => (
                <button key={c.k} onClick={() => set(c.k, !(form as any)[c.k])}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${(form as any)[c.k] ? 'bg-amber-950 border-amber-800 text-amber-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                  {c.l}
                </button>
              ))}
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">Notas de condiciones</label>
              <textarea value={form.notas_condiciones} onChange={e => set('notas_condiciones', e.target.value)}
                placeholder="Observaciones importantes del espacio..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none resize-none h-20 placeholder-zinc-600" />
            </div>
          </div>
        )}

        {/* ── PASO 6: CONFIGURACIÓN ── */}
        {paso === 6 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Cuerpos', k: 'cantidad_cuerpos' },
                { l: 'Puertas', k: 'cantidad_puertas' },
                { l: 'Cajones', k: 'cantidad_cajones' },
                { l: 'Estantes', k: 'cantidad_estantes' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-[10px] text-zinc-600 block mb-1">{f.l}</label>
                  <input type="number" min="0" value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none text-center" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[{ l: 'Color principal', k: 'color_principal' }, { l: 'Color secundario', k: 'color_secundario' }].map(f => (
                <div key={f.k}>
                  <label className="text-[10px] text-zinc-600 block mb-1">{f.l}</label>
                  <input value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} placeholder="Blanco, Arena..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none placeholder-zinc-600" />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              {[{ l: 'Con manijas', k: 'manijas' }, { l: 'Con iluminación', k: 'iluminacion' }].map(c => (
                <button key={c.k} onClick={() => set(c.k, !(form as any)[c.k])}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${(form as any)[c.k] ? 'bg-[#C9B99A]/10 border-[#C9B99A]/40 text-[#C9B99A]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                  {c.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PASO 7: INSTALACIÓN ── */}
        {paso === 7 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-2">¿Requiere instalación?</label>
              <div className="flex gap-2">
                {[{ l: 'Sí, con instalación', v: true }, { l: 'No, retira el cliente', v: false }].map(o => (
                  <button key={String(o.v)} onClick={() => set('requiere_instalacion', o.v)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${form.requiere_instalacion === o.v ? 'bg-[#C9B99A]/10 border-[#C9B99A]/40 text-[#C9B99A]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            {form.requiere_instalacion && (
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">Dificultad de acceso</label>
                <select value={form.dificultad_acceso} onChange={e => set('dificultad_acceso', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                  {['Normal', 'Escaleras', 'Ascensor', 'Sin acceso vehicular', 'Difícil acceso'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-1.5">Notas de instalación</label>
              <textarea value={form.notas_instalacion} onChange={e => set('notas_instalacion', e.target.value)}
                placeholder="Horarios disponibles, acceso, etc..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none resize-none h-20 placeholder-zinc-600" />
            </div>
          </div>
        )}

        {/* ── PASO 8: FOTOS ── */}
        {paso === 8 && (
          <div className="flex flex-col gap-3">
            {[
              { l: 'Foto general del espacio', k: 'foto_general', ref: fotoRef1, desc: 'Vista completa donde va el mueble' },
              { l: 'Foto de medidas', k: 'foto_medidas', ref: fotoRef2, desc: 'Con cinta métrica visible' },
              { l: 'Foto de detalle', k: 'foto_detalle', ref: fotoRef3, desc: 'Detalles importantes (zócalo, luz, etc.)' },
            ].map(f => (
              <div key={f.k} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {(form as any)[f.k] ? (
                  <div>
                    <img src={(form as any)[f.k]} alt={f.l} className="w-full object-cover max-h-40" />
                    <div className="p-3 flex items-center justify-between">
                      <p className="text-[11px] text-zinc-500">{f.l}</p>
                      <button onClick={() => set(f.k, null)} className="text-[10px] text-red-400">Sacar otra</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => f.ref.current?.click()} className="w-full p-4 flex items-center gap-3 text-left">
                    <span className="text-2xl">📷</span>
                    <div>
                      <p className="text-sm text-white font-medium">{f.l}</p>
                      <p className="text-[11px] text-zinc-500">{f.desc}</p>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── PASO 9: COTIZACIÓN ── */}
        {paso === 9 && (
          <div className="flex flex-col gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Estimación de precio</p>
                <button onClick={calcularCotizacion} disabled={cotizando}
                  className="text-xs bg-[#C9B99A]/10 border border-[#C9B99A]/30 text-[#C9B99A] px-3 py-1.5 rounded-lg disabled:opacity-40">
                  {cotizando ? 'Calculando...' : '⟳ Calcular'}
                </button>
              </div>
              {precios.find(p => p.tipo_mueble === form.tipo_mueble) ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400">Tipo de mueble</span>
                    <span className="text-white font-medium">{form.tipo_mueble}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400">M² calculados</span>
                    <span className="text-white font-medium">{m2} m²</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Materiales</span>
                    <span className="text-white">{fmtPeso(form.precio_materiales)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Mano de obra</span>
                    <span className="text-white">{fmtPeso(form.precio_mano_obra)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Instalación</span>
                    <span className="text-white">{fmtPeso(form.precio_instalacion)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-zinc-700 pt-2 mt-2">
                    <span className="text-zinc-300 font-medium">Total estimado</span>
                    <span style={{ fontFamily: 'var(--font-display)' }} className="text-[#C9B99A] font-bold text-lg">{fmtPeso(form.precio_estimado)}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-2">El precio final lo aprueba Administración antes de enviarlo al cliente.</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-zinc-500 text-sm mb-1">Sin precios configurados para {form.tipo_mueble || 'este tipo de mueble'}</p>
                  <p className="text-zinc-600 text-xs">Podés cargar los precios desde Administración → Cotizador</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <label className="text-[11px] text-zinc-500 uppercase tracking-widest block mb-2">Notas para el presupuesto</label>
              <textarea value={form.notas_presupuesto} onChange={e => set('notas_presupuesto', e.target.value)}
                placeholder="Ej: incluye herrajes importados, acabado especial, etc..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none resize-none h-24 placeholder-zinc-600" />
            </div>

            {/* Resumen completo */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-3">Resumen del relevamiento</p>
              <div className="space-y-1.5">
                {[
                  ['Responsable', form.realizado_por_cliente ? 'Cliente' : (form.realizado_por || '—')],
                  ['Cliente', form.cliente || '—'],
                  ['Mueble', form.tipo_mueble || '—'],
                  ['Medidas', form.ancho_cm ? `${form.ancho_cm}×${form.alto_cm}×${form.profundidad_cm} cm` : '—'],
                  ['M²', `${m2} m²`],
                  ['Instalación', form.requiere_instalacion ? 'Sí' : 'No'],
                  ['Precio estimado', form.precio_estimado > 0 ? fmtPeso(form.precio_estimado) : 'Sin calcular'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-zinc-500">{k}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navegación */}
      <div className="px-5 py-4 border-t border-zinc-800 flex gap-3">
        {paso > 1 && (
          <button onClick={() => setPaso(p => p - 1)}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-400 py-3 rounded-xl text-sm font-medium">
            ← Anterior
          </button>
        )}
        {paso < PASOS.length ? (
          <button
            onClick={() => {
              if (paso === PASOS.length - 1) calcularCotizacion()
              setPaso(p => p + 1)
            }}
            className="flex-1 bg-[#C9B99A]/10 border border-[#C9B99A]/40 text-[#C9B99A] py-3 rounded-xl text-sm font-bold">
            Siguiente →
          </button>
        ) : (
          <button onClick={guardar} disabled={guardando}
            className="flex-1 bg-emerald-950 border border-emerald-800 text-emerald-300 py-3 rounded-xl text-sm font-bold disabled:opacity-40">
            {guardando ? 'Guardando...' : '✅ Guardar relevamiento'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function RelevamientoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A18]">
        <p className="text-zinc-600 animate-pulse">Cargando...</p>
      </div>
    }>
      <RelevamientoForm />
    </Suspense>
  )
}
