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
  ArrowLeft, Pencil, Phone, Mail, Instagram, Linkedin,
  Building2, User, Shield, Briefcase, Upload, Loader2,
  MessageSquare, Check, X,
} from 'lucide-react'
import { formatCurrency, formatDate, PROPERTY_TYPES } from '@/lib/constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  { key: 'privado' as const, label: 'Dados Privados', icon: Shield },
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

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [draft, setDraft] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch('/api/libraries/roles').then(r => r.ok ? r.json() : []).then(d => setRoles(d || [])).catch(() => {})
  }, [])

  // Populate draft when entering edit mode
  const enterEdit = () => {
    if (!consultant) return
    const profile = consultant.dev_consultant_profiles
    const priv = consultant.dev_consultant_private_data
    setDraft({
      professional_email: consultant.professional_email || '',
      phone_commercial: profile?.phone_commercial || '',
      instagram_handle: profile?.instagram_handle || '',
      linkedin_url: profile?.linkedin_url || '',
      bio: profile?.bio || '',
      full_name: priv?.full_name || '',
      nif: priv?.nif || '',
      iban: priv?.iban || '',
      address_private: priv?.address_private || '',
      monthly_salary: priv?.monthly_salary != null ? String(priv.monthly_salary) : '',
      commission_rate: priv?.commission_rate != null ? String(priv.commission_rate) : '',
      hiring_date: priv?.hiring_date || '',
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
          },
          private_data: {
            full_name: draft.full_name || null,
            nif: draft.nif || null,
            iban: draft.iban || null,
            address_private: draft.address_private || null,
            monthly_salary: draft.monthly_salary ? Number(draft.monthly_salary) : null,
            commission_rate: draft.commission_rate ? Number(draft.commission_rate) : null,
            hiring_date: draft.hiring_date || null,
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/consultants/${id}/photo`, { method: 'POST', body: formData })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro') }
      toast.success('Foto actualizada')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
  const privateData = consultant.dev_consultant_private_data
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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{consultant.commercial_name}</h2>
              {consultant.is_active ? (
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
              ) : (
                <Badge variant="outline" className="text-white/60 border-white/20 text-[10px]">Inactivo</Badge>
              )}
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

                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />Configuração
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="active-toggle" className="text-sm">Activo</Label>
                      <Switch id="active-toggle" checked={!!consultant.is_active} onCheckedChange={handleToggleActive} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="website-toggle" className="text-sm">Mostrar no Website</Label>
                      <Switch id="website-toggle" checked={!!consultant.display_website} onCheckedChange={handleToggleWebsite} />
                    </div>
                    <Separator />
                    <DetailRow label="Função" value={roleName} />
                    <DetailRow label="Imóveis" value={String(consultant.properties_count || 0)} />
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

              {/* Specializations & Languages */}
              {((profile?.specializations && profile.specializations.length > 0) ||
                (profile?.languages && profile.languages.length > 0)) && (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Competências</h3>
                  {profile?.specializations && profile.specializations.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Especializações</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.specializations.map((spec) => (
                          <Badge key={spec} variant="secondary" className="rounded-full text-[11px] bg-muted/50">{spec}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile?.languages && profile.languages.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Idiomas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.languages.map((lang) => (
                          <Badge key={lang} variant="outline" className="rounded-full text-[11px]">{lang}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════ DADOS PRIVADOS ═══════ */}
          {activeTab === 'privado' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />Dados Pessoais
                  </h3>
                  <div className="space-y-3">
                    <EditableRow label="Nome Completo" field="full_name" value={privateData?.full_name} editing={editing} draft={draft} onChange={ud} />
                    <EditableRow label="NIF" field="nif" value={privateData?.nif} editing={editing} draft={draft} onChange={ud} />
                    <EditableRow label="IBAN" field="iban" value={privateData?.iban} editing={editing} draft={draft} onChange={ud} />
                    <EditableRow label="Morada" field="address_private" value={privateData?.address_private} editing={editing} draft={draft} onChange={ud} />
                  </div>
                </div>

                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5" />Dados Contratuais
                  </h3>
                  <div className="space-y-3">
                    <EditableRow label="Salário Mensal" field="monthly_salary" value={privateData?.monthly_salary ? formatCurrency(privateData.monthly_salary) : null} editing={editing} draft={draft} onChange={ud} type="number" />
                    <EditableRow label="Taxa de Comissão" field="commission_rate" value={privateData?.commission_rate != null ? `${privateData.commission_rate}%` : null} editing={editing} draft={draft} onChange={ud} type="number" suffix="%" />
                    <EditableRow label="Data de Contratação" field="hiring_date" value={privateData?.hiring_date ? formatDate(privateData.hiring_date) : null} editing={editing} draft={draft} onChange={ud} type="date" />
                  </div>
                </div>
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
