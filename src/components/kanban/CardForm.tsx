'use client'

import { useState, useRef } from 'react'
import { Empresa } from '@/types/kanban'
import { supabase } from '@/lib/supabase'
import { X, Upload, ImageIcon, Loader2 } from 'lucide-react'

interface Props {
  empresa: Empresa | null
  onSave: (data: Partial<Empresa>) => Promise<void>
  onClose: () => void
}

function maskCNPJ(v: string) {
  return v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18)
}

function maskCPF(v: string) {
  return v.replace(/\D/g, '').replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2').slice(0, 14)
}

export function CardForm({ empresa, onSave, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'found' | 'notfound'>('idle')
  const [logoPreview, setLogoPreview] = useState<string | null>(empresa?.logo_url ?? null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    razao_social: empresa?.razao_social ?? '',
    nome_fantasia: empresa?.nome_fantasia ?? '',
    cnpj: empresa?.cnpj ? maskCNPJ(empresa.cnpj) : '',
    cnae_principal: empresa?.cnae_principal ?? '',
    nome_completo: empresa?.nome_completo ?? '',
    cpf: empresa?.cpf ? maskCPF(empresa.cpf) : '',
    data_nascimento: empresa?.data_nascimento ?? '',
    endereco: empresa?.endereco ?? '',
    info_bancarias: empresa?.info_bancarias ?? '',
    emails: empresa?.emails ?? '',
    whatsapp: empresa?.whatsapp ?? '',
    site: empresa?.site ?? '',
  })

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  async function buscarCNPJ(cnpjRaw: string) {
    const digits = cnpjRaw.replace(/\D/g, '')
    if (digits.length !== 14) return
    setBuscandoCNPJ(true)
    setCnpjStatus('idle')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) { setCnpjStatus('notfound'); return }
      const d = await res.json()
      const endereco = [d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf, d.cep].filter(Boolean).join(', ')
      setForm(prev => ({
        ...prev,
        razao_social: d.razao_social || prev.razao_social,
        nome_fantasia: d.nome_fantasia || prev.nome_fantasia,
        cnae_principal: d.cnae_fiscal_descricao ? `${d.cnae_fiscal} - ${d.cnae_fiscal_descricao}` : prev.cnae_principal,
        endereco: endereco || prev.endereco,
        emails: d.email || prev.emails,
        whatsapp: d.ddd_telefone_1 || prev.whatsapp,
      }))
      setCnpjStatus('found')
    } catch {
      setCnpjStatus('notfound')
    } finally {
      setBuscandoCNPJ(false)
    }
  }

  function handleCNPJChange(value: string) {
    const masked = maskCNPJ(value)
    set('cnpj', masked)
    setCnpjStatus('idle')
    if (masked.replace(/\D/g, '').length === 14) buscarCNPJ(masked)
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return empresa?.logo_url ?? null
    const ext = logoFile.name.split('.').pop()
    const path = `logos/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('empresas').upload(path, logoFile)
    if (error) return empresa?.logo_url ?? null
    const { data } = supabase.storage.from('empresas').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const logo_url = await uploadLogo()
    await onSave({
      ...form,
      cnpj: form.cnpj.replace(/\D/g, ''),
      cpf: form.cpf ? form.cpf.replace(/\D/g, '') : null,
      nome_fantasia: form.nome_fantasia || null,
      cnae_principal: form.cnae_principal || null,
      nome_completo: form.nome_completo || null,
      data_nascimento: form.data_nascimento || null,
      endereco: form.endereco || null,
      info_bancarias: form.info_bancarias || null,
      emails: form.emails || null,
      whatsapp: form.whatsapp || null,
      site: form.site || null,
      logo_url,
    })
    setSaving(false)
  }

  const inputClass = 'w-full px-3 py-2 bg-white border border-border rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'
  const labelClass = 'block text-xs font-medium text-text-secondary mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{empresa ? 'Editar Empresa' : 'Nova Empresa'}</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-xl border-2 border-dashed border-border hover:border-accent/60 flex items-center justify-center overflow-hidden transition-colors shrink-0"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-text-muted" />
              )}
            </button>
            <div>
              <p className="text-sm text-text">Logo da empresa</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 mt-1">
                <Upload className="w-3 h-3" /> Enviar imagem
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>CNPJ *</label>
              <div className="relative">
                <input required value={form.cnpj} onChange={e => handleCNPJChange(e.target.value)} className={inputClass} placeholder="00.000.000/0000-00" />
                {buscandoCNPJ && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />}
              </div>
              {cnpjStatus === 'found' && <p className="text-[11px] text-green-500 mt-1">Dados preenchidos automaticamente</p>}
              {cnpjStatus === 'notfound' && <p className="text-[11px] text-yellow-500 mt-1">CNPJ não encontrado na Receita</p>}
            </div>
            <div>
              <label className={labelClass}>Nome Fantasia</label>
              <input value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} className={inputClass} placeholder="Nome Fantasia" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Razão Social *</label>
              <input required value={form.razao_social} onChange={e => set('razao_social', e.target.value)} className={inputClass} placeholder="Razão Social da empresa" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Atividade / CNAE Principal</label>
              <input value={form.cnae_principal} onChange={e => set('cnae_principal', e.target.value)} className={inputClass} placeholder="CNAE" />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-muted mb-3 font-medium uppercase tracking-wider">Responsável</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nome Completo</label>
                <input value={form.nome_completo} onChange={e => set('nome_completo', e.target.value)} className={inputClass} placeholder="Nome do responsável" />
              </div>
              <div>
                <label className={labelClass}>CPF</label>
                <input value={form.cpf} onChange={e => set('cpf', maskCPF(e.target.value))} className={inputClass} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className={labelClass}>Data de Nascimento</label>
                <input type="date" value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Endereço</label>
                <input value={form.endereco} onChange={e => set('endereco', e.target.value)} className={inputClass} placeholder="Endereço completo" />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-muted mb-3 font-medium uppercase tracking-wider">Contato & Financeiro</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>E-mails</label>
                <input value={form.emails} onChange={e => set('emails', e.target.value)} className={inputClass} placeholder="email@empresa.com" />
              </div>
              <div>
                <label className={labelClass}>WhatsApp</label>
                <input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className={labelClass}>Site</label>
                <input value={form.site} onChange={e => set('site', e.target.value)} className={inputClass} placeholder="https://empresa.com" />
              </div>
              <div>
                <label className={labelClass}>Info Bancárias</label>
                <input value={form.info_bancarias} onChange={e => set('info_bancarias', e.target.value)} className={inputClass} placeholder="Banco, agência, conta" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-btn-primary text-white rounded text-sm font-medium hover:bg-btn-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : empresa ? 'Salvar' : 'Criar Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
