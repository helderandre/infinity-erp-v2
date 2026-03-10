'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useConsultant } from '@/hooks/use-consultant'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  Globe,
  Instagram,
  Linkedin,
  Building2,
  User,
  Shield,
  Briefcase,
  Calendar,
  Upload,
  Loader2,
} from 'lucide-react'
import { formatCurrency, formatDate, PROPERTY_TYPES } from '@/lib/constants'
import { toast } from 'sonner'

export default function ConsultorDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { consultant, isLoading, refetch } = useConsultant(id)
  const [activeTab, setActiveTab] = useState('perfil')
  const [properties, setProperties] = useState<any[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load properties when tab changes to "imoveis"
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { is_active: !consultant.is_active } }),
      })
      if (!res.ok) throw new Error()
      toast.success(consultant.is_active ? 'Consultor desactivado' : 'Consultor activado')
      refetch()
    } catch {
      toast.error('Erro ao actualizar estado')
    }
  }

  const handleToggleWebsite = async () => {
    if (!consultant) return
    try {
      const res = await fetch(`/api/consultants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { display_website: !consultant.display_website } }),
      })
      if (!res.ok) throw new Error()
      toast.success(
        consultant.display_website ? 'Removido do website' : 'Visível no website'
      )
      refetch()
    } catch {
      toast.error('Erro ao actualizar')
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/consultants/${id}/photo`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao fazer upload')
      }
      toast.success('Foto actualizada com sucesso')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload da foto')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!consultant) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold">Consultor não encontrado</h2>
          <p className="text-muted-foreground">O consultor que procura não existe.</p>
        </div>
      </div>
    )
  }

  const profile = consultant.dev_consultant_profiles
  const privateData = consultant.dev_consultant_private_data
  const roleName = consultant.user_roles?.[0]?.roles?.name || null
  const initials = consultant.commercial_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/consultores')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.profile_photo_url || undefined} />
                <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Upload className="h-5 w-5 text-white" />
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
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{consultant.commercial_name}</h1>
                <Badge
                  variant={consultant.is_active ? 'default' : 'outline'}
                  className={
                    consultant.is_active
                      ? 'bg-emerald-500/15 text-emerald-600 border-0'
                      : 'text-muted-foreground'
                  }
                >
                  {consultant.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {roleName || 'Sem função atribuída'}
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/dashboard/consultores/${id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="perfil">Perfil Público</TabsTrigger>
          <TabsTrigger value="privado">Dados Privados</TabsTrigger>
          <TabsTrigger value="imoveis">Imóveis</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>

        {/* Tab: Perfil Público */}
        <TabsContent value="perfil" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Informações de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Email" value={consultant.professional_email} />
                <DetailRow label="Telemóvel" value={profile?.phone_commercial} />
                {profile?.instagram_handle && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Instagram className="h-3.5 w-3.5" />
                      Instagram
                    </span>
                    <span className="font-medium">{profile.instagram_handle}</span>
                  </div>
                )}
                {profile?.linkedin_url && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Linkedin className="h-3.5 w-3.5" />
                      LinkedIn
                    </span>
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline truncate max-w-[200px]"
                    >
                      Ver perfil
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Estado e Configuração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="active-toggle" className="text-sm">Activo</Label>
                  <Switch
                    id="active-toggle"
                    checked={!!consultant.is_active}
                    onCheckedChange={handleToggleActive}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="website-toggle" className="text-sm">Mostrar no Website</Label>
                  <Switch
                    id="website-toggle"
                    checked={!!consultant.display_website}
                    onCheckedChange={handleToggleWebsite}
                  />
                </div>
                <DetailRow label="Função" value={roleName} />
                <DetailRow label="Registado em" value={formatDate(consultant.created_at)} />
                <DetailRow
                  label="Imóveis Atribuídos"
                  value={String(consultant.properties_count || 0)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Biografia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Specializations & Languages */}
          {((profile?.specializations && profile.specializations.length > 0) ||
            (profile?.languages && profile.languages.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Competências</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile?.specializations && profile.specializations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Especializações</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.specializations.map((spec) => (
                        <Badge key={spec} variant="secondary" className="text-xs">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {profile?.languages && profile.languages.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Idiomas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.languages.map((lang) => (
                        <Badge key={lang} variant="outline" className="text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Dados Privados */}
        <TabsContent value="privado" className="space-y-6">
          {privateData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DetailRow label="Nome Completo" value={privateData.full_name} />
                  <DetailRow label="NIF" value={privateData.nif} />
                  <DetailRow label="IBAN" value={privateData.iban} />
                  <DetailRow label="Morada" value={privateData.address_private} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Dados Contratuais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DetailRow
                    label="Salário Mensal"
                    value={
                      privateData.monthly_salary
                        ? formatCurrency(privateData.monthly_salary)
                        : null
                    }
                  />
                  <DetailRow
                    label="Taxa de Comissão"
                    value={
                      privateData.commission_rate != null
                        ? `${privateData.commission_rate}%`
                        : null
                    }
                  />
                  <DetailRow
                    label="Data de Contratação"
                    value={privateData.hiring_date ? formatDate(privateData.hiring_date) : null}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Sem dados privados registados.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Imóveis */}
        <TabsContent value="imoveis">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Imóveis Atribuídos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {propertiesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : properties.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Ref.</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((prop: any) => (
                      <TableRow
                        key={prop.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/imoveis/${prop.id}`)}
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {prop.title}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {prop.external_ref || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {PROPERTY_TYPES[prop.property_type as keyof typeof PROPERTY_TYPES] ||
                            prop.property_type ||
                            '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{prop.city || '—'}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(prop.listing_price)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={prop.status || 'pending_approval'} type="property" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum imóvel atribuído a este consultor.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Comissões */}
        <TabsContent value="comissoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Comissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {privateData?.commission_rate != null && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Taxa de Comissão Base</p>
                    <p className="text-2xl font-bold text-primary">{privateData.commission_rate}%</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center py-4">
                  O cálculo detalhado de comissões será implementado no módulo de comissões.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}
