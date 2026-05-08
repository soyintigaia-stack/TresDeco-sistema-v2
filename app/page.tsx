'use client'
import { useRouter } from 'next/navigation'

const ROLES = [
  {
    href: '/administracion',
    area: 'Gestión',
    titulo: 'Administración',
    desc: 'Métricas, presupuestos, operarios y control del negocio',
    icon: '◈',
    color: '',
  },
  {
    href: '/nueva-ot',
    area: 'Venta',
    titulo: 'Nueva Orden',
    desc: 'Ingresá un pedido standard — el sistema calcula la fecha y lo manda al taller',
    icon: '＋',
    color: 'border-[#C9B99A]/30 hover:border-[#C9B99A]/70',
    highlight: true,
  },
  {
    href: '/taller-standard',
    area: 'Producción',
    titulo: 'Taller Standard',
    desc: 'Órdenes estándar: etapas, checklist de materiales y avance',
    icon: '◧',
    color: '',
  },
  {
    href: '/taller-medida',
    area: 'Producción',
    titulo: 'Taller A Medida',
    desc: 'Proyectos a medida: pipeline completo desde corte a entrega',
    icon: '◩',
    color: '',
  },
  {
    href: '/relevamiento',
    area: 'Diseño',
    titulo: 'Relevamiento',
    desc: 'Formulario de medición y cotización para muebles a medida',
    icon: '◱',
    color: '',
  },
]

const PROXIMOS = [
  {
    href: '#',
    area: 'Comercial',
    titulo: 'Tienda Virtual',
    desc: 'Próximamente — enlace con tu tienda online para recibir pedidos automáticamente',
    icon: '○',
    disabled: true,
  },
  {
    href: '#',
    area: 'Comercial',
    titulo: 'Ventas & CRM',
    desc: 'Próximamente — seguimiento de clientes, historial de compras y métricas de venta',
    icon: '○',
    disabled: true,
  },
]

export default function Home() {
  const router = useRouter()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-[#1A1A18]">
      <div className="mb-10 text-center">
        <p className="text-[#666660] text-xs tracking-[0.2em] uppercase mb-3">Sistema operativo</p>
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-5xl font-bold tracking-tight">
          tres<span className="text-[#C9B99A]">decó</span>
        </h1>
        <div className="w-8 h-px bg-[#C9B99A] mx-auto mt-4 opacity-50" />
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {ROLES.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`group bg-[#242421] border transition-all duration-200 rounded-2xl p-5 text-left ${
              item.highlight
                ? 'border-[#C9B99A]/30 hover:border-[#C9B99A]/70 hover:bg-[#C9B99A]/5'
                : 'border-[#2E2E2B] hover:border-[#C9B99A]/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-lg transition-colors ${item.highlight ? 'text-[#C9B99A]/70 group-hover:text-[#C9B99A]' : 'text-[#C9B99A]/40 group-hover:text-[#C9B99A]/80'}`}>{item.icon}</span>
                <span className="text-xs text-[#666660] tracking-widest uppercase">{item.area}</span>
              </div>
              <span className="text-[#C9B99A] opacity-0 group-hover:opacity-100 transition-opacity text-sm">→</span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)' }} className={`text-lg font-bold ${item.highlight ? 'text-[#C9B99A]' : 'text-white'}`}>{item.titulo}</p>
            <p className="text-[#666660] text-xs mt-1 leading-relaxed">{item.desc}</p>
          </button>
        ))}

        <div className="mt-4 pt-4 border-t border-[#2E2E2B] space-y-2">
          <p className="text-[#444441] text-xs uppercase tracking-wider px-1">Próximamente</p>
          {PROXIMOS.map(item => (
            <div key={item.titulo}
              className="bg-[#1E1E1C] border border-[#2E2E2B] rounded-2xl p-5 opacity-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#444441] text-lg">{item.icon}</span>
                <span className="text-xs text-[#444441] tracking-widest uppercase">{item.area}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)' }} className="text-base font-bold text-[#666660]">{item.titulo}</p>
              <p className="text-[#444441] text-xs mt-1 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[#444441] text-xs mt-8">v2.1 · TresDeco Sistema</p>
    </div>
  )
}
