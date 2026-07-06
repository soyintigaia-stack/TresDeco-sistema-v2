'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      window.location.href = '/administracion'
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-[#C9B99A] flex items-center justify-center text-[#1A1A18] font-bold text-lg mx-auto">TD</div>
          <p className="text-[#C9B99A] font-semibold tracking-wide text-sm">TresDeco — Sistema</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-[#2E2E2B] rounded-2xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-[#888] uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#1A1A18] text-white rounded-xl px-4 py-3 text-sm outline-none border border-[#3a3a37] focus:border-[#C9B99A] transition-colors"
              placeholder="tu@email.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[#888] uppercase tracking-wider">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#1A1A18] text-white rounded-xl px-4 py-3 text-sm outline-none border border-[#3a3a37] focus:border-[#C9B99A] transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C9B99A] text-[#1A1A18] font-semibold py-3 rounded-xl text-sm hover:bg-[#b8a88a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-xs text-[#444]">Acceso restringido · TresDeco Amoblamientos</p>
      </div>
    </div>
  )
}
