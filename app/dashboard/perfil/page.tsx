// @ts-nocheck
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from '@/hooks/use-user'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Camera, Eye, EyeOff, Globe, Instagram, Linkedin, Loader2,
  Lock, MapPin, Save, User, Users, CalendarClock,
} from 'lucide-react'
import type { ConsultantDetail } from '@/types/consultant'
import { ConsultantAvailabilityPanel } from '@/components/booking/consultant-availability-panel'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'geral' as const, label: 'Geral', icon: User },
  { key: 'pessoal' as const, label: 'Pessoal', icon: Users },
  { key: 'morada' as const, label: 'Morada', icon: MapPin },
  { key: 'social' as const, label: 'Redes', icon: Globe },
  { key: 'disponibilidade' as const, label: 'Agenda', icon: CalendarClock },
  { key: 'seguranca' as const, label: 'Segurança', icon: Lock },
]

type TabKey = (typeof TABS)[number]['key']

// ─── Schemas ────────────────────────────────────────────────

const generalSchema = z.object({
  commercial_name: z.string().min(2, 'Nome comercial é obrigatório').max(200),
  full_name: z.string().max(200).optional().nullable(),
  phone_commercial: z.string().max(20).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
})

const personalSchema = z.object({
  gender: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  nif: z.string().max(20).optional().nullable(),
})

const addressSchema = z.object({
  address_private: z.string().max(500).optional().nullable(),
  postal_code: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  concelho: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
})

const socialSchema = z.object({
  instagram_handle: z.string().max(100).optional().nullable(),
  linkedin_url: z.string().url('URL inválido').or(z.literal('')).optional().nullable(),
  display_website: z.boolean().optional(),
})

const companySchema = z.object({
  has_company: z.boolean().optional().nullable(),
  company_name: z.string().optional().nullable(),
  company_phone: z.string().optional().nullable(),
  company_email: z.string().optional().nullable(),
  company_address: z.string().optional().nullable(),
  company_nipc: z.string().optional().nullable(),
  company_website: z.string().optional().nullable(),
})

const passwordSchema = z.object({
  new_password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string().min(8, 'Mínimo 8 caracteres'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'As palavras-passe não coincidem',
  path: ['confirm_password'],
})

type GeneralForm = z.infer<typeof generalSchema>
type PersonalForm = z.infer<typeof personalSchema>
type AddressForm = z.infer<typeof addressSchema>
type SocialForm = z.infer<typeof socialSchema>
type CompanyForm = z.infer<typeof companySchema>
type PasswordForm = z.infer<typeof passwordSchema>

// ─── Page ───────────────────────────────────────────────────

export default function PerfilPage() {
  const { user } = useUser()
  const [profile, setProfile] = useState<ConsultantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('geral')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/perfil')
      if (!res.ok) throw new Error('Erro ao carregar perfil')
      const data = await res.json()
      setProfile(data)
    } catch {
      toast.error('Erro ao carregar dados do perfil')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const photoUrl = profile?.dev_consultant_profiles?.profile_photo_url
  const userInitials = (profile?.commercial_name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/perfil/photo', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao enviar foto')
      }
      toast.success('Foto actualizada com sucesso')
      fetchProfile()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar foto')
    } finally {
      setPhotoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) return <ProfileSkeleton />

  const p = profile?.dev_consultant_profiles
  const pd = profile?.dev_consultant_private_data
  const roleName = profile?.user_roles?.[0]?.roles?.name

  return (
    <div className="max-w-3xl space-y-3 sm:space-y-6">
      {/* Header card with photo — mobile: centered avatar; desktop: hero with square flush left */}
      {/* Mobile layout (default) */}
      <Card className="sm:hidden">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="relative group shrink-0">
            <Avatar className="h-20 w-20 rounded-2xl">
              {photoUrl && <AvatarImage src={photoUrl} alt={profile?.commercial_name || ''} />}
              <AvatarFallback className="rounded-2xl bg-neutral-900 text-white text-2xl font-bold dark:bg-white dark:text-neutral-900">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {photoUploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          <div className="flex-1 min-w-0 w-full">
            <h1 className="text-xl font-bold truncate">{profile?.commercial_name || 'Utilizador'}</h1>
            <p className="text-sm text-muted-foreground truncate">{user?.auth_user?.email}</p>
            {roleName && (
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
                {roleName}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Desktop layout (sm+): hero with square photo flush with card's left edge */}
      <Card className="hidden sm:block overflow-hidden p-0 rounded-2xl">
        <div className="flex items-stretch">
          <div className="w-32 shrink-0 relative bg-muted group">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={profile?.commercial_name || ''}
                className="absolute inset-0 h-full w-full object-cover [object-position:center_10%]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 dark:bg-white">
                <span className="text-2xl font-bold text-white dark:text-neutral-900">
                  {userInitials}
                </span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {photoUploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          <div className="flex-1 min-w-0 p-6 flex flex-col justify-center">
            <h1 className="text-xl font-bold tracking-tight truncate">
              {profile?.commercial_name || 'Utilizador'}
            </h1>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {user?.auth_user?.email}
            </p>
            {roleName && (
              <span className="mt-2 inline-flex self-start items-center rounded-full bg-muted/60 border border-border/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {roleName}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Pill Navigation */}
      <div className="flex justify-center sm:justify-start">
        <div className="inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm max-w-full overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                title={tab.label}
                aria-label={tab.label}
                className={cn(
                  'inline-flex items-center justify-center gap-2 h-9 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-300',
                  isActive ? 'px-4 sm:px-5' : 'w-9 sm:w-auto sm:px-5',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(isActive ? 'inline' : 'hidden sm:inline')}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div key={activeTab} className="animate-in fade-in duration-300">
        {activeTab === 'geral' && (
          <GeneralTab
            defaultValues={{
              commercial_name: profile?.commercial_name || '',
              full_name: pd?.full_name || '',
              phone_commercial: p?.phone_commercial || '',
              bio: p?.bio || '',
            }}
            onSaved={fetchProfile}
          />
        )}

        {activeTab === 'pessoal' && (
          <PersonalTab
            defaultValues={{
              gender: pd?.gender || '',
              birth_date: pd?.birth_date || '',
              nationality: pd?.nationality || '',
              nif: pd?.nif || '',
            }}
            hasCompany={pd?.has_company || false}
            companyDefaults={{
              has_company: pd?.has_company || false,
              company_name: pd?.company_name || '',
              company_phone: pd?.company_phone || '',
              company_email: pd?.company_email || '',
              company_address: pd?.company_address || '',
              company_nipc: pd?.company_nipc || '',
              company_website: pd?.company_website || '',
            }}
            onSaved={fetchProfile}
          />
        )}

        {activeTab === 'morada' && (
          <AddressTab
            defaultValues={{
              address_private: pd?.address_private || '',
              postal_code: pd?.postal_code || '',
              city: pd?.city || '',
              district: pd?.district || '',
              concelho: pd?.concelho || '',
              country: pd?.country || 'Portugal',
            }}
            onSaved={fetchProfile}
          />
        )}

        {activeTab === 'social' && (
          <SocialTab
            defaultValues={{
              instagram_handle: p?.instagram_handle || '',
              linkedin_url: p?.linkedin_url || '',
              display_website: profile?.display_website || false,
            }}
            onSaved={fetchProfile}
          />
        )}

        {activeTab === 'disponibilidade' && <ConsultantAvailabilityPanel />}

        {activeTab === 'seguranca' && <SecurityTab />}
      </div>
    </div>
  )
}

// ─── Tab: Geral ─────────────────────────────────────────────

function GeneralTab({ defaultValues, onSaved }: { defaultValues: GeneralForm; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    defaultValues,
  })

  const onSubmit = async (data: GeneralForm) => {
    setSaving(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { commercial_name: data.commercial_name },
          profile: { phone_commercial: data.phone_commercial || null, bio: data.bio || null },
          private_data: { full_name: data.full_name || null },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dados guardados com sucesso')
      onSaved()
    } catch {
      toast.error('Erro ao guardar dados')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados Gerais</CardTitle>
        <CardDescription>Informacao basica do seu perfil.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="commercial_name">Nome Comercial *</Label>
              <Input id="commercial_name" {...register('commercial_name')} />
              {errors.commercial_name && (
                <p className="text-xs text-destructive">{errors.commercial_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input id="full_name" {...register('full_name')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_commercial">Telemovel Profissional</Label>
            <Input id="phone_commercial" {...register('phone_commercial')} placeholder="+351 9xx xxx xxx" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio / Descricao</Label>
            <Textarea id="bio" {...register('bio')} rows={4} placeholder="Uma breve descricao sobre si..." />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Pessoal ───────────────────────────────────────────

function PersonalTab({
  defaultValues,
  hasCompany,
  companyDefaults,
  onSaved,
}: {
  defaultValues: PersonalForm
  hasCompany: boolean
  companyDefaults: CompanyForm
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [showCompany, setShowCompany] = useState(hasCompany)

  const personal = useForm<PersonalForm>({
    resolver: zodResolver(personalSchema),
    defaultValues,
  })

  const company = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: companyDefaults,
  })

  const onSubmit = async () => {
    const personalValid = await personal.trigger()
    if (!personalValid) return

    setSaving(true)
    try {
      const pData = personal.getValues()
      const cData = showCompany ? company.getValues() : { has_company: false }

      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          private_data: {
            ...pData,
            ...cData,
            has_company: showCompany,
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dados pessoais guardados')
      onSaved()
    } catch {
      toast.error('Erro ao guardar dados pessoais')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dados Pessoais</CardTitle>
          <CardDescription>Informacao pessoal e identificacao.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Genero</Label>
              <Select
                value={personal.watch('gender') || ''}
                onValueChange={(v) => personal.setValue('gender', v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input id="birth_date" type="date" {...personal.register('birth_date')} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nationality">Nacionalidade</Label>
              <Input id="nationality" {...personal.register('nationality')} placeholder="Portuguesa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input id="nif" {...personal.register('nif')} placeholder="123456789" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>Empresa</CardTitle>
              <CardDescription>Dados da empresa (se aplicavel).</CardDescription>
            </div>
            <Switch checked={showCompany} onCheckedChange={setShowCompany} />
          </div>
        </CardHeader>
        {showCompany && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da Empresa</Label>
                <Input id="company_name" {...company.register('company_name')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_nipc">NIPC</Label>
                <Input id="company_nipc" {...company.register('company_nipc')} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_phone">Telefone</Label>
                <Input id="company_phone" {...company.register('company_phone')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">Email</Label>
                <Input id="company_email" type="email" {...company.register('company_email')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_address">Morada da Empresa</Label>
              <Input id="company_address" {...company.register('company_address')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_website">Website</Label>
              <Input id="company_website" {...company.register('company_website')} placeholder="https://..." />
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Morada ────────────────────────────────────────────

function AddressTab({ defaultValues, onSaved }: { defaultValues: AddressForm; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues,
  })

  const onSubmit = async (data: AddressForm) => {
    setSaving(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ private_data: data }),
      })
      if (!res.ok) throw new Error()
      toast.success('Morada guardada com sucesso')
      onSaved()
    } catch {
      toast.error('Erro ao guardar morada')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Morada</CardTitle>
        <CardDescription>A sua morada pessoal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_private">Morada</Label>
            <Input id="address_private" {...register('address_private')} placeholder="Rua, numero, andar..." />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="postal_code">Codigo Postal</Label>
              <Input id="postal_code" {...register('postal_code')} placeholder="1000-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" {...register('city')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">Distrito</Label>
              <Input id="district" {...register('district')} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="concelho">Concelho</Label>
              <Input id="concelho" {...register('concelho')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Pais</Label>
              <Input id="country" {...register('country')} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Redes Sociais ─────────────────────────────────────

function SocialTab({ defaultValues, onSaved }: { defaultValues: SocialForm; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, watch, setValue } = useForm<SocialForm>({
    resolver: zodResolver(socialSchema),
    defaultValues,
  })

  const onSubmit = async (data: SocialForm) => {
    setSaving(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { display_website: data.display_website },
          profile: {
            instagram_handle: data.instagram_handle || null,
            linkedin_url: data.linkedin_url || null,
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Redes sociais guardadas')
      onSaved()
    } catch {
      toast.error('Erro ao guardar redes sociais')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redes Sociais e Visibilidade</CardTitle>
        <CardDescription>Links das suas redes sociais e preferencias de visibilidade.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instagram_handle">Instagram</Label>
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="instagram_handle"
                {...register('instagram_handle')}
                className="pl-10"
                placeholder="@utilizador"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn</Label>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="linkedin_url"
                {...register('linkedin_url')}
                className="pl-10"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label>Visivel no Website</Label>
              <p className="text-xs text-muted-foreground">Mostrar o seu perfil no website publico da agencia.</p>
            </div>
            <Switch
              checked={watch('display_website') || false}
              onCheckedChange={(v) => setValue('display_website', v)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Seguranca ─────────────────────────────────────────

function SecurityTab() {
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors }, reset } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = async (data: PasswordForm) => {
    setSaving(true)
    try {
      const res = await fetch('/api/perfil/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: data.new_password }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao alterar palavra-passe')
      }
      toast.success('Palavra-passe alterada com sucesso')
      reset()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar palavra-passe')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguranca</CardTitle>
        <CardDescription>Altere a sua palavra-passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-md">
          <div className="space-y-2">
            <Label htmlFor="new_password">Nova Palavra-passe</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showPassword ? 'text' : 'password'}
                {...register('new_password')}
                placeholder="Minimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.new_password && (
              <p className="text-xs text-destructive">{errors.new_password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmar Palavra-passe</Label>
            <Input
              id="confirm_password"
              type={showPassword ? 'text' : 'password'}
              {...register('confirm_password')}
              placeholder="Repita a palavra-passe"
            />
            {errors.confirm_password && (
              <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Alterar Palavra-passe
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton ───────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="-mx-2 sm:mx-auto max-w-3xl space-y-3 sm:space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:items-center sm:gap-6">
          <Skeleton className="h-20 w-20 rounded-2xl sm:h-24 sm:w-24" />
          <div className="space-y-2 flex-1 w-full">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-20 w-full rounded-lg md:h-10" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </CardContent>
      </Card>
    </div>
  )
}
