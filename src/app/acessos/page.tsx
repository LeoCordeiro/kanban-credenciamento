'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Acesso } from '@/types/kanban'
import { Painel, CopyBtn, INPUT, CAMPO_LABEL } from '@/components/ui/Painel'
import { Modal } from '@/components/ui/Modal'
import { KeyRound, Plus, Pencil, Trash2, ExternalLink, Eye, EyeOff, Search, X } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FORM_VAZIO = { titulo: '', categoria: '', url: '', usuario: '', senha: '', notas: '' }

export default function AcessosPage() {
  const [acessos, setAcessos] = useState<Acesso[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [senhasVisiveis, setSenhasVisiveis] = useState<Set<string>>(new Set())
  const [editando, setEditando] = useState<Acesso | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  useEffect(() => {
    supabase.from('acessos').select('*').order('categoria').order('titulo').then(({ data }) => { if (data) setAcessos(data) })

    const ch = supabase.channel('acessos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acessos' }, async () => {
        const { data } = await supabase.from('acessos').select('*').order('categoria').order('titulo')
        if (data) setAcessos(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const categorias = [...new Set(acessos.map(a => a.categoria).filter(Boolean))] as string[]

  const visiveis = acessos.filter(a =>
    (!categoria || a.categoria === categoria) &&
    (!busca ||
      a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (a.usuario ?? '').toLowerCase().includes(busca.toLowerCase()) ||
      (a.url ?? '').toLowerCase().includes(busca.toLowerCase()))
  )

  function abrirForm(acesso?: Acesso) {
    if (acesso) {
      setEditando(acesso)
      setForm({
        titulo: acesso.titulo,
        categoria: acesso.categoria ?? '',
        url: acesso.url ?? '',
        usuario: acesso.usuario ?? '',
        senha: acesso.senha ?? '',
        notas: acesso.notas ?? '',
      })
    } else {
      setEditando(null)
      setForm({ ...FORM_VAZIO, categoria: categoria ?? '' })
    }
    setShowForm(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      titulo: form.titulo.trim(),
      categoria: form.categoria.trim() || null,
      url: form.url.trim() || null,
      usuario: form.usuario.trim() || null,
      senha: form.senha || null,
      notas: form.notas.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (editando) await supabase.from('acessos').update(payload).eq('id', editando.id)
    else await supabase.from('acessos').insert(payload)
    setShowForm(false)
    setEditando(null)
  }

  async function remover(a: Acesso) {
    if (!confirm(`Excluir o acesso "${a.titulo}"?`)) return
    setAcessos(prev => prev.filter(x => x.id !== a.id))
    await supabase.from('acessos').delete().eq('id', a.id)
  }

  function toggleSenha(id: string) {
    setSenhasVisiveis(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-sunken">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-btn-primary" /> Acessos
          </h1>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-8 py-1.5 bg-white border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary w-56"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => abrirForm()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-btn-primary text-white rounded-lg text-sm font-semibold hover:bg-btn-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>

        <p className="text-xs text-text-muted">
          Acessos da nossa empresa (Google Cloud, plataformas, ferramentas). Não confundir com as credenciais por empresa credenciada, que ficam na ficha de cada uma.
        </p>

        {categorias.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCategoria(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!categoria ? 'bg-btn-primary text-white' : 'bg-white text-text-secondary border border-border hover:text-text-primary'}`}
            >
              Todos
            </button>
            {categorias.map(c => (
              <button
                key={c}
                onClick={() => setCategoria(categoria === c ? null : c)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${categoria === c ? 'bg-btn-primary text-white' : 'bg-white text-text-secondary border border-border hover:text-text-primary'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <Painel>
          {visiveis.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-6 text-center">
              {acessos.length === 0 ? 'Nenhum acesso salvo. Crie o primeiro.' : 'Nada encontrado.'}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {visiveis.map(a => (
                <div key={a.id} className="group px-4 py-2.5 hover:bg-card-hover transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">{a.titulo}</span>
                    {a.categoria && <span className="shrink-0 px-1.5 py-0.5 rounded bg-surface-sunken text-[11px] font-medium text-text-secondary">{a.categoria}</span>}
                    {a.url && (
                      <a
                        href={a.url.startsWith('http') ? a.url : `https://${a.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={a.url}
                        className="text-btn-primary hover:text-btn-primary-hover shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => abrirForm(a)} className="p-0.5 text-text-secondary hover:text-text-primary transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remover(a)} className="p-0.5 text-text-secondary hover:text-red-500 transition-colors" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-0.5 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-xs">
                    {a.usuario && (
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <span className="text-xs text-text-secondary">usuário</span>
                        <span className="font-mono text-text-primary truncate min-w-0">{a.usuario}</span>
                        <CopyBtn value={a.usuario} titulo="Copiar usuário" />
                      </span>
                    )}
                    {a.senha && (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-xs text-text-secondary">senha</span>
                        <span className="font-mono text-text-primary">{senhasVisiveis.has(a.id) ? a.senha : '••••••••'}</span>
                        <button onClick={() => toggleSenha(a.id)} className="p-0.5 text-text-secondary hover:text-btn-primary transition-colors" title={senhasVisiveis.has(a.id) ? 'Ocultar' : 'Mostrar'}>
                          {senhasVisiveis.has(a.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <CopyBtn value={a.senha} titulo="Copiar senha" />
                      </span>
                    )}
                  </div>

                  {a.notas && <p className="mt-0.5 text-xs text-text-secondary leading-tight">{a.notas}</p>}
                </div>
              ))}
            </div>
          )}
        </Painel>
      </div>

      {showForm && (
        <Modal titulo={editando ? 'Editar acesso' : 'Novo acesso'} onClose={() => { setShowForm(false); setEditando(null) }} maxWidth="max-w-lg">
          <form onSubmit={salvar} className="p-5 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={CAMPO_LABEL}>Título *</label>
                <input required autoFocus value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Google Cloud" className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Categoria</label>
                <input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Cloud" list="categorias-acessos" className={INPUT} />
                <datalist id="categorias-acessos">
                  {categorias.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="col-span-2">
                <label className={CAMPO_LABEL}>URL</label>
                <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://console.cloud.google.com" className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Usuário / E-mail</label>
                <input value={form.usuario} onChange={e => setForm(p => ({ ...p, usuario: e.target.value }))} placeholder="usuario@email.com" className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Senha</label>
                <input value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} placeholder="••••••••" className={`${INPUT} font-mono`} />
              </div>
              <div className="col-span-2">
                <label className={CAMPO_LABEL}>Notas</label>
                <input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observações..." className={INPUT} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setEditando(null) }} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
              <button type="submit" className="px-4 py-1.5 bg-btn-primary text-white rounded-lg text-sm font-semibold hover:bg-btn-primary-hover transition-colors">
                {editando ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
