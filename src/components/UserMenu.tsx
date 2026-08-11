'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Usuario } from '@/types/kanban'
import { LogOut, Users, KeyRound, X, Plus, UserCheck, UserX, Loader2, ListChecks } from 'lucide-react'

export function UserMenu() {
  const { usuario, sair } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [modal, setModal] = useState<'usuarios' | 'senha' | null>(null)

  if (!usuario) return null

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setAberto(v => !v)}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors font-medium"
        >
          <span className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold uppercase">
            {usuario.nome.slice(0, 2)}
          </span>
          <span className="capitalize">{usuario.nome}</span>
        </button>

        {aberto && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-lg shadow-xl border border-border py-1">
              <button
                onClick={() => { setModal('senha'); setAberto(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-[#f4f5f7] transition-colors"
              >
                <KeyRound className="w-4 h-4 text-text-muted" /> Alterar minha senha
              </button>
              <button
                onClick={() => { setModal('usuarios'); setAberto(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-[#f4f5f7] transition-colors"
              >
                <Users className="w-4 h-4 text-text-muted" /> Gerenciar usuários
              </button>
              <Link
                href="/checklist"
                onClick={() => setAberto(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-[#f4f5f7] transition-colors"
              >
                <ListChecks className="w-4 h-4 text-text-muted" /> Checklist padrão
              </Link>
              <div className="h-px bg-border my-1" />
              <button
                onClick={sair}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </div>
          </>
        )}
      </div>

      {modal === 'usuarios' && <UsuariosModal onClose={() => setModal(null)} />}
      {modal === 'senha' && <SenhaModal usuarioId={usuario.id} onClose={() => setModal(null)} />}
    </>
  )
}

function UsuariosModal({ onClose }: { onClose: () => void }) {
  const [lista, setLista] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoNome, setNovoNome] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('listar_usuarios')
    if (error) setErro(error.message)
    else setLista(data || [])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.rpc('criar_usuario', { p_nome: novoNome, p_senha: novaSenha })
    if (error) { setErro(error.message); return }
    setNovoNome('')
    setNovaSenha('')
    carregar()
  }

  async function alternarAtivo(u: Usuario) {
    await supabase.rpc('definir_usuario_ativo', { p_id: u.id, p_ativo: !u.ativo })
    carregar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Usuários</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {carregando && <Loader2 className="w-5 h-5 animate-spin text-text-muted mx-auto my-4" />}
          {lista.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <span className="w-8 h-8 rounded-full bg-[#f4f5f7] flex items-center justify-center text-xs font-bold uppercase text-text-secondary shrink-0">
                {u.nome.slice(0, 2)}
              </span>
              <span className={`flex-1 text-sm font-medium capitalize ${u.ativo ? 'text-text-primary' : 'text-text-muted line-through'}`}>
                {u.nome}
              </span>
              <button
                onClick={() => alternarAtivo(u)}
                title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                className={`p-1.5 rounded transition-colors ${u.ativo ? 'text-text-muted hover:text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
              >
                {u.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={criar} className="p-4 border-t border-border space-y-3">
          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
          <div className="flex gap-2">
            <input
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              placeholder="novo usuário"
              className="flex-1 px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
            />
            <input
              type="password"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="senha"
              className="w-32 px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
            />
            <button
              type="submit"
              disabled={!novoNome.trim() || novaSenha.length < 6}
              className="p-2 bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors disabled:opacity-30"
              title="Criar usuário"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-text-muted">A senha precisa ter ao menos 6 caracteres.</p>
        </form>
      </div>
    </div>
  )
}

function SenhaModal({ usuarioId, onClose }: { usuarioId: string; onClose: () => void }) {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha !== confirma) { setErro('As senhas não conferem'); return }
    const { error } = await supabase.rpc('alterar_senha', { p_id: usuarioId, p_senha: senha })
    if (error) { setErro(error.message); return }
    setOk(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Alterar senha</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={salvar} className="p-5 space-y-3">
          <input
            autoFocus
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="nova senha"
            className="w-full px-3 py-2.5 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
          />
          <input
            type="password"
            value={confirma}
            onChange={e => setConfirma(e.target.value)}
            placeholder="confirmar senha"
            className="w-full px-3 py-2.5 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
          />
          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
          {ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Senha alterada.</p>}
          <button
            type="submit"
            disabled={senha.length < 6 || ok}
            className="w-full py-2.5 bg-btn-primary text-white rounded-lg text-sm font-semibold hover:bg-btn-primary-hover transition-colors disabled:opacity-40"
          >
            Salvar
          </button>
        </form>
      </div>
    </div>
  )
}
