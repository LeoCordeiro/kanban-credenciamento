'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { LogIn, Loader2 } from 'lucide-react'

/**
 * Envolve o app: sem usuário na sessão, mostra a tela de login no lugar do board.
 * Evita o pisca-pisca de redirect e mantém o board como rota única.
 */
export function Guard({ children }: { children: React.ReactNode }) {
  const { usuario, carregando, entrar } = useAuth()
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (carregando) {
    return (
      <div className="h-screen flex items-center justify-center bg-board-bg text-white/70">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (usuario) return <>{children}</>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !senha) return
    setEnviando(true)
    setErro(null)
    const msg = await entrar(nome, senha)
    if (msg) setErro(msg)
    setEnviando(false)
  }

  return (
    <div className="h-screen flex items-center justify-center bg-board-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Kanban Credenciamento</h1>
          <p className="text-sm text-white/60 mt-1">Entre para acessar o board</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-text-muted uppercase mb-1.5 font-medium">Usuário</label>
            <input
              autoFocus
              autoComplete="username"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="seu usuário"
              className="w-full px-3 py-2.5 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted uppercase mb-1.5 font-medium">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
          )}

          <button
            type="submit"
            disabled={enviando || !nome.trim() || !senha}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-btn-primary text-white rounded-lg text-sm font-semibold hover:bg-btn-primary-hover transition-colors disabled:opacity-40"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
