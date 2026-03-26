'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useConsultant } from '@/hooks/use-consultant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Pencil, Phone, Mail, Instagram, Linkedin,
  Building2, User, Shield, Briefcase, Upload, Loader2,
  MessageSquare, Check, X, Settings, Sparkles, FileText, ExternalLink, Trash2,
} from 'lucide-react'
import { formatCurrency, formatDate, PROPERTY_TYPES } from '@/lib/constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConsultantPhotoCropper } from '@/components/consultants/consultant-photo-cropper'
import { useImageCompress } from '@/hooks/use-image-compress'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .611.611l4.458-1.495A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.222 0-4.313-.617-6.103-1.69l-.262-.156-3.146 1.054 1.054-3.146-.156-.262A9.713 9.713 0 0 1 2.25 12c0-5.376 4.374-9.75 9.75-9.75S21.75 6.624 21.75 12s-4.374 9.75-9.75 9.75z"/>
    </svg>
  )
}

const TABS = [
  { key: 'perfil' as const, label: 'Perfil', icon: User },
  { key: 'privado' as const, label: 'Privado', icon: Shield },
  { key: 'imoveis' as const, label: 'Imóveis', icon: Building2 },
  { key: 'comissoes' as const, label: 'Comissões', icon: Briefcase },
]

type TabKey = (typeof TABS)[number]['key']

export default function ConsultorDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { consultant, isLoading, refetch } = useConsultant(id)
  const [activeTab, setActiveTab] = useState<TabKey>('perfil')
  const [properties, setProperties] = useState<any[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropperSrc, setCropperSrc] = useState<string | null>(null)
  const [cropperOpen, setCropperOpen] = useState(false)
  const { compressImage } = useImageCompress()

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [settingsRoleId, setSettingsRoleId] = useState('')
  const [privadoSubTab, setPrivadoSubTab] = useState<'identificacao' | 'morada' | 'empresa' | 'contrato'>('identificacao')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [analyzingDoc, setAnalyzingDoc] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null)
  const [localDocUrl, setLocalDocUrl] = useState<string | null>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const [uploadingContract, setUploadingContract] = useState(false)
  const [analyzingContract, setAnalyzingContract] = useState(false)
  const [contractAnalysis, setContractAnalysis] = useState<Record<string, any> | null>(null)
  const [localContractUrl, setLocalContractUrl] = useState<string | null>(null)
  const contractFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/libraries/roles').then(r => r.ok ? r.json() : []).then(d => setRoles(d || [])).catch(() => {})
  }, [])

  // Populate draft when entering edit mode
  const enterEdit = () => {
    if (!consultant) return
    const profile = consultant.dev_consultant_profiles
    const priv = consultant.dev_consultant_private_data as any
    setDraft({
      professional_email: consultant.professional_email || '',
      phone_commercial: profile?.phone_commercial || '',
      instagram_handle: profile?.instagram_handle || '',
      linkedin_url: profile?.linkedin_url || '',
      bio: profile?.bio || '',
      specializations: (profile?.specializations || []).join(', '),
      languages: (profile?.languages || []).join(', '),
      // Identification
      full_name: priv?.full_name || '',
      gender: priv?.gender || '',
      birth_date: priv?.birth_date || '',
      id_doc_type: priv?.id_doc_type || 'cc',
      id_doc_number: priv?.id_doc_number || '',
      id_doc_expiry: priv?.id_doc_expiry || '',
      id_doc_issuer: priv?.id_doc_issuer || '',
      nationality: priv?.nationality || 'Portuguesa',
      nif: priv?.nif || '',
      // Address
      address_private: priv?.address_private || '',
      postal_code: priv?.postal_code || '',
      city: priv?.city || '',
      district: priv?.district || '',
      concelho: priv?.concelho || '',
      zone: priv?.zone || '',
      country: priv?.country || 'Portugal',
      // Company
      has_company: priv?.has_company || false,
      company_name: priv?.company_name || '',
      company_phone: priv?.company_phone || '',
      company_email: priv?.company_email || '',
      company_address: priv?.company_address || '',
      company_nipc: priv?.company_nipc || '',
      company_website: priv?.company_website || '',
      iban: priv?.iban || '',
      // Contract
      monthly_salary: priv?.monthly_salary != null ? String(priv.monthly_salary) : '',
      commission_rate: priv?.commission_rate != null ? String(priv.commission_rate) : '',
      hiring_date: priv?.hiring_date || '',
      contract_start_date: priv?.contract_start_date || '',
      contract_end_date: priv?.contract_end_date || '',
      contract_type: priv?.contract_type || '',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft({})
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/consultants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { professional_email: draft.professional_email || null },
          profile: {
            phone_commercial: draft.phone_commercial || null,
            instagram_handle: draft.instagram_handle || null,
            linkedin_url: draft.linkedin_url || null,
            bio: draft.bio || null,
            specializations: draft.specializations ? draft.specializations.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
            languages: draft.languages ? draft.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          },
          private_data: {
            full_name: draft.full_name || null,
            gender: draft.gender || null,
            birth_date: draft.birth_date || null,
            id_doc_type: draft.id_doc_type || null,
            id_doc_number: draft.id_doc_number || null,
            id_doc_expiry: draft.id_doc_expiry || null,
            id_doc_issuer: draft.id_doc_issuer || null,
            nationality: draft.nationality || null,
            nif: draft.nif || null,
            address_private: draft.address_private || null,
            postal_code: draft.postal_code || null,
            city: draft.city || null,
            district: draft.district || null,
            concelho: draft.concelho || null,
            zone: draft.zone || null,
            country: draft.country || null,
            has_company: draft.has_company || false,
            company_name: draft.company_name || null,
            company_phone: draft.company_phone || null,
            company_email: draft.company_email || null,
            company_address: draft.company_address || null,
            company_nipc: draft.company_nipc || null,
            company_website: draft.company_website || null,
            iban: draft.iban || null,
            monthly_salary: draft.monthly_salary ? Number(draft.monthly_salary) : null,
            commission_rate: draft.commission_rate ? Number(draft.commission_rate) : null,
            hiring_date: draft.hiring_date || null,
            contract_start_date: draft.contract_start_date || null,
            contract_end_date: draft.contract_end_date || null,
            contract_type: draft.contract_type || null,
          },
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro')
      toast.success('Dados guardados com sucesso')
      setEditing(false)
      refetch()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const ud = (field: string, value: string) => setDraft(d => ({ ...d, [field]: value }))

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'id-document')
      const res = await fetch(`/api/consultants/${id}/documents`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erro no upload')
      const { url } = await res.json()

      // Save URL to private data (no refetch — update local state)
      await fetch(`/api/consultants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ private_data: { id_doc_file_url: url } }),
      })
      setLocalDocUrl(url)
      toast.success('Documento carregado')

      // Auto-analyze
      setAnalyzingDoc(true)
      const analyzeRes = await fetch(`/api/consultants/${id}/analyze-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_url: url }),
      })
      if (analyzeRes.ok) {
        const result = await analyzeRes.json()
        setAnalysisResult(result)
        toast.success('Documento analisado com IA')
      } else {
        const err = await analyzeRes.json().catch(() => ({}))
        toast.error(err.error || 'Erro ao analisar documento')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar documento')
    } finally {
      setUploadingDoc(false)
      setAnalyzingDoc(false)
      if (docFileRef.current) docFileRef.current.value = ''
    }
  }

  const applyAnalysis = () => {
    if (!analysisResult) return
    const mapping: Record<string, string> = {
      tipo_documento: 'id_doc_type',
      numero_documento: 'id_doc_number',
      full_name: 'full_name',
      nif: 'nif',
      data_nascimento: 'birth_date',
      data_validade_documento: 'id_doc_expiry',
      nacionalidade: 'nationality',
      pais_emissor: 'id_doc_issuer',
      genero: 'gender',
    }
    const updates: Record<string, any> = {}
    for (const [aiKey, formKey] of Object.entries(mapping)) {
      if (analysisResult[aiKey] != null) updates[formKey] = analysisResult[aiKey]
    }
    // Enter edit mode FIRST (initializes draft from DB), then overlay AI data
    if (!editing) enterEdit()
    // Use setTimeout to ensure enterEdit's setDraft runs first
    setTimeout(() => {
      setDraft(d => ({ ...d, ...updates }))
    }, 0)
    setAnalysisResult(null)
    toast.success('Dados aplicados ao formulário')
  }

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingContract(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'contract')
      const res = await fetch(`/api/consultants/${id}/documents`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erro no upload')
      const { url } = await res.json()

      await fetch(`/api/consultants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ private_data: { contract_file_url: url } }),
      })
      setLocalContractUrl(url)
      toast.success('Contrato carregado')

      // Auto-analyze
      setAnalyzingContract(true)
      const analyzeRes = await fetch(`/api/consultants/${id}/analyze-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_url: url }),
      })
      if (analyzeRes.ok) {
        const result = await analyzeRes.json()
        setContractAnalysis(result)
        toast.success('Contrato analisado com IA')
      } else {
        const err = await analyzeRes.json().catch(() => ({}))
        toast.error(err.error || 'Erro ao analisar contrato')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar contrato')
    } finally {
      setUploadingContract(false)
      setAnalyzingContract(false)
      if (contractFileRef.current) contractFileRef.current.value = ''
    }
  }

  const applyContractAnalysis = () => {
    if (!contractAnalysis) return
    const updates: Record<string, any> = {}
    if (contractAnalysis.contract_type) updates.contract_type = contractAnalysis.contract_type
    if (contractAnalysis.contract_start_date) updates.contract_start_date = contractAnalysis.contract_start_date
    if (contractAnalysis.contract_end_date) updates.contract_end_date = contractAnalysis.contract_end_date
    if (contractAnalysis.hiring_date) updates.hiring_date = contractAnalysis.hiring_date
    if (contractAnalysis.monthly_salary != null) updates.monthly_salary = String(contractAnalysis.monthly_salary)
    if (contractAnalysis.commission_rate != null) updates.commission_rate = String(contractAnalysis.commission_rate)
    if (contractAnalysis.full_name) updates.full_name = contractAnalysis.full_name
    if (contractAnalysis.nif) updates.nif = contractAnalysis.nif
    if (contractAnalysis.iban) updates.iban = contractAnalysis.iban
    if (!editing) enterEdit()
    setTimeout(() => {
      setDraft(d => ({ ...d, ...updates }))
    }, 0)
    setContractAnalysis(null)
    toast.success('Dados do contrato aplicados')
  }

  const saveSettings = async (roleId: string) => {
    try {
      const res = await fetch(`/api/consultants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId || undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success('Definições guardadas')
      refetch()
    } catch { toast.error('Erro ao guardar definições') }
  }

  useEffect(() => {
    if (activeTab !== 'imoveis' || !id) return
    setPropertiesLoading(true)
    fetch(`/api/properties?consultant_id=${id}&per_page=100`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProperties(data?.data || []))
      .catch(() => setProperties([]))
      .finally(() => setPropertiesLoading(false))
  }, [activeTab, id])

  const handleToggleActive = async () => {
    if (!consultant) return
    try {
      const res = await fetch(`/api/consultants/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { is_active: !consultant.is_active } }),
      })
      if (!res.ok) throw new Error()
      toast.success(consultant.is_active ? 'Consultor desactivado' : 'Consultor activado')
      refetch()
    } catch { toast.error('Erro ao actualizar estado') }
  }

  const handleToggleWebsite = async () => {
    if (!consultant) return
    try {
      const res = await fetch(`/api/consultants/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { display_website: !consultant.display_website } }),
      })
      if (!res.ok) throw new Error()
      toast.success(consultant.display_website ? 'Removido do website' : 'Visível no website')
      refetch()
    } catch { toast.error('Erro ao actualizar') }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropperSrc(url)
    setCropperOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCroppedPhoto = async (blob: Blob) => {
    setUploadingPhoto(true)
    try {
      const raw = new File([blob], 'photo.webp', { type: 'image/webp' })
      const compressed = await compressImage(raw)
      const formData = new FormData()
      formData.append('file', compressed)
      const res = await fetch(`/api/consultants/${id}/photo`, { method: 'POST', body: formData })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro') }
      toast.success('Foto actualizada')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setUploadingPhoto(false)
      if (cropperSrc) { URL.revokeObjectURL(cropperSrc); setCropperSrc(null) }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!consultant) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold">Consultor não encontrado</h2>
        <p className="text-muted-foreground mt-1">O consultor que procura não existe.</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  const profile = consultant.dev_consultant_profiles
  const privateData = consultant.dev_consultant_private_data as any
  const roleName = consultant.user_roles?.[0]?.roles?.name || null
  const phone = profile?.phone_commercial
  const initials = consultant.commercial_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <button
          onClick={() => router.push('/dashboard/consultores')}
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <button
          onClick={() => { setSettingsRoleId(consultant.user_roles?.[0]?.role_id || ''); setShowSettings(true) }}
          className="absolute top-4 right-4 z-20 inline-flex items-center justify-center h-8 w-8 bg-white/15 backdrop-blur-sm text-white border border-white/20 rounded-full hover:bg-white/25 transition-colors"
          title="Definições"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <div className="relative z-10 px-8 pt-14 pb-8 sm:px-10 flex items-center gap-6">
          <div className="relative group shrink-0">
            <div className="h-20 w-20 rounded-full ring-4 ring-white/20 shadow-xl overflow-hidden">
              {profile?.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt={consultant.commercial_name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-white/10 text-white text-2xl font-semibold">{initials}</div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {uploadingPhoto ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Upload className="h-5 w-5 text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{consultant.commercial_name}</h2>
              {consultant.is_active ? (
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
              ) : (
                <Badge variant="outline" className="text-white/60 border-white/20 text-[10px]">Inativo</Badge>
              )}
              <button
                onClick={handleToggleWebsite}
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border transition-colors',
                  consultant.display_website
                    ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-400/20 hover:bg-red-500/30'
                )}
              >
                {consultant.display_website ? 'No Website' : 'Oculto do Website'}
              </button>
            </div>
            <p className="text-neutral-400 text-sm mt-1">
              {roleName || 'Sem função atribuída'}
              {consultant.created_at && ` · Desde ${formatDate(consultant.created_at)}`}
            </p>
            <div className="flex gap-2 mt-3">
              {phone && <a href={`tel:${phone}`} className="h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/25 transition-all" title="Ligar"><Phone className="h-3.5 w-3.5" /></a>}
              {phone && <a href={`sms:${phone}`} className="h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/25 transition-all" title="SMS"><MessageSquare className="h-3.5 w-3.5" /></a>}
              {phone && <a href={`https://wa.me/351${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/25 transition-all" title="WhatsApp"><WhatsAppIcon className="h-3.5 w-3.5" /></a>}
              {consultant.professional_email && <a href={`mailto:${consultant.professional_email}`} className="h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/25 transition-all" title="Email"><Mail className="h-3.5 w-3.5" /></a>}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Pill Navigation + Edit Toggle ─── */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Edit toggle — only for perfil and privado tabs */}
        {(activeTab === 'perfil' || activeTab === 'privado') && (
          editing ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 px-3 text-xs"
                onClick={cancelEdit}
                disabled={saving}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-full h-8 px-3 text-xs"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                Guardar
              </Button>
            </div>
          ) : (
            <button
              onClick={enterEdit}
              className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>

      {/* ─── Content ─── */}
      <div className="mt-6 pb-6">
        <div key={activeTab} className="animate-in fade-in duration-300">

          {/* ═══════ PERFIL ═══════ */}
          {activeTab === 'perfil' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Contacto */}
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />Contacto
                  </h3>
                  <div className="space-y-3">
                    <EditableRow label="Email" field="professional_email" value={consultant.professional_email} editing={editing} draft={draft} onChange={ud} />
                    <EditableRow label="Telemóvel" field="phone_commercial" value={phone} editing={editing} draft={draft} onChange={ud} />
                    <EditableRow label="Instagram" field="instagram_handle" value={profile?.instagram_handle ? `@${profile.instagram_handle}` : null} editing={editing} draft={draft} onChange={ud} icon={<Instagram className="h-3.5 w-3.5" />} />
                    <EditableRow label="LinkedIn" field="linkedin_url" value={profile?.linkedin_url} editing={editing} draft={draft} onChange={ud} icon={<Linkedin className="h-3.5 w-3.5" />} />
                  </div>
                </div>

                {/* Competências — next to Contacto */}
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Competências</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Especializações</p>
                      {editing ? (
                        <Input
                          className="rounded-lg text-sm"
                          value={draft.specializations || ''}
                          onChange={(e) => ud('specializations', e.target.value)}
                          placeholder="Ex: Luxo, Investimento, Primeira habitação..."
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(profile?.specializations && profile.specializations.length > 0) ? (
                            profile.specializations.map((spec) => (
                              <Badge key={spec} variant="secondary" className="rounded-full text-[11px] bg-muted/50">{spec}</Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Idiomas</p>
                      {editing ? (
                        <Input
                          className="rounded-lg text-sm"
                          value={draft.languages || ''}
                          onChange={(e) => ud('languages', e.target.value)}
                          placeholder="Ex: Português, Inglês, Francês..."
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(profile?.languages && profile.languages.length > 0) ? (
                            profile.languages.map((lang) => (
                              <Badge key={lang} variant="outline" className="rounded-full text-[11px]">{lang}</Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biografia</h3>
                {editing ? (
                  <Textarea
                    className="rounded-xl text-sm"
                    rows={3}
                    value={draft.bio || ''}
                    onChange={(e) => ud('bio', e.target.value)}
                    placeholder="Breve descrição do consultor..."
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {profile?.bio || '—'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══════ DADOS PRIVADOS ═══════ */}
          {activeTab === 'privado' && (
            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
              {/* Sub-tabs */}
              <div className="flex items-center gap-1 p-1 m-4 mb-0 rounded-full bg-muted/50 border border-border/30 w-fit">
                {([['identificacao', '📋 Identificação'], ['morada', '📍 Morada'], ['empresa', '🏢 Empresa'], ['contrato', '📄 Dados Contratuais']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setPrivadoSubTab(key)} className={cn('px-3.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all', privadoSubTab === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-5 pt-4">
                {/* ── Identificação ── */}
                {privadoSubTab === 'identificacao' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados Pessoais</h3>
                    </div>
                    <div className="rounded-xl border p-4 space-y-3">
                      <EmojiField emoji="👤" label="Nome Completo" field="full_name" value={privateData?.full_name} editing={editing} draft={draft} onChange={ud} fullWidth />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EmojiField emoji="👤" label="Género" field="gender" value={privateData?.gender} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🎂" label="Data de Nascimento" field="birth_date" value={privateData?.birth_date ? formatDate(privateData.birth_date) : null} editing={editing} draft={draft} onChange={ud} type="date" />
                    </div>

                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Documento de Identificação</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <EmojiField emoji="📄" label="Tipo de Documento" field="id_doc_type" value={privateData?.id_doc_type === 'cc' ? 'Cartão de Cidadão' : privateData?.id_doc_type} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🆔" label="Número de Documento" field="id_doc_number" value={privateData?.id_doc_number} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="📅" label="Data de Validade" field="id_doc_expiry" value={privateData?.id_doc_expiry ? formatDate(privateData.id_doc_expiry) : null} editing={editing} draft={draft} onChange={ud} type="date" />
                      <EmojiField emoji="🌐" label="Nacionalidade" field="nationality" value={privateData?.nationality} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🏳️" label="País Emissor" field="id_doc_issuer" value={privateData?.id_doc_issuer} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🏛️" label="NIF" field="nif" value={privateData?.nif} editing={editing} draft={draft} onChange={ud} />
                    </div>

                    {/* Document upload + AI analysis */}
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Ficheiro do Documento</h3>
                    <div className="rounded-xl border p-4 space-y-3">
                      {(localDocUrl || privateData?.id_doc_file_url) ? (
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Documento carregado</p>
                            <p className="text-xs text-muted-foreground truncate">{(localDocUrl || privateData.id_doc_file_url).split('/').pop()}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setAnalyzingDoc(true)
                                fetch(`/api/consultants/${id}/analyze-document`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ document_url: (localDocUrl || privateData.id_doc_file_url) }),
                                })
                                  .then(async r => { if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Erro') } return r.json() })
                                  .then(result => { setAnalysisResult(result); toast.success('Documento analisado') })
                                  .catch((e) => toast.error(e.message || 'Erro ao analisar'))
                                  .finally(() => setAnalyzingDoc(false))
                              }}
                              disabled={analyzingDoc}
                              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                            >
                              {analyzingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Analisar
                            </button>
                            <a href={(localDocUrl || privateData.id_doc_file_url)} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={async () => {
                                await fetch(`/api/consultants/${id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ private_data: { id_doc_file_url: null } }),
                                })
                                setLocalDocUrl(null)
                                toast.success('Documento removido')
                              }}
                              className="h-8 w-8 rounded-full border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => docFileRef.current?.click()}
                          disabled={uploadingDoc}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 py-6 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                        >
                          {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {uploadingDoc ? 'A carregar...' : 'Carregar documento de identificação'}
                        </button>
                      )}
                      <input ref={docFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocUpload} />
                    </div>

                  </div>
                )}

                {/* ── Morada ── */}
                {privadoSubTab === 'morada' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Morada</h3>
                    <div className="rounded-xl border p-4 space-y-3">
                      <EmojiField emoji="📍" label="Morada" field="address_private" value={privateData?.address_private} editing={editing} draft={draft} onChange={ud} fullWidth />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EmojiField emoji="📮" label="Código Postal" field="postal_code" value={privateData?.postal_code} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🏘️" label="Localidade" field="city" value={privateData?.city} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🗺️" label="Distrito" field="district" value={privateData?.district} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🏛️" label="Concelho" field="concelho" value={privateData?.concelho} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="📌" label="Zona" field="zone" value={privateData?.zone} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="🌐" label="País" field="country" value={privateData?.country} editing={editing} draft={draft} onChange={ud} />
                    </div>
                  </div>
                )}

                {/* ── Empresa ── */}
                {privadoSubTab === 'empresa' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</h3>
                    <div className="rounded-xl border p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>🏢</span>
                        <span className="text-sm font-medium">Tem Empresa</span>
                      </div>
                      {editing ? (
                        <Switch checked={draft.has_company || false} onCheckedChange={(v) => ud('has_company', String(v))} />
                      ) : (
                        <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', privateData?.has_company ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground')}>
                          {privateData?.has_company ? 'Sim' : 'Não'}
                        </span>
                      )}
                    </div>

                    {(privateData?.has_company || draft.has_company === 'true') ? (
                      <>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados da Empresa</h4>
                        <div className="rounded-xl border p-4 space-y-3">
                          <EmojiField emoji="🏢" label="Nome da Empresa" field="company_name" value={privateData?.company_name} editing={editing} draft={draft} onChange={ud} fullWidth />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <EmojiField emoji="📞" label="Telefone" field="company_phone" value={privateData?.company_phone} editing={editing} draft={draft} onChange={ud} />
                          <EmojiField emoji="✉️" label="Email" field="company_email" value={privateData?.company_email} editing={editing} draft={draft} onChange={ud} />
                        </div>
                        <div className="rounded-xl border p-4 space-y-3">
                          <EmojiField emoji="📍" label="Morada da Empresa" field="company_address" value={privateData?.company_address} editing={editing} draft={draft} onChange={ud} fullWidth />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <EmojiField emoji="🏢" label="NIPC" field="company_nipc" value={privateData?.company_nipc} editing={editing} draft={draft} onChange={ud} />
                          <EmojiField emoji="🌐" label="Website" field="company_website" value={privateData?.company_website} editing={editing} draft={draft} onChange={ud} />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">Sem empresa — dados fiscais pessoais:</p>
                        <div className="grid grid-cols-2 gap-3">
                          <EmojiField emoji="🏛️" label="NIF" field="nif" value={privateData?.nif} editing={false} draft={draft} onChange={ud} />
                          <EmojiField emoji="📍" label="Morada" field="address_private" value={privateData?.address_private} editing={false} draft={draft} onChange={ud} />
                        </div>
                      </>
                    )}

                    <Separator />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados Bancários</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <EmojiField emoji="🏦" label="IBAN" field="iban" value={privateData?.iban} editing={editing} draft={draft} onChange={ud} fullWidth />
                    </div>
                  </div>
                )}

                {/* ── Dados Contratuais ── */}
                {privadoSubTab === 'contrato' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Contract file upload */}
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ficheiro do Contrato</h3>
                    <div className="rounded-xl border p-3">
                      {(localContractUrl || privateData?.contract_file_url) ? (
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Contrato carregado</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setAnalyzingContract(true)
                                fetch(`/api/consultants/${id}/analyze-contract`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ document_url: (localContractUrl || privateData.contract_file_url) }),
                                })
                                  .then(async r => { if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Erro') } return r.json() })
                                  .then(result => { setContractAnalysis(result); toast.success('Contrato analisado') })
                                  .catch((e) => toast.error(e.message || 'Erro ao analisar'))
                                  .finally(() => setAnalyzingContract(false))
                              }}
                              disabled={analyzingContract}
                              className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-1 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                            >
                              {analyzingContract ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Analisar
                            </button>
                            <a href={(localContractUrl || privateData.contract_file_url)} target="_blank" rel="noopener noreferrer" className="h-7 w-7 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <button onClick={async () => {
                              await fetch(`/api/consultants/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ private_data: { contract_file_url: null } }) })
                              setLocalContractUrl(null); toast.success('Contrato removido')
                            }} className="h-7 w-7 rounded-full border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => contractFileRef.current?.click()} disabled={uploadingContract} className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 py-4 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors">
                          {uploadingContract ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {uploadingContract ? 'A carregar...' : 'Carregar contrato'}
                        </button>
                      )}
                      <input ref={contractFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleContractUpload} />
                    </div>

                    {/* Contract data fields */}
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">Dados Contratuais</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <EmojiField emoji="📋" label="Tipo de Contrato" field="contract_type" value={privateData?.contract_type} editing={editing} draft={draft} onChange={ud} />
                      <EmojiField emoji="📅" label="Data de Contratação" field="hiring_date" value={privateData?.hiring_date ? formatDate(privateData.hiring_date) : null} editing={editing} draft={draft} onChange={ud} type="date" />
                      <EmojiField emoji="🗓️" label="Início Contrato" field="contract_start_date" value={privateData?.contract_start_date ? formatDate(privateData.contract_start_date) : null} editing={editing} draft={draft} onChange={ud} type="date" />
                      {editing ? (
                        <div className="rounded-lg border px-3 py-2 space-y-1.5">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><span className="text-xs">🏁</span> Fim Contrato</p>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => ud('contract_end_date', draft.contract_end_date === 'sem-termo' ? '' : 'sem-termo')} className={cn('text-[10px] font-medium rounded-full px-2.5 py-0.5 border transition-colors', draft.contract_end_date === 'sem-termo' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted')}>
                              Sem termo
                            </button>
                            {draft.contract_end_date !== 'sem-termo' && (
                              <Input type="date" className="h-6 border-0 p-0 shadow-none focus-visible:ring-0 text-xs font-medium flex-1" value={draft.contract_end_date || ''} onChange={(e) => ud('contract_end_date', e.target.value)} />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border px-3 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><span className="text-xs">🏁</span> Fim Contrato</p>
                          <p className="text-xs font-medium mt-0.5">
                            {privateData?.contract_end_date === 'sem-termo' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-500/15 rounded-full px-2 py-0.5 text-[10px] font-medium">Sem termo</span>
                            ) : privateData?.contract_end_date ? formatDate(privateData.contract_end_date) : '—'}
                          </p>
                        </div>
                      )}
                    </div>

                    <Separator />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remuneração</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <EmojiField emoji="💰" label="Salário Mensal" field="monthly_salary" value={privateData?.monthly_salary ? formatCurrency(privateData.monthly_salary) : null} editing={editing} draft={draft} onChange={ud} type="number" />
                      <EmojiField emoji="📊" label="Taxa de Comissão" field="commission_rate" value={privateData?.commission_rate != null ? `${privateData.commission_rate}%` : null} editing={editing} draft={draft} onChange={ud} type="number" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ IMÓVEIS ═══════ */}
          {activeTab === 'imoveis' && (
            <div>
              {propertiesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : properties.length > 0 ? (
                <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Título</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Ref.</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Cidade</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Preço</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties.map((prop: any) => (
                        <TableRow key={prop.id} className="cursor-pointer transition-colors duration-200 hover:bg-muted/30" onClick={() => router.push(`/dashboard/imoveis/${prop.id}`)}>
                          <TableCell className="text-sm font-medium max-w-[200px] truncate">{prop.title}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{prop.external_ref || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5 bg-muted/50">
                              {PROPERTY_TYPES[prop.property_type as keyof typeof PROPERTY_TYPES] || prop.property_type || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{prop.city || '—'}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{formatCurrency(prop.listing_price)}</TableCell>
                          <TableCell><StatusBadge status={prop.status || 'pending_approval'} type="property" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-8 text-center text-sm text-muted-foreground">
                  Nenhum imóvel atribuído a este consultor.
                </div>
              )}
            </div>
          )}

          {/* ═══════ COMISSÕES ═══════ */}
          {activeTab === 'comissoes' && (
            <div className="space-y-5">
              {privateData?.commission_rate != null && (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxa de Comissão Base</p>
                  <p className="text-3xl font-bold mt-1">{privateData.commission_rate}%</p>
                </div>
              )}
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-8 text-center text-sm text-muted-foreground">
                O cálculo detalhado de comissões será implementado no módulo de comissões.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Settings Dialog ─── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" />Definições</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="settings-active" className="text-sm">Ativo</Label>
              <Switch id="settings-active" checked={!!consultant.is_active} onCheckedChange={() => { handleToggleActive(); }} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="settings-website" className="text-sm">Mostrar no Website</Label>
              <Switch id="settings-website" checked={!!consultant.display_website} onCheckedChange={() => { handleToggleWebsite(); }} />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm">Função</Label>
              <Select value={settingsRoleId} onValueChange={(v) => { setSettingsRoleId(v); saveSettings(v) }}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Seleccionar função..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── ID Document Analysis Dialog ─── */}
      <Dialog open={!!analysisResult} onOpenChange={(open) => { if (!open) setAnalysisResult(null) }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Dados Extraídos — Documento</DialogTitle>
          </DialogHeader>
          {analysisResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries({
                  tipo_documento: 'Tipo', numero_documento: 'Número', full_name: 'Nome',
                  nif: 'NIF', data_nascimento: 'Nascimento', data_validade_documento: 'Validade',
                  nacionalidade: 'Nacionalidade', pais_emissor: 'Emissor', genero: 'Género',
                }).map(([key, label]) => (
                  analysisResult[key] != null && (
                    <div key={key} className="rounded-lg bg-muted/40 border px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="text-xs font-medium mt-0.5">{String(analysisResult[key])}</p>
                    </div>
                  )
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setAnalysisResult(null)}>Descartar</Button>
                <Button size="sm" className="rounded-full text-xs gap-1" onClick={() => { applyAnalysis(); setAnalysisResult(null) }}>
                  <Check className="h-3 w-3" />Aplicar Dados
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Contract Analysis Dialog ─── */}
      <Dialog open={!!contractAnalysis} onOpenChange={(open) => { if (!open) setContractAnalysis(null) }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Dados Extraídos — Contrato</DialogTitle>
          </DialogHeader>
          {contractAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries({
                  contract_type: 'Tipo Contrato', hiring_date: 'Contratação', contract_start_date: 'Início',
                  contract_end_date: 'Fim', monthly_salary: 'Salário', commission_rate: 'Comissão',
                  full_name: 'Nome', nif: 'NIF', iban: 'IBAN',
                }).map(([key, label]) => (
                  contractAnalysis[key] != null && (
                    <div key={key} className="rounded-lg bg-muted/40 border px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="text-xs font-medium mt-0.5">{String(contractAnalysis[key])}</p>
                    </div>
                  )
                ))}
                {contractAnalysis.notes && (
                  <div className="col-span-full rounded-lg bg-muted/40 border px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Notas</p>
                    <p className="text-xs font-medium mt-0.5">{contractAnalysis.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setContractAnalysis(null)}>Descartar</Button>
                <Button size="sm" className="rounded-full text-xs gap-1" onClick={() => { applyContractAnalysis(); setContractAnalysis(null) }}>
                  <Check className="h-3 w-3" />Aplicar Dados
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Photo Cropper ─── */}
      {cropperSrc && (
        <ConsultantPhotoCropper
          imageSrc={cropperSrc}
          open={cropperOpen}
          onOpenChange={(open) => {
            setCropperOpen(open)
            if (!open) { URL.revokeObjectURL(cropperSrc); setCropperSrc(null) }
          }}
          onCropDone={handleCroppedPhoto}
          consultantName={consultant.commercial_name}
        />
      )}
    </div>
  )
}

function DetailRow({ label, value, icon }: { label: string; value: string | number | null | undefined; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}

function EmojiField({
  emoji, label, field, value, editing, draft, onChange, type = 'text', fullWidth,
}: {
  emoji: string; label: string; field: string; value: string | number | null | undefined
  editing: boolean; draft: Record<string, any>; onChange: (field: string, value: string) => void
  type?: string; fullWidth?: boolean
}) {
  return (
    <div className={cn('rounded-lg border px-3 py-2', fullWidth && 'col-span-full')}>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
        <span className="text-xs">{emoji}</span> {label}
      </p>
      {editing ? (
        <Input
          type={type}
          className="h-6 mt-0.5 border-0 p-0 shadow-none focus-visible:ring-0 text-xs font-medium"
          value={draft[field] || ''}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder="—"
        />
      ) : (
        <p className="text-xs font-medium mt-0.5">{value || '—'}</p>
      )}
    </div>
  )
}

function EditableRow({
  label, field, value, editing, draft, onChange, icon, type = 'text', suffix,
}: {
  label: string; field: string; value: string | number | null | undefined
  editing: boolean; draft: Record<string, any>; onChange: (field: string, value: string) => void
  icon?: React.ReactNode; type?: string; suffix?: string
}) {
  if (!editing) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
        <span className="font-medium">{value || '—'}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">{icon}{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type={type}
          className="h-7 rounded-lg text-xs text-right w-[180px]"
          value={draft[field] || ''}
          onChange={(e) => onChange(field, e.target.value)}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}
