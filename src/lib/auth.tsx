'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { Usuario } from '@/types/kanban'

const CHAVE = 'kanban-usuario'

interface AuthCtx {
  usuario: Usuario | null
  carregando: boolean
  entrar: (nome: string, senha: string) => Promise<string | null>
  sair: () => void
}

const Ctx = createContext<AuthCtx>({
  usuario: null,
  carregando: true,
  entrar: async () => 'Contexto de autenticação não inicializado',
  sair: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo) {
      try {
        setUsuario(JSON.parse(salvo))
      } catch {
        localStorage.removeItem(CHAVE)
      }
    }
    setCarregando(false)
  }, [])

  const entrar = useCallback(async (nome: string, senha: string) => {
    // A senha é conferida no banco (bcrypt via pgcrypto); o hash nunca sai de lá.
    const { data, error } = await supabase.rpc('login_usuario', { p_nome: nome, p_senha: senha })
    if (error) return 'Erro ao entrar: ' + error.message
    const achado = Array.isArray(data) ? data[0] : data
    if (!achado) return 'Usuário ou senha inválidos'

    const u: Usuario = { id: achado.id, nome: achado.nome }
    localStorage.setItem(CHAVE, JSON.stringify(u))
    setUsuario(u)
    return null
  }, [])

  const sair = useCallback(() => {
    localStorage.removeItem(CHAVE)
    setUsuario(null)
  }, [])

  return <Ctx.Provider value={{ usuario, carregando, entrar, sair }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
