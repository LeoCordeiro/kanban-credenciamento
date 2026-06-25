'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Empresa, Anexo, Comentario, Credencial, Plataforma, COLUNAS } from '@/types/kanban'
import { ArrowLeft, Upload, FileText, Trash2, Send, ImageIcon, Paperclip, Globe, Mail, Phone, KeyRound, Plus, Eye, EyeOff, Copy, ExternalLink, Pencil, Flag } from 'lucide-react'

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

function getLuminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  const [rs, gs, bs] = [r, g, b].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function Field({ label, children, copyValue }: { label: string; children: React.ReactNode; copyValue?: string }) {
  return (
    <div>
      <p className="text-sm text-text-muted mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="text-base text-text-primary flex-1 min-w-0">{children || <span className="text-text-muted">—</span>}</div>
        {copyValue && (
          <button onClick={() => navigator.clipboard.writeText(copyValue)} className="p-1 text-text-muted hover:text-text-secondary transition-colors shrink-0" title="Copiar">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const plataformaId = searchParams.get('plataforma')
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [plataformaNome, setPlataformaNome] = useState<string | null>(null)
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
  const [isEditingContato, setIsEditingContato] = useState(false)
  const [contatoForm, setContatoForm] = useState({ emails: '', whatsapp: '', site: '' })

  useEffect(() => {
    const saved = localStorage.getItem('kanban-bg-color')
    if (saved) setBgColor(saved)
  }, [])

  useEffect(() => {
    supabase.from('empresas').select('*').eq('id', id).single().then(({ data }) => { if (data) setEmpresa(data) })
    supabase.from('anexos').select('*').eq('empresa_id', id).order('created_at', { ascending: false }).then(({ data }) => { if (data) setAnexos(data) })
    supabase.from('credenciais').select('*').eq('empresa_id', id).order('created_at', { ascending: false }).then(({ data }) => { if (data) setCredenciais(data) })

    if (plataformaId) {
      supabase.from('plataformas').select('nome').eq('id', plataformaId).single().then(({ data }) => { if (data) setPlataformaNome(data.nome) })
      supabase.from('comentarios').select('*').eq('empresa_id', id).eq('plataforma_id', plataformaId).order('created_at', { ascending: true }).then(({ data }) => { if (data) setComentarios(data) })
    } else {
      setComentarios([])
    }

    const ch1 = supabase.channel(`empresa-${id}-${plataformaId || 'all'}`)
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
        const comment = p.new as Comentario
        if (plataformaId && comment?.plataforma_id !== plataformaId) return
        if (p.eventType === 'INSERT') setComentarios(prev => {
          if (prev.some(c => c.id === comment.id)) return prev
          return [...prev, comment]
        })
        if (p.eventType === 'UPDATE') setComentarios(prev => prev.map(c => c.id === comment.id ? comment : c))
        if (p.eventType === 'DELETE') setComentarios(prev => prev.filter(c => c.id !== (p.old as { id: string }).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch1) }
  }, [id, plataformaId])

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
    setAnexos(prev => prev.filter(a => a.id !== anexo.id))
    const pathMatch = anexo.url.match(/empresas\/(.+)$/)
    if (pathMatch) await supabase.storage.from('empresas').remove([pathMatch[1]])
    await supabase.from('anexos').delete().eq('id', anexo.id)
  }

  async function handleEnviarComentario(e: React.FormEvent) {
    e.preventDefault()
    if (!novoComentario.trim() || !plataformaId) return
    await supabase.from('comentarios').insert({ empresa_id: id, texto: novoComentario.trim(), plataforma_id: plataformaId })
    setNovoComentario('')
  }

  async function syncRedFlag(updatedComments: Comentario[]) {
    const hasAnyFlag = updatedComments.some(c => c.red_flag)
    if (plataformaId) {
      await supabase.from('empresa_plataforma').update({ has_red_flag: hasAnyFlag }).eq('empresa_id', id).eq('plataforma_id', plataformaId)
    }
  }

  async function handleDeleteComentario(cid: string) {
    setComentarios(prev => prev.filter(c => c.id !== cid))
    await supabase.from('comentarios').delete().eq('id', cid)
    const remaining = comentarios.filter(c => c.id !== cid)
    await syncRedFlag(remaining)
  }

  async function handleToggleRedFlag(comentario: Comentario) {
    const newValue = !comentario.red_flag
    setComentarios(prev => prev.map(c => c.id === comentario.id ? { ...c, red_flag: newValue } : c))
    await supabase.from('comentarios').update({ red_flag: newValue }).eq('id', comentario.id)
    const updatedList = comentarios.map(c => c.id === comentario.id ? { ...c, red_flag: newValue } : c)
    await syncRedFlag(updatedList)
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
    setCredenciais(prev => prev.filter(c => c.id !== cid))
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

  function startEditContato() {
    if (!empresa) return
    setContatoForm({
      emails: empresa.emails || '',
      whatsapp: empresa.whatsapp || '',
      site: empresa.site || '',
    })
    setIsEditingContato(true)
  }

  async function handleSaveContato() {
    if (!empresa) return
    const payload = {
      emails: contatoForm.emails.trim() || null,
      whatsapp: contatoForm.whatsapp.trim() || null,
      site: contatoForm.site.trim() || null,
    }
    const { error } = await supabase.from('empresas').update(payload).eq('id', id)
    if (error) {
      console.error('Erro ao atualizar contatos:', error)
      alert('Erro ao atualizar contatos: ' + error.message)
    } else {
      setEmpresa(prev => prev ? { ...prev, ...payload } : prev)
      setIsEditingContato(false)
    }
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
  const isLightBg = getLuminance(bgColor) > 0.35
  const headerText = isLightBg ? '#172b4d' : '#ffffff'
  const headerSub = isLightBg ? '#5e6c84' : 'rgba(255,255,255,0.7)'

  return (
    <div className="min-h-screen text-text-primary" style={{ backgroundColor: bgColor }}>
      <header className="px-6 py-4" style={{ backgroundColor: darken(bgColor) + '99' }}>
        <Link href="/" className="inline-flex items-center gap-2 text-base transition-colors" style={{ color: headerSub }} onMouseEnter={e => e.currentTarget.style.color = headerText} onMouseLeave={e => e.currentTarget.style.color = headerSub}>
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
            <h1 className="text-3xl font-bold" style={{ color: headerText }}>{empresa.razao_social}</h1>
            {empresa.nome_fantasia && <p className="text-lg mt-1" style={{ color: headerSub }}>{empresa.nome_fantasia}</p>}
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm font-mono" style={{ color: headerSub }}>{formatCNPJ(empresa.cnpj)}</span>
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
            <h2 className="text-lg font-semibold text-text-primary mb-5">Dados da Empresa</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Razão Social" copyValue={empresa.razao_social}>{empresa.razao_social}</Field>
              <Field label="Nome Fantasia">{empresa.nome_fantasia}</Field>
              <Field label="CNPJ" copyValue={empresa.cnpj}>{formatCNPJ(empresa.cnpj)}</Field>
              <Field label="CNAE Principal">{empresa.cnae_principal}</Field>
              <div className="col-span-2">
                <Field label="CNAEs Secundários">{empresa.cnaes_secundarios}</Field>
              </div>
              <Field label="Endereço da Empresa">{empresa.endereco_empresa}</Field>
              <Field label="Info Bancárias">{empresa.info_bancarias}</Field>
            </div>
          </section>

          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-5">Responsável</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome Completo" copyValue={empresa.nome_completo ?? undefined}>{empresa.nome_completo}</Field>
              <Field label="CPF" copyValue={empresa.cpf ?? undefined}>{empresa.cpf ? formatCPF(empresa.cpf) : null}</Field>
              <Field label="Data de Nascimento" copyValue={empresa.data_nascimento ? new Date(empresa.data_nascimento).toLocaleDateString('pt-BR') : undefined}>
                {empresa.data_nascimento ? new Date(empresa.data_nascimento).toLocaleDateString('pt-BR') : null}
              </Field>
              <Field label="Endereço de Contato">{empresa.endereco}</Field>
            </div>
          </section>
        </div>

        {/* Linha 2: Contato | Credenciais */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {isEditingContato ? (
            <section className="bg-white border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-text-primary">Contato</h2>
                <div className="flex gap-2">
                  <button onClick={handleSaveContato} className="text-sm text-btn-primary hover:underline font-medium">Salvar</button>
                  <button onClick={() => setIsEditingContato(false)} className="text-sm text-text-muted hover:text-text-secondary">Cancelar</button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-text-muted uppercase mb-1.5 font-medium">E-mails</label>
                  <input
                    value={contatoForm.emails}
                    onChange={e => setContatoForm(p => ({ ...p, emails: e.target.value }))}
                    placeholder="email@empresa.com"
                    className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted uppercase mb-1.5 font-medium">WhatsApp / Telefone</label>
                  <input
                    value={contatoForm.whatsapp}
                    onChange={e => setContatoForm(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted uppercase mb-1.5 font-medium">Site</label>
                  <input
                    value={contatoForm.site}
                    onChange={e => setContatoForm(p => ({ ...p, site: e.target.value }))}
                    placeholder="https://empresa.com"
                    className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary"
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className="bg-white border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-text-primary">Contato</h2>
                <button onClick={startEditContato} className="text-sm text-text-muted hover:text-text-secondary flex items-center gap-1 transition-colors">
                  <Pencil className="w-4 h-4" /> Editar
                </button>
              </div>
              <div className="space-y-5">
                <Field label="E-mails" copyValue={empresa.emails ?? undefined}>
                  {empresa.emails ? (
                    <a href={`mailto:${empresa.emails}`} className="text-btn-primary hover:underline inline-flex items-center gap-2">
                      <Mail className="w-5 h-5" /> {empresa.emails}
                    </a>
                  ) : null}
                </Field>
                <Field label="WhatsApp / Telefone" copyValue={empresa.whatsapp ?? undefined}>
                  {empresa.whatsapp ? (
                    <a href={`tel:${empresa.whatsapp.replace(/\D/g, '')}`} className="text-btn-primary hover:underline inline-flex items-center gap-2">
                      <Phone className="w-5 h-5" /> {empresa.whatsapp}
                    </a>
                  ) : null}
                </Field>
                <Field label="Site" copyValue={empresa.site ?? undefined}>
                  {empresa.site ? (
                    <a href={empresa.site.startsWith('http') ? empresa.site : `https://${empresa.site}`} target="_blank" rel="noopener noreferrer" className="text-btn-primary hover:underline inline-flex items-center gap-2">
                      <Globe className="w-5 h-5" /> {empresa.site}
                    </a>
                  ) : null}
                </Field>
              </div>
            </section>
          )}

          <section className="bg-white border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text-primary inline-flex items-center gap-2"><KeyRound className="w-5 h-5" /> Credenciais</h2>
              <button onClick={() => openCredForm()} className="text-sm text-text-muted hover:text-text-secondary flex items-center gap-1.5 transition-colors">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            {credenciais.length === 0 && !showCredForm && <p className="text-base text-text-muted">Nenhuma credencial salva.</p>}

            <div className="space-y-4">
              {credenciais.map(c => (
                <div key={c.id} className="group bg-[#f4f5f7] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-text-primary">{c.titulo}</span>
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
                        <span className="text-sm text-text-primary truncate">{c.usuario}</span>
                        <button onClick={() => copiar(c.usuario)} className="p-1 text-text-muted hover:text-text-secondary transition-colors" title="Copiar"><Copy className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {c.senha && (
                      <div>
                        <p className="text-xs text-text-muted uppercase mb-1">Senha</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-text-primary font-mono">{senhasVisiveis.has(c.id) ? c.senha : '••••••••'}</span>
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
                    <input required value={credForm.titulo} onChange={e => setCredForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Portal do Fornecedor" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted uppercase mb-1.5">URL</label>
                    <input value={credForm.url} onChange={e => setCredForm(p => ({ ...p, url: e.target.value }))} placeholder="https://site.com/login" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted uppercase mb-1.5">Usuário / E-mail *</label>
                    <input required value={credForm.usuario} onChange={e => setCredForm(p => ({ ...p, usuario: e.target.value }))} placeholder="usuario@email.com" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted uppercase mb-1.5">Senha</label>
                    <input value={credForm.senha} onChange={e => setCredForm(p => ({ ...p, senha: e.target.value }))} placeholder="••••••••" className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-text-muted uppercase mb-1.5">Notas</label>
                    <input value={credForm.notas} onChange={e => setCredForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observações..." className="w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary" />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowCredForm(false); setEditingCred(null) }} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancelar</button>
                  <button type="submit" className="px-5 py-2 bg-btn-primary text-white rounded-lg text-sm font-medium hover:bg-btn-primary-hover transition-colors">{editingCred ? 'Salvar' : 'Adicionar'}</button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* Linha 3: Comentários | Anexos */}
        <div className="grid grid-cols-2 gap-8">
          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-5">
              Comentários{plataformaNome && <span className="text-sm font-normal text-text-muted ml-2">— {plataformaNome}</span>}
            </h2>
            {!plataformaId ? (
              <p className="text-base text-text-muted">Acesse a empresa pelo board de uma plataforma para ver e adicionar comentários.</p>
            ) : (<>
            <div className="space-y-4 mb-5 max-h-96 overflow-y-auto">
              {comentarios.length === 0 && <p className="text-base text-text-muted">Nenhum comentário ainda.</p>}
              {comentarios.map(c => (
                <div key={c.id} className={`group flex gap-3 rounded-lg p-2 -mx-2 transition-colors ${c.red_flag ? 'bg-red-50 border border-red-200' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${c.red_flag ? 'bg-red-100 text-red-600' : 'bg-[#f4f5f7] text-text-muted'}`}>
                    {c.autor[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-secondary">{c.autor}</span>
                      <span className="text-sm text-text-muted">{timeAgo(c.created_at)}</span>
                      {c.red_flag && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 uppercase tracking-wide">
                          <Flag className="w-2.5 h-2.5 fill-red-500" />
                          Red Flag
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => handleToggleRedFlag(c)}
                          title={c.red_flag ? 'Remover red flag' : 'Marcar como red flag'}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                            c.red_flag
                              ? 'text-red-500 hover:text-red-700 opacity-100'
                              : 'text-text-muted hover:text-red-500'
                          }`}
                        >
                          <Flag className={`w-4 h-4 ${c.red_flag ? 'fill-red-500' : ''}`} />
                        </button>
                        <button onClick={() => handleDeleteComentario(c.id)} className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-base text-text-primary mt-1 whitespace-pre-wrap">{c.texto}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleEnviarComentario} className="flex gap-3">
              <input
                value={novoComentario}
                onChange={e => setNovoComentario(e.target.value)}
                placeholder="Escrever comentário..."
                className="flex-1 px-4 py-2.5 bg-[#f4f5f7] border border-border rounded-lg text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary transition-colors"
              />
              <button type="submit" disabled={!novoComentario.trim()} className="p-2.5 bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors disabled:opacity-30">
                <Send className="w-5 h-5" />
              </button>
            </form>
            </>)}
          </section>

          <section className="bg-white border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text-primary">Anexos</h2>
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
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-text-primary hover:text-accent truncate block">{a.nome}</a>
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
