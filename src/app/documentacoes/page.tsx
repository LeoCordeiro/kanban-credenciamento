'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Documento } from '@/types/kanban'
import { Painel, INPUT, CAMPO_LABEL, BOTAO_DISCRETO } from '@/components/ui/Painel'
import { Modal } from '@/components/ui/Modal'
import { BookOpen, Plus, Pencil, Trash2, ExternalLink, Search, X, Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function DocumentacoesPage() {
  const [docs, setDocs] = useState<Documento[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [editando, setEditando] = useState<Documento | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titulo: '', categoria: '', conteudo: '', url: '' })
  const [enviando, setEnviando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('documentos').select('*').order('categoria').order('titulo').then(({ data }) => { if (data) setDocs(data) })

    const ch = supabase.channel('documentos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, async () => {
        const { data } = await supabase.from('documentos').select('*').order('categoria').order('titulo')
        if (data) setDocs(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const categorias = [...new Set(docs.map(d => d.categoria).filter(Boolean))] as string[]

  const visiveis = docs.filter(d =>
    (!categoria || d.categoria === categoria) &&
    (!busca || d.titulo.toLowerCase().includes(busca.toLowerCase()) || (d.conteudo ?? '').toLowerCase().includes(busca.toLowerCase()))
  )

  function abrirForm(doc?: Documento) {
    if (doc) {
      setEditando(doc)
      setForm({ titulo: doc.titulo, categoria: doc.categoria ?? '', conteudo: doc.conteudo ?? '', url: doc.url ?? '' })
    } else {
      setEditando(null)
      setForm({ titulo: '', categoria: categoria ?? '', conteudo: '', url: '' })
    }
    setShowForm(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      titulo: form.titulo.trim(),
      categoria: form.categoria.trim() || null,
      conteudo: form.conteudo.trim() || null,
      url: form.url.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (editando) await supabase.from('documentos').update(payload).eq('id', editando.id)
    else await supabase.from('documentos').insert(payload)
    setShowForm(false)
    setEditando(null)
  }

  async function remover(doc: Documento) {
    if (!confirm(`Excluir "${doc.titulo}"?`)) return
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    await supabase.from('documentos').delete().eq('id', doc.id)
  }

  /** Upload opcional: o arquivo vai pro bucket e a URL pública entra no campo url. */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    const path = `documentos/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('empresas').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('empresas').getPublicUrl(path)
      setForm(p => ({ ...p, url: data.publicUrl }))
    }
    setEnviando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-sunken">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-btn-primary" /> Documentações
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
            <Plus className="w-4 h-4" /> Nova
          </button>
        </div>

        {categorias.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCategoria(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!categoria ? 'bg-btn-primary text-white' : 'bg-white text-text-secondary border border-border hover:text-text-primary'}`}
            >
              Todas
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

        {visiveis.length === 0 ? (
          <Painel>
            <p className="text-sm text-text-secondary px-4 py-6 text-center">
              {docs.length === 0 ? 'Nenhuma documentação ainda. Crie a primeira.' : 'Nada encontrado.'}
            </p>
          </Painel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visiveis.map(d => (
              <Painel key={d.id} className="group">
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-text-primary truncate">{d.titulo}</h2>
                      {d.categoria && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-surface-sunken text-[11px] font-medium text-text-secondary">{d.categoria}</span>}
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => abrirForm(d)} className="p-1 text-text-secondary hover:text-text-primary transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remover(d)} className="p-1 text-text-secondary hover:text-red-500 transition-colors" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {d.conteudo && <p className="mt-2 text-xs text-text-secondary leading-relaxed whitespace-pre-wrap break-words line-clamp-6">{d.conteudo}</p>}
                  {d.url && (
                    <a
                      href={d.url.startsWith('http') ? d.url : `https://${d.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-btn-primary hover:underline max-w-full"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{d.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </a>
                  )}
                </div>
              </Painel>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <Modal titulo={editando ? 'Editar documentação' : 'Nova documentação'} onClose={() => { setShowForm(false); setEditando(null) }} maxWidth="max-w-lg">
          <form onSubmit={salvar} className="p-5 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={CAMPO_LABEL}>Título *</label>
                <input required autoFocus value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Config do Google Cloud" className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Categoria</label>
                <input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Infra" list="categorias-docs" className={INPUT} />
                <datalist id="categorias-docs">
                  {categorias.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label className={CAMPO_LABEL}>Conteúdo</label>
              <textarea value={form.conteudo} onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))} rows={8} placeholder="Texto livre — passos, comandos, observações..." className={`${INPUT} resize-y font-mono text-xs leading-relaxed`} />
            </div>
            <div>
              <label className={CAMPO_LABEL}>Link ou anexo</label>
              <div className="flex gap-2">
                <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." className={INPUT} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={enviando} className={`${BOTAO_DISCRETO} shrink-0 px-2 border border-border rounded-lg`} title="Enviar arquivo">
                  <Upload className="w-3.5 h-3.5" /> {enviando ? '...' : 'Arquivo'}
                </button>
                <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setEditando(null) }} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
              <button type="submit" className="px-4 py-1.5 bg-btn-primary text-white rounded-lg text-sm font-semibold hover:bg-btn-primary-hover transition-colors">
                {editando ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
