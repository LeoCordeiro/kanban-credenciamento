'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Empresa, Anexo, Comentario, Credencial, COLUNAS } from '@/types/kanban'
import { ArrowLeft, Upload, FileText, Trash2, Send, ImageIcon, Paperclip, Globe, Mail, Phone, KeyRound, Plus, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react'

function formatCNPJ(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatCPF(cpf: string) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-text-muted mb-1">{label}</p>
      <div className="text-base text-text">{children || <span className="text-text-muted">—</span>}</div>
    </div>
  )
}

export default function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [credenciais, setCredenciais] = useState<Credencial[]>([])
  const [showCredForm, setShowCredForm] = useState(false)
  const [editingCred, setEditingCred] = useState<Credencial | null>(null)
  const [credForm, setCredForm] = useState({ titulo: '', usuario: '', senha: '', url: '', notas: '' })
  const [senhasVisiveis, setSenhasVisiveis] = useState<Set<string>>(new Set())
  const [novoComentario, setNovoComentario] = useState('')
  const [uploading, setUploading] = useState(false)
  const [bgColor, setBgColor] = useState('#0079bf')
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('kanban-bg-color')
    if (saved) setBgColor(saved)
  }, [])

  useEffect(() => {
    supabase.from('empresas').select('*').eq('id', id).single().then(({ data }) => { if (data) setEmpresa(data) })
    supabase.from('anexos').select('*').eq('empresa_id', id).order('created_at', { ascending: false }).then(({ data }) => { if (data) setAnexos(data) })
    supabase.from('comentarios').select('*').eq('empresa_id', id).order('created_at', { ascending: true }).then(({ data }) => { if (data) setComentarios(data) })
    supabase.from('credenciais').select('*').eq('empresa_id', id).order('created_at', { ascending: false }).then(({ data }) => { if (data) setCredenciais(data) })

    const ch1 = supabase.channel(`empresa-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas', filter: `id=eq.${id}` }, (p) => {
        if (p.eventType === 'UPDATE') setEmpresa(p.new as Empresa)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anexos', filter: `empresa_id=eq.${id}` }, (p) => {
        if (p.eventType === 'INSERT') setAnexos(prev => [p.new as Anexo, ...prev])
        if (p.eventType === 'DELETE') setAnexos(prev => prev.filter(a => a.id !== (p.old as { id: string }).id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credenciais', filter: `empresa_id=eq.${id}` }, (p) => {
        if (p.eventType === 'INSERT') setCredenciais(prev => {
          if (prev.some(c => c.id === (p.new as Credencial).id)) return prev
          return [p.new as Credencial, ...prev]
        })
        if (p.eventType === 'UPDATE') setCredenciais(prev => prev.map(c => c.id === (p.new as Credencial).id ? p.new as Credencial : c))
        if (p.eventType === 'DELETE') setCredenciais(prev => prev.filter(c => c.id !== (p.old as { id: string }).id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios', filter: `empresa_id=eq.${id}` }, (p) => {
        if (p.eventType === 'INSERT') setComentarios(prev => {
          if (prev.some(c => c.id === (p.new as Comentario).id)) return prev
          return [...prev, p.new as Comentario]
        })
        if (p.eventType === 'DELETE') setComentarios(prev => prev.filter(c => c.id !== (p.old as { id: string }).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch1) }
  }, [id])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !empresa) return
    const ext = file.name.split('.').pop()
    const path = `logos/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('empresas').upload(path, file)
    if (error) return
    const { data } = supabase.storage.from('empresas').getPublicUrl(path)
    await supabase.from('empresas').update({ logo_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', empresa.id)
    setEmpresa(prev => prev ? { ...prev, logo_url: data.publicUrl } : prev)
  }

  async function handleUploadAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `anexos/${id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('empresas').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('empresas').getPublicUrl(path)
      await supabase.from('anexos').insert({ empresa_id: id, nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDeleteAnexo(anexo: Anexo) {
    const pathMatch = anexo.url.match(/empresas\/(.+)$/)
    if (pathMatch) await supabase.storage.from('empresas').remove([pathMatch[1]])
    await supabase.from('anexos').delete().eq('id', anexo.id)
  }

  async function handleEnviarComentario(e: React.FormEvent) {
    e.preventDefault()
    if (!novoComentario.trim()) return
    await supabase.from('comentarios').insert({ empresa_id: id, texto: novoComentario.trim() })
    setNovoComentario('')
  }

  async function handleDeleteComentario(cid: string) {
    await supabase.from('comentarios').delete().eq('id', cid)
  }

  function openCredForm(cred?: Credencial) {
    if (cred) {
      setEditingCred(cred)
      setCredForm({ titulo: cred.titulo, usuario: cred.usuario, senha: cred.senha ?? '', url: cred.url ?? '', notas: cred.notas ?? '' })
    } else {
      setEditingCred(null)
      setCredForm({ titulo: '', usuario: '', senha: '', url: '', notas: '' })
    }
    setShowCredForm(true)
  }

  async function handleSaveCred(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...credForm, senha: credForm.senha || null, url: credForm.url || null, notas: credForm.notas || null }
    if (editingCred) {
      await supabase.from('credenciais').update(payload).eq('id', editingCred.id)
    } else {
      await supabase.from('credenciais').insert({ ...payload, empresa_id: id })
    }
    setShowCredForm(false)
    setEditingCred(null)
  }

  async function handleDeleteCred(cid: string) {
    await supabase.from('credenciais').delete().eq('id', cid)
  }

  function toggleSenha(cid: string) {
    setSenhasVisiveis(prev => {
      const next = new Set(prev)
      next.has(cid) ? next.delete(cid) : next.add(cid)
      return next
    })
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto)
  }

  const darken = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.max(0, (n >> 16) - 30)
    const g = Math.max(0, ((n >> 8) & 0xff) - 30)
    const b = Math.max(0, (n & 0xff) - 30)
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
  }

  if (!empresa) return <div className="min-h-screen flex items-center justify-center text-white/70" style={{ backgroundColor: bgColor }}>Carregando...</div>

  const coluna = COLUNAS.find(c => c.id === empresa.coluna)

  return (
    <div className="min-h-screen text-text-primary" style={{ backgroundColor: bgColor }}>
      <header className="px-6 py-4" style={{ backgroundColor: darken(bgColor) + '99' }}>
        <Link href="/" className="inline-flex items-center gap-2 text-base text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" /> Voltar ao board
        </Link>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <button onClick={() => logoRef.current?.click()} className="relative group/logo shrink-0" title="Clique para alterar a logo">
            {empresa.logo_url ? (
              <img src={empresa.logo_url} alt="" className="w-24 h-24 rounded-2xl object-cover border border-border" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-border flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-text-muted" />
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
              <Upload className="w-7 h-7 text-white" />
            </div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{empresa.razao_social}</h1>
            {empresa.nome_fantasia && <p className="text-lg text-text-secondary mt-1">{empresa.nome_fantasia}</p>}
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm font-mono text-text-secondary">{formatCNPJ(empresa.cnpj)}</span>
              {coluna && (
                <span className="text-sm px-3 py-1 rounded-full font-medium" style={{ backgroundColor: coluna.cor + '20', color: coluna.cor }}>
                  {coluna.nome}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Linha 1: Dados da Empresa | Responsável */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text mb-5">Dados da Empresa</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Razão Social">{empresa.razao_social}</Field>
              <Field label="Nome Fantasia">{empresa.nome_fantasia}</Field>
              <Field label="CNPJ">{formatCNPJ(empresa.cnpj)}</Field>
              <Field label="CNAE Principal">{empresa.cnae_principal}</Field>
              <Field label="Endereço">{empresa.endereco}</Field>
              <Field label="Info Bancárias">{empresa.info_bancarias}</Field>
            </div>
          </section>

          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text mb-5">Responsável</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome Completo">{empresa.nome_completo}</Field>
              <Field label="CPF">{empresa.cpf ? formatCPF(empresa.cpf) : null}</Field>
              <Field label="Data de Nascimento">
                {empresa.data_nascimento ? new Date(empresa.data_nascimento).toLocaleDateString('pt-BR') : null}
              </Field>
            </div>
          </section>
        </div>

        {/* Linha 2: Contato | Credenciais */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text mb-5">Contato</h2>
            <div className="space-y-5">
              <Field label="E-mails">
                {empresa.emails ? (
                  <a href={`mailto:${empresa.emails}`} className="text-btn-primary hover:underline inline-flex items-center gap-2">
                    <Mail className="w-5 h-5" /> {empresa.emails}
                  </a>
                ) : null}
              </Field>
              <Field label="WhatsApp / Telefone">
                {empresa.whatsapp ? (
                  <a href={`tel:${empresa.whatsapp.replace(/\D/g, '')}`} className="text-btn-primary hover:underline inline-flex items-center gap-2">
                    <Phone className="w-5 h-5" /> {empresa.whatsapp}
                  </a>
                ) : null}
              </Field>
              <Field label="Site">
                {empresa.site ? (
                  <a href={empresa.site.startsWith('http') ? empresa.site : `https://${empresa.site}`} target="_blank" rel="noopener noreferrer" className="text-btn-primary hover:underline inline-flex items-center gap-2">
                    <Globe className="w-5 h-5" /> {empresa.site}
                  </a>
                ) : null}
              </Field>
            </div>
          </section>

          <section className="bg-white border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text inline-flex items-center gap-2"><KeyRound className="w-5 h-5" /> Credenciais</h2>
              <button onClick={() => openCredForm()} className="text-sm text-text-muted hover:text-text-secondary flex items-center gap-1.5 transition-colors">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            {credenciais.length === 0 && !showCredForm && <p className="text-base text-text-muted">Nenhuma credencial salva.</p>}

            <div className="space-y-4">
              {credenciais.map(c => (
                <div key={c.id} className="group bg-[#f4f5f7] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-text">{c.titulo}</span>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openCredForm(c)} className="p-1.5 text-text-muted hover:text-text-secondary transition-colors" title="Editar">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCred(c.id)} className="p-1.5 text-text-muted hover:text-red-400 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-text-muted uppercase mb-1">Usuário</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-text truncate">{c.usuario}</span>
                        <button onClick={() => copiar(c.usuario)} className="p-1 text-text-muted hover:text-text-secondary transition-colors" title="Copiar"><Copy className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {c.senha && (
                      <div>
                        <p className="text-xs text-text-muted uppercase mb-1">Senha</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-text font-mono">{senhasVisiveis.has(c.id) ? c.senha : '••••••••'}</span>
                          <button onClick={() => toggleSenha(c.id)} className="p-1 text-text-muted hover:text-text-secondary transition-colors">
                            {senhasVisiveis.has(c.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => copiar(c.senha!)} className="p-1 text-text-muted hover:text-text-secondary transition-colors" title="Copiar"><Copy className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                  {c.url && (
                    <a href={c.url.startsWith('http') ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer" className="text-sm text-btn-primary hover:underline inline-flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4" /> {c.url}
                    </a>
                  )}
                  {c.notas && <p className="text-sm text-text-muted">{c.notas}</p>}
                </div>
              ))}
            </div>

            {showCredForm && (
              <form onSubmit={handleSaveCred} className="mt-4 bg-[#f4f5f7] rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-muted uppercase mb-1.5">Título *</label>
                    <input required value={credForm.titulo} onChange={e => setCredForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Portal do Fornecedor" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted uppercase mb-1.5">URL</label>
                    <input value={credForm.url} onChange={e => setCredForm(p => ({ ...p, url: e.target.value }))} placeholder="https://site.com/login" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted uppercase mb-1.5">Usuário / E-mail *</label>
                    <input required value={credForm.usuario} onChange={e => setCredForm(p => ({ ...p, usuario: e.target.value }))} placeholder="usuario@email.com" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted uppercase mb-1.5">Senha</label>
                    <input value={credForm.senha} onChange={e => setCredForm(p => ({ ...p, senha: e.target.value }))} placeholder="••••••••" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-text-muted uppercase mb-1.5">Notas</label>
                    <input value={credForm.notas} onChange={e => setCredForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observações..." className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowCredForm(false); setEditingCred(null) }} className="px-4 py-2 text-sm text-text-secondary hover:text-text">Cancelar</button>
                  <button type="submit" className="px-5 py-2 bg-btn-primary text-white rounded-lg text-sm font-medium hover:bg-btn-primary-hover transition-colors">{editingCred ? 'Salvar' : 'Adicionar'}</button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* Linha 3: Comentários | Anexos */}
        <div className="grid grid-cols-2 gap-8">
          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text mb-5">Comentários</h2>
            <div className="space-y-4 mb-5 max-h-96 overflow-y-auto">
              {comentarios.length === 0 && <p className="text-base text-text-muted">Nenhum comentário ainda.</p>}
              {comentarios.map(c => (
                <div key={c.id} className="group flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#f4f5f7] flex items-center justify-center text-sm font-bold text-text-muted shrink-0 mt-0.5">
                    {c.autor[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-secondary">{c.autor}</span>
                      <span className="text-sm text-text-muted">{timeAgo(c.created_at)}</span>
                      <button onClick={() => handleDeleteComentario(c.id)} className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-base text-text mt-1 whitespace-pre-wrap">{c.texto}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleEnviarComentario} className="flex gap-3">
              <input
                value={novoComentario}
                onChange={e => setNovoComentario(e.target.value)}
                placeholder="Escrever comentário..."
                className="flex-1 px-4 py-2.5 bg-[#f4f5f7] border border-border rounded-lg text-base text-text placeholder:text-text-muted focus:outline-none focus:border-btn-primary transition-colors"
              />
              <button type="submit" disabled={!novoComentario.trim()} className="p-2.5 bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors disabled:opacity-30">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </section>

          <section className="bg-white border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text">Anexos</h2>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-sm text-text-muted hover:text-text-secondary flex items-center gap-1.5 transition-colors">
                <Upload className="w-4 h-4" /> {uploading ? 'Enviando...' : 'Enviar'}
              </button>
              <input ref={fileRef} type="file" onChange={handleUploadAnexo} className="hidden" />
            </div>
            <div className="space-y-3">
              {anexos.length === 0 && <p className="text-base text-text-muted">Nenhum anexo.</p>}
              {anexos.map(a => (
                <div key={a.id} className="group flex items-center gap-3 p-3 rounded-lg hover:bg-[#f4f5f7] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#f4f5f7] flex items-center justify-center shrink-0">
                    {a.tipo?.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-text-muted" /> : <FileText className="w-5 h-5 text-text-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-text hover:text-accent truncate block">{a.nome}</a>
                    {a.tamanho && <p className="text-xs text-text-muted">{formatBytes(a.tamanho)}</p>}
                  </div>
                  <button onClick={() => handleDeleteAnexo(a)} className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              className="mt-4 w-full py-5 border-2 border-dashed border-border hover:border-btn-primary rounded-lg flex flex-col items-center gap-2 text-text-muted hover:text-text-secondary transition-colors"
            >
              <Paperclip className="w-5 h-5" />
              <span className="text-sm">Anexar arquivo</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
