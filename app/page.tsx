'use client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#1A1A18]">
      <div className="mb-12 text-center fade-up">
        <p className="text-[#666660] text-xs tracking-[0.2em] uppercase mb-3">Sistema operativo</p>
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-5xl font-bold tracking-tight text-white">
          tres<span className="text-[#C9B99A]">decó</span>
        </h1>
        <div className="w-8 h-px bg-[#C9B99A] mx-auto mt-4 opacity-50" />
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm fade-up">
        <button
          onClick={() => router.push('/dashboard')}
          className="group bg-[#242421] border border-[#2E2E2B] hover:border-[#C9B99A]/50 transition-all duration-200 rounded-2xl p-6 text-left">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#666660] tracking-widest uppercase">Administración</span>
            <span className="text-[#C9B99A] opacity-0 group-hover:opacity-100 transition-opacity text-lg">→</span>
          </div>
          <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold text-white">Dashboard Dante</p>
          <p className="text-[#666660] text-sm mt-1">Métricas, producción y alertas del negocio</p>
        </button>

        <button
          onClick={() => router.push('/taller')}
          className="group bg-[#242421] border border-[#2E2E2B] hover:border-[#C9B99A]/50 transition-all duration-200 rounded-2xl p-6 text-left">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#666660] tracking-widest uppercase">Producción</span>
            <span className="text-[#C9B99A] opacity-0 group-hover:opacity-100 transition-opacity text-lg">→</span>
          </div>
          <p style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-bold text-white">Vista Taller</p>
          <p className="text-[#666660] text-sm mt-1">Órdenes, etapas y comunicación con clientes</p>
        </button>
      </div>

      <p className="text-[#444441] text-xs mt-12 tracking-wide fade-up">v1.0 · Fase 1 — Productos estándar</p>
    </div>
  )
}
