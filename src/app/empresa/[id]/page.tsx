'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Empresa, Anexo, Comentario, Credencial, COLUNAS } from '@/types/kanban'
import { Checklist } from '@/components/Checklist'
import { ZapPanel, useZapPanel, temWhatsapp } from '@/components/ZapPanel'
import { useAuth } from '@/lib/auth'
import { MessageCircle } from 'lucide-react'
import { ArrowLeft, Upload, FileText, Trash2, Send, ImageIcon, Paperclip, Globe, Mail, Phone, KeyRound, Plus, Eye, EyeOff, Copy, ExternalLink, Pencil, Flag, Check, Building2, User, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

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

function maskCNPJ(v: string) {
  return v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18)
}

function maskCPF(v: string) {
  return v.replace(/\D/g, '').replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2').slice(0, 14)
}

/**
 * Data pura (coluna `date`, ex. "2000-09-07") formatada sem passar por Date.
 * `new Date('2000-09-07')` lê a string como meia-noite UTC; em São Paulo (UTC-3)
 * isso vira 21h do dia anterior e a tela mostrava sempre um dia a menos que o
 * que foi digitado. Não usar Date aqui — a data de nascimento não tem fuso.
 */
function formatarDataBR(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
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

/* ── Vocabulário visual da ficha ────────────────────────────────────────────
   Mesma linguagem do board: card branco arredondado com sombra suave, fonte
   do sistema, escala de texto padrão do Tailwind, rótulos em caixa normal.
   Mono só no dado que se copia — o card do board já usa mono no CNPJ.       */

const INPUT = 'w-full px-3 py-2 bg-[#f4f5f7] border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-btn-primary transition-colors'
const CAMPO_LABEL = 'block text-xs text-text-secondary mb-1'
const TITULO_SECAO = 'text-base font-semibold text-text-primary'
const BOTAO_DISCRETO = 'inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors'

function Painel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-card-bg border border-border rounded-xl shadow-sm overflow-hidden ${className}`}>{children}</section>
}

function CabecalhoSecao({ icone, titulo, contagem, children }: { icone?: React.ReactNode; titulo: string; contagem?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
      {icone}
      <h2 className={TITULO_SECAO}>{titulo}</h2>
      {contagem}
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  )
}

function CopyBtn({ value, titulo = 'Copiar' }: { value: string; titulo?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200) }}
      className={`shrink-0 p-1 rounded-lg transition-colors ${ok ? 'text-green-600' : 'text-text-muted hover:text-accent hover:bg-black/5'}`}
      title={titulo}
      aria-label={titulo}
    >
      {ok ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

function Field({ label, children, copyValue, mono, span }: { label: string; children: React.ReactNode; copyValue?: string; mono?: boolean; span?: boolean }) {
  return (
    <div data-campo className={span ? 'col-span-2' : ''}>
      <dt className={CAMPO_LABEL}>{label}</dt>
      <dd className="flex items-start gap-1">
        <div className={`flex-1 min-w-0 text-sm leading-snug text-text-primary ${mono ? 'font-mono' : ''}`}>
          {children || <span className="text-text-muted">—</span>}
        </div>
        {copyValue && <CopyBtn value={copyValue} />}
      </dd>
    </div>
  )
}

/** CNAEs secundários é o maior vilão de altura da tela (chega a 2 mil caracteres).
 *  Fechado mostra só os códigos — que é o que se digita no portal da plataforma;
 *  aberto mostra código + descrição numa lista com rolagem própria. */
function CnaesSecundarios({ texto }: { texto: string | null }) {
  const [aberto, setAberto] = useState(false)
  const itens = (texto ?? '').split(';').map(s => s.trim()).filter(Boolean)

  if (itens.length === 0) return <span className="text-text-muted">—</span>
  if (itens.length === 1) return <span>{itens[0]}</span>

  const partes = itens.map(i => {
    const m = i.match(/^([\d.\-/]+)\s*[-–]\s*(.*)$/)
    return m ? { codigo: m[1], desc: m[2] } : { codigo: '', desc: i }
  })

  return (
    <div>
      <button onClick={() => setAberto(v => !v)} className="flex items-center gap-1 text-xs font-medium text-btn-primary hover:underline">
        {itens.length} atividades
        {aberto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {aberto ? (
        <ul className="scroll-fino mt-1 max-h-[132px] overflow-y-auto divide-y divide-border border-y border-border">
          {partes.map((p, i) => (
            <li key={i} className="flex gap-2 py-1 text-xs leading-tight">
              {p.codigo && <span className="font-mono text-text-secondary shrink-0">{p.codigo}</span>}
              <span className="text-text-primary min-w-0">{p.desc}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 font-mono text-xs text-text-secondary truncate" title={partes.map(p => p.codigo || p.desc).join(' · ')}>
          {partes.map(p => p.codigo || p.desc).join(' · ')}
        </p>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const plataformaId = searchParams.get('plataforma')
  const { usuario } = useAuth()
  const zap = useZapPanel()
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
  const [isEditingDados, setIsEditingDados] = useState(false)
  const [dadosForm, setDadosForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    cnae_principal: '',
    cnaes_secundarios: '',
    endereco_empresa: '',
    info_bancarias: '',
  })
  const [isEditingResponsavel, setIsEditingResponsavel] = useState(false)
  const [responsavelForm, setResponsavelForm] = useState({
    nome_completo: '',
    nome_mae: '',
    cpf: '',
    data_nascimento: '',
    endereco: '',
  })

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
    await supabase.from('comentarios').insert({ empresa_id: id, texto: novoComentario.trim(), plataforma_id: plataformaId, autor: usuario?.nome ?? null })
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

  function startEditDados() {
    if (!empresa) return
    setDadosForm({
      razao_social: empresa.razao_social || '',
      nome_fantasia: empresa.nome_fantasia || '',
      cnpj: empresa.cnpj ? maskCNPJ(empresa.cnpj) : '',
      cnae_principal: empresa.cnae_principal || '',
      cnaes_secundarios: empresa.cnaes_secundarios || '',
      endereco_empresa: empresa.endereco_empresa || '',
      info_bancarias: empresa.info_bancarias || '',
    })
    setIsEditingDados(true)
  }

  async function handleSaveDados() {
    if (!empresa) return
    const payload = {
      razao_social: dadosForm.razao_social.trim(),
      nome_fantasia: dadosForm.nome_fantasia.trim() || null,
      cnpj: dadosForm.cnpj.replace(/\D/g, ''),
      cnae_principal: dadosForm.cnae_principal.trim() || null,
      cnaes_secundarios: dadosForm.cnaes_secundarios.trim() || null,
      endereco_empresa: dadosForm.endereco_empresa.trim() || null,
      info_bancarias: dadosForm.info_bancarias.trim() || null,
    }
    if (!payload.razao_social || !payload.cnpj) {
      alert('Razão Social e CNPJ são obrigatórios')
      return
    }
    const { error } = await supabase.from('empresas').update(payload).eq('id', id)
    if (error) {
      console.error('Erro ao atualizar dados da empresa:', error)
      alert('Erro ao atualizar dados: ' + error.message)
    } else {
      setEmpresa(prev => prev ? { ...prev, ...payload } : prev)
      setIsEditingDados(false)
    }
  }

  function startEditResponsavel() {
    if (!empresa) return
    setResponsavelForm({
      nome_completo: empresa.nome_completo || '',
      nome_mae: empresa.nome_mae || '',
      cpf: empresa.cpf ? maskCPF(empresa.cpf) : '',
      data_nascimento: empresa.data_nascimento || '',
      endereco: empresa.endereco || '',
    })
    setIsEditingResponsavel(true)
  }

  async function handleSaveResponsavel() {
    if (!empresa) return
    const payload = {
      nome_completo: responsavelForm.nome_completo.trim() || null,
      nome_mae: responsavelForm.nome_mae.trim() || null,
      cpf: responsavelForm.cpf ? responsavelForm.cpf.replace(/\D/g, '') : null,
      data_nascimento: responsavelForm.data_nascimento || null,
      endereco: responsavelForm.endereco.trim() || null,
    }
    const { error } = await supabase.from('empresas').update(payload).eq('id', id)
    if (error) {
      console.error('Erro ao atualizar dados do responsável:', error)
      alert('Erro ao atualizar dados: ' + error.message)
    } else {
      setEmpresa(prev => prev ? { ...prev, ...payload } : prev)
      setIsEditingResponsavel(false)
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
      {/* Barra única: voltar, identidade e situação da empresa numa linha só.
          O bloco antigo de cabeçalho gastava ~180px de altura só com chrome. */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 h-13 px-6 py-2 backdrop-blur-sm"
        style={{ backgroundColor: darken(bgColor) + 'dd' }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium shrink-0 transition-colors"
          style={{ color: headerSub }}
          onMouseEnter={e => e.currentTarget.style.color = headerText}
          onMouseLeave={e => e.currentTarget.style.color = headerSub}
        >
          <ArrowLeft className="w-4 h-4" /> Board
        </Link>

        <span className="w-px h-5 shrink-0" style={{ backgroundColor: headerSub, opacity: 0.3 }} />

        <button onClick={() => logoRef.current?.click()} className="relative group/logo shrink-0" title="Clique para alterar a logo">
          {empresa.logo_url ? (
            <img src={empresa.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-white/20" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-black/20 border border-white/15 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" style={{ color: headerSub }} />
            </div>
          )}
          <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
            <Upload className="w-4 h-4 text-white" />
          </div>
          <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
        </button>

        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <h1 className="text-base font-semibold leading-tight truncate" style={{ color: headerText }}>{empresa.razao_social}</h1>
          {empresa.nome_fantasia && <span className="hidden lg:inline text-xs truncate" style={{ color: headerSub }}>{empresa.nome_fantasia}</span>}
        </div>

        {/* Em tela estreita some o que já está repetido na ficha logo abaixo
            (fantasia, CNPJ, plataforma) — some o dado duplicado, não o único. */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigator.clipboard.writeText(empresa.cnpj)}
            className="hidden sm:block shrink-0 font-mono text-xs tracking-tight px-2 py-0.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: headerSub }}
            title="Copiar CNPJ"
          >
            {formatCNPJ(empresa.cnpj)}
          </button>
          {plataformaNome && (
            <span className="hidden xl:inline shrink-0 text-xs font-medium px-2 py-0.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: headerText }}>
              {plataformaNome}
            </span>
          )}
          {coluna && (
            <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap" style={{ backgroundColor: coluna.cor, color: '#fff' }}>
              {coluna.nome}
            </span>
          )}
        </div>
      </header>

      {/* Composição assimétrica por densidade real: a ficha cadastral (o que se
          copia o dia inteiro) leva a coluna larga; operação e histórico ficam ao lado. */}
      <main
        data-detalhe-root
        className="grid items-start gap-3 px-4 py-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1.1fr)] xl:h-[calc(100vh-3.25rem)] xl:items-stretch xl:overflow-hidden"
      >
        {/* ── Coluna A — ficha cadastral ─────────────────────────────────── */}
        <Painel className="lg:col-span-2 xl:col-span-1 xl:h-full xl:overflow-y-auto scroll-fino">
          {/* Empresa */}
          <CabecalhoSecao icone={<Building2 className="w-3.5 h-3.5 text-text-muted" />} titulo="Empresa">
            {isEditingDados ? (
              <>
                <button onClick={handleSaveDados} className="text-xs font-semibold text-btn-primary hover:underline">Salvar</button>
                <button onClick={() => setIsEditingDados(false)} className="text-xs text-text-secondary hover:text-text-primary">Cancelar</button>
              </>
            ) : (
              <button onClick={startEditDados} className={BOTAO_DISCRETO}><Pencil className="w-3 h-3" /> Editar</button>
            )}
          </CabecalhoSecao>

          {isEditingDados ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3">
              <div>
                <label className={CAMPO_LABEL}>Razão Social *</label>
                <input value={dadosForm.razao_social} onChange={e => setDadosForm(p => ({ ...p, razao_social: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Nome Fantasia</label>
                <input value={dadosForm.nome_fantasia} onChange={e => setDadosForm(p => ({ ...p, nome_fantasia: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>CNPJ *</label>
                <input value={dadosForm.cnpj} onChange={e => setDadosForm(p => ({ ...p, cnpj: maskCNPJ(e.target.value) }))} className={`${INPUT} font-mono`} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>CNAE Principal</label>
                <input value={dadosForm.cnae_principal} onChange={e => setDadosForm(p => ({ ...p, cnae_principal: e.target.value }))} className={INPUT} />
              </div>
              <div className="col-span-2">
                <label className={CAMPO_LABEL}>CNAEs Secundários</label>
                <textarea value={dadosForm.cnaes_secundarios} onChange={e => setDadosForm(p => ({ ...p, cnaes_secundarios: e.target.value }))} className={`${INPUT} resize-none`} rows={2} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Endereço da Empresa</label>
                <input value={dadosForm.endereco_empresa} onChange={e => setDadosForm(p => ({ ...p, endereco_empresa: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Info Bancárias</label>
                <input value={dadosForm.info_bancarias} onChange={e => setDadosForm(p => ({ ...p, info_bancarias: e.target.value }))} className={INPUT} />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3">
              <Field label="Razão Social" copyValue={empresa.razao_social}>{empresa.razao_social}</Field>
              <Field label="Nome Fantasia" copyValue={empresa.nome_fantasia ?? undefined}>{empresa.nome_fantasia}</Field>
              <Field label="CNPJ" copyValue={empresa.cnpj} mono>{formatCNPJ(empresa.cnpj)}</Field>
              <Field label="CNAE Principal" copyValue={empresa.cnae_principal ?? undefined}>{empresa.cnae_principal}</Field>
              <Field label="CNAEs Secundários" copyValue={empresa.cnaes_secundarios ?? undefined} span>
                <CnaesSecundarios texto={empresa.cnaes_secundarios} />
              </Field>
              <Field label="Endereço da Empresa" copyValue={empresa.endereco_empresa ?? undefined}>{empresa.endereco_empresa}</Field>
              <Field label="Info Bancárias" copyValue={empresa.info_bancarias ?? undefined} mono>{empresa.info_bancarias}</Field>
            </dl>
          )}

          {/* Responsável */}
          <CabecalhoSecao icone={<User className="w-3.5 h-3.5 text-text-muted" />} titulo="Responsável">
            {isEditingResponsavel ? (
              <>
                <button onClick={handleSaveResponsavel} className="text-xs font-semibold text-btn-primary hover:underline">Salvar</button>
                <button onClick={() => setIsEditingResponsavel(false)} className="text-xs text-text-secondary hover:text-text-primary">Cancelar</button>
              </>
            ) : (
              <button onClick={startEditResponsavel} className={BOTAO_DISCRETO}><Pencil className="w-3 h-3" /> Editar</button>
            )}
          </CabecalhoSecao>

          {isEditingResponsavel ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3">
              <div>
                <label className={CAMPO_LABEL}>Nome Completo</label>
                <input value={responsavelForm.nome_completo} onChange={e => setResponsavelForm(p => ({ ...p, nome_completo: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Nome da Mãe</label>
                <input value={responsavelForm.nome_mae} onChange={e => setResponsavelForm(p => ({ ...p, nome_mae: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>CPF</label>
                <input value={responsavelForm.cpf} onChange={e => setResponsavelForm(p => ({ ...p, cpf: maskCPF(e.target.value) }))} className={`${INPUT} font-mono`} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Data de Nascimento</label>
                <input type="date" value={responsavelForm.data_nascimento} onChange={e => setResponsavelForm(p => ({ ...p, data_nascimento: e.target.value }))} className={`${INPUT} font-mono`} />
              </div>
              <div className="col-span-2">
                <label className={CAMPO_LABEL}>Endereço de Contato</label>
                <input value={responsavelForm.endereco} onChange={e => setResponsavelForm(p => ({ ...p, endereco: e.target.value }))} className={INPUT} />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3">
              <Field label="Nome Completo" copyValue={empresa.nome_completo ?? undefined}>{empresa.nome_completo}</Field>
              <Field label="Nome da Mãe" copyValue={empresa.nome_mae ?? undefined}>{empresa.nome_mae}</Field>
              <Field label="CPF" copyValue={empresa.cpf ?? undefined} mono>{empresa.cpf ? formatCPF(empresa.cpf) : null}</Field>
              <Field
                label="Data de Nascimento"
                copyValue={empresa.data_nascimento ? formatarDataBR(empresa.data_nascimento) : undefined}
                mono
              >
                {empresa.data_nascimento ? formatarDataBR(empresa.data_nascimento) : null}
              </Field>
              <Field label="Endereço de Contato" copyValue={empresa.endereco ?? undefined} span>{empresa.endereco}</Field>
            </dl>
          )}

          {/* Contato */}
          <CabecalhoSecao icone={<Mail className="w-3.5 h-3.5 text-text-muted" />} titulo="Contato">
            {isEditingContato ? (
              <>
                <button onClick={handleSaveContato} className="text-xs font-semibold text-btn-primary hover:underline">Salvar</button>
                <button onClick={() => setIsEditingContato(false)} className="text-xs text-text-secondary hover:text-text-primary">Cancelar</button>
              </>
            ) : (
              <button onClick={startEditContato} className={BOTAO_DISCRETO}><Pencil className="w-3 h-3" /> Editar</button>
            )}
          </CabecalhoSecao>

          {isEditingContato ? (
            <div className="grid grid-cols-3 gap-x-3 gap-y-2 p-3">
              <div>
                <label className={CAMPO_LABEL}>E-mails</label>
                <input value={contatoForm.emails} onChange={e => setContatoForm(p => ({ ...p, emails: e.target.value }))} placeholder="email@empresa.com" className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>WhatsApp / Telefone</label>
                <input value={contatoForm.whatsapp} onChange={e => setContatoForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(00) 00000-0000" className={INPUT} />
              </div>
              <div>
                <label className={CAMPO_LABEL}>Site</label>
                <input value={contatoForm.site} onChange={e => setContatoForm(p => ({ ...p, site: e.target.value }))} placeholder="https://empresa.com" className={INPUT} />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2 p-3">
              <div data-campo>
                <dt className={CAMPO_LABEL}>E-mails</dt>
                <dd className="flex items-start gap-1">
                  <div className="flex-1 min-w-0 text-sm leading-[1.35]">
                    {empresa.emails ? (
                      <a href={`mailto:${empresa.emails}`} className="text-btn-primary hover:underline inline-flex items-center gap-1.5 min-w-0 max-w-full">
                        <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{empresa.emails}</span>
                      </a>
                    ) : <span className="text-text-muted">—</span>}
                  </div>
                  {empresa.emails && <CopyBtn value={empresa.emails} />}
                </dd>
              </div>

              <div data-campo>
                <dt className={CAMPO_LABEL}>WhatsApp / Telefone</dt>
                <dd className="flex items-start gap-1">
                  <div className="flex-1 min-w-0 text-sm leading-[1.35]">
                    {empresa.whatsapp ? (
                      <span className="inline-flex items-center gap-2 flex-wrap max-w-full">
                        <a href={`tel:${empresa.whatsapp.replace(/\D/g, '')}`} className="text-btn-primary hover:underline inline-flex items-center gap-1.5 font-mono max-w-full">
                          <Phone className="w-3.5 h-3.5 shrink-0" /> {empresa.whatsapp}
                        </a>
                        {temWhatsapp(empresa.whatsapp) && (
                          <button
                            onClick={() => zap.abrir(empresa.razao_social, empresa.whatsapp!)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <MessageCircle className="w-3 h-3" /> Abrir conversa
                          </button>
                        )}
                      </span>
                    ) : <span className="text-text-muted">—</span>}
                  </div>
                  {empresa.whatsapp && <CopyBtn value={empresa.whatsapp} />}
                </dd>
              </div>

              <div data-campo>
                <dt className={CAMPO_LABEL}>Site</dt>
                <dd className="flex items-start gap-1">
                  <div className="flex-1 min-w-0 text-sm leading-[1.35]">
                    {empresa.site ? (
                      <a href={empresa.site.startsWith('http') ? empresa.site : `https://${empresa.site}`} target="_blank" rel="noopener noreferrer" className="text-btn-primary hover:underline inline-flex items-center gap-1.5 min-w-0 max-w-full">
                        <Globe className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{empresa.site}</span>
                      </a>
                    ) : <span className="text-text-muted">—</span>}
                  </div>
                  {empresa.site && <CopyBtn value={empresa.site} />}
                </dd>
              </div>
            </dl>
          )}
        </Painel>

        {/* ── Coluna B — o que falta e como entrar ───────────────────────── */}
        <div className="flex flex-col gap-3 min-w-0 xl:h-full xl:min-h-0">
          <Checklist empresaId={id} />

          <Painel className="xl:flex-1 xl:min-h-0 xl:flex xl:flex-col">
            <CabecalhoSecao
              icone={<KeyRound className="w-3.5 h-3.5 text-text-muted" />}
              titulo="Credenciais"
              contagem={credenciais.length > 0 ? <span className="text-xs font-mono text-text-secondary">{credenciais.length}</span> : undefined}
            >
              <button onClick={() => openCredForm()} className={BOTAO_DISCRETO}><Plus className="w-3 h-3" /> Adicionar</button>
            </CabecalhoSecao>

            {credenciais.length === 0 && !showCredForm && <p className="text-xs text-text-secondary px-3 py-2.5">Nenhuma credencial salva.</p>}

            {credenciais.length > 0 && (
              <div className="scroll-fino max-h-[46vh] xl:max-h-none xl:flex-1 xl:min-h-0 overflow-y-auto divide-y divide-border">
                {credenciais.map(c => (
                  <div key={c.id} className="group px-3 py-2 hover:bg-card-hover transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary truncate">{c.titulo}</span>
                      {c.url && (
                        <a
                          href={c.url.startsWith('http') ? c.url : `https://${c.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={c.url}
                          className="text-btn-primary hover:text-btn-primary-hover shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openCredForm(c)} className="p-0.5 text-text-secondary hover:text-text-primary transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteCred(c.id)} className="p-0.5 text-text-secondary hover:text-red-500 transition-colors" title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-0.5 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-xs">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <span className="text-xs text-text-secondary">usuário</span>
                        <span className="font-mono text-text-primary truncate min-w-0">{c.usuario}</span>
                        <CopyBtn value={c.usuario} titulo="Copiar usuário" />
                      </span>
                      {c.senha && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs text-text-secondary">senha</span>
                          <span className="font-mono text-text-primary">{senhasVisiveis.has(c.id) ? c.senha : '••••••••'}</span>
                          <button onClick={() => toggleSenha(c.id)} className="p-0.5 text-text-secondary hover:text-btn-primary transition-colors" title={senhasVisiveis.has(c.id) ? 'Ocultar' : 'Mostrar'}>
                            {senhasVisiveis.has(c.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <CopyBtn value={c.senha} titulo="Copiar senha" />
                        </span>
                      )}
                    </div>

                    {c.notas && <p className="mt-0.5 text-xs text-text-secondary leading-tight">{c.notas}</p>}
                  </div>
                ))}
              </div>
            )}

            {showCredForm && (
              <form onSubmit={handleSaveCred} className="border-t border-border bg-card-hover p-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <label className={CAMPO_LABEL}>Título *</label>
                    <input required value={credForm.titulo} onChange={e => setCredForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Portal do Fornecedor" className={`${INPUT} bg-white`} />
                  </div>
                  <div>
                    <label className={CAMPO_LABEL}>URL</label>
                    <input value={credForm.url} onChange={e => setCredForm(p => ({ ...p, url: e.target.value }))} placeholder="https://site.com/login" className={`${INPUT} bg-white`} />
                  </div>
                  <div>
                    <label className={CAMPO_LABEL}>Usuário / E-mail *</label>
                    <input required value={credForm.usuario} onChange={e => setCredForm(p => ({ ...p, usuario: e.target.value }))} placeholder="usuario@email.com" className={`${INPUT} bg-white`} />
                  </div>
                  <div>
                    <label className={CAMPO_LABEL}>Senha</label>
                    <input value={credForm.senha} onChange={e => setCredForm(p => ({ ...p, senha: e.target.value }))} placeholder="••••••••" className={`${INPUT} bg-white font-mono`} />
                  </div>
                  <div className="col-span-2">
                    <label className={CAMPO_LABEL}>Notas</label>
                    <input value={credForm.notas} onChange={e => setCredForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observações..." className={`${INPUT} bg-white`} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowCredForm(false); setEditingCred(null) }} className="px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary">Cancelar</button>
                  <button type="submit" className="px-3 py-1 bg-btn-primary text-white rounded-lg text-xs font-semibold hover:bg-btn-primary-hover transition-colors">{editingCred ? 'Salvar' : 'Adicionar'}</button>
                </div>
              </form>
            )}
          </Painel>
        </div>

        {/* ── Coluna C — histórico e documentos ──────────────────────────── */}
        <div className="flex flex-col gap-3 min-w-0 xl:h-full xl:min-h-0">
          <Painel className="xl:flex-1 xl:min-h-0 xl:flex xl:flex-col">
            <CabecalhoSecao
              icone={<MessageSquare className="w-3.5 h-3.5 text-text-muted" />}
              titulo="Comentários"
              contagem={plataformaNome ? <span className="text-xs text-text-secondary truncate">— {plataformaNome}</span> : undefined}
            />
            {!plataformaId ? (
              <p className="text-xs text-text-secondary px-3 py-2.5">Acesse a empresa pelo board de uma plataforma para ver e adicionar comentários.</p>
            ) : (
              <>
                <div className="scroll-fino max-h-[46vh] xl:max-h-none xl:flex-1 xl:min-h-0 overflow-y-auto divide-y divide-border">
                  {comentarios.length === 0 && <p className="text-xs text-text-secondary px-3 py-2.5">Nenhum comentário ainda.</p>}
                  {comentarios.map(c => (
                    <div key={c.id} className={`group flex gap-2 px-4 py-2.5 transition-colors ${c.red_flag ? 'bg-red-50' : 'hover:bg-card-hover'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${c.red_flag ? 'bg-red-100 text-red-600' : 'bg-[#f4f5f7] text-text-secondary'}`}>
                        {c.autor[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-text-secondary capitalize">{c.autor}</span>
                          <span className="text-xs text-text-secondary">{timeAgo(c.created_at)}</span>
                          {c.red_flag && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 uppercase tracking-wide">
                              <Flag className="w-2.5 h-2.5 fill-red-500" /> Red flag
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-0.5">
                            <button
                              onClick={() => handleToggleRedFlag(c)}
                              title={c.red_flag ? 'Remover red flag' : 'Marcar como red flag'}
                              className={`p-0.5 rounded-lg transition-all ${c.red_flag ? 'text-red-500 hover:text-red-700 opacity-100' : 'opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500'}`}
                            >
                              <Flag className={`w-3.5 h-3.5 ${c.red_flag ? 'fill-red-500' : ''}`} />
                            </button>
                            <button onClick={() => handleDeleteComentario(c.id)} title="Excluir" className="opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-red-500 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs leading-[1.4] text-text-primary whitespace-pre-wrap break-words">{c.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleEnviarComentario} className="flex gap-2 border-t border-border p-3">
                  <input
                    value={novoComentario}
                    onChange={e => setNovoComentario(e.target.value)}
                    placeholder="Escrever comentário..."
                    className={INPUT}
                  />
                  <button type="submit" disabled={!novoComentario.trim()} className="shrink-0 px-2 bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors disabled:opacity-30">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </Painel>

          <Painel>
            <CabecalhoSecao
              icone={<Paperclip className="w-3.5 h-3.5 text-text-muted" />}
              titulo="Anexos"
              contagem={anexos.length > 0 ? <span className="text-xs font-mono text-text-secondary">{anexos.length}</span> : undefined}
            >
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className={BOTAO_DISCRETO}>
                <Upload className="w-3 h-3" /> {uploading ? 'Enviando...' : 'Enviar'}
              </button>
              <input ref={fileRef} type="file" onChange={handleUploadAnexo} className="hidden" />
            </CabecalhoSecao>

            {anexos.length === 0 ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full m-0 py-3 flex items-center justify-center gap-2 text-xs text-text-secondary hover:text-btn-primary hover:bg-card-hover transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" /> Anexar arquivo
              </button>
            ) : (
              <div className="scroll-fino max-h-[26vh] overflow-y-auto divide-y divide-border">
                {anexos.map(a => (
                  <div key={a.id} className="group flex items-center gap-2 px-4 py-2.5 hover:bg-card-hover transition-colors">
                    {a.tipo?.startsWith('image/')
                      ? <ImageIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      : <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-xs text-text-primary hover:text-btn-primary truncate">{a.nome}</a>
                    {a.tamanho && <span className="text-xs font-mono text-text-secondary shrink-0">{formatBytes(a.tamanho)}</span>}
                    <button onClick={() => handleDeleteAnexo(a)} title="Excluir" className="opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-red-500 transition-all shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Painel>
        </div>
      </main>

      {zap.alvo && (
        <ZapPanel empresa={zap.alvo.empresa} whatsapp={zap.alvo.whatsapp} onClose={zap.fechar} />
      )}
    </div>
  )
}
