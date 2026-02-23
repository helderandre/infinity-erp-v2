'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Briefcase,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/constants'
import {
  LEAD_ESTADOS,
  LEAD_TEMPERATURAS,
  LEAD_ORIGENS,
  LEAD_FORMAS_CONTACTO,
  LEAD_MEIOS_CONTACTO,
  LEAD_GENEROS,
  LEAD_TIPOS_DOCUMENTO,
  NEGOCIO_TIPOS,
} from '@/lib/constants'
import type { LeadWithAgent, LeadAttachment } from '@/types/lead'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [lead, setLead] = useState<LeadWithAgent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])

  // Negocios
  const [negocios, setNegocios] = useState<Record<string, unknown>[]>([])
  const [negociosLoading, setNegociosLoading] = useState(false)
  const [newNegocioOpen, setNewNegocioOpen] = useState(false)
  const [newNegocioTipo, setNewNegocioTipo] = useState('')
  const [creatingNegocio, setCreatingNegocio] = useState(false)

  // Attachments
  const [attachments, setAttachments] = useState<LeadAttachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [deleteAttachmentId, setDeleteAttachmentId] = useState<string | null>(null)

  // Form state (editable fields)
  const [form, setForm] = useState<Record<string, unknown>>({})

  // Postal code auto-fill
  const [cpLoading, setCpLoading] = useState(false)

  // NIPC auto-fill
  const [nipcLoading, setNipcLoading] = useState(false)

  const loadLead = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) throw new Error('Lead não encontrado')
      const data = await res.json()
      setLead(data)
      setForm(data)
    } catch {
      toast.error('Erro ao carregar lead')
      router.push('/dashboard/leads')
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  const loadNegocios = useCallback(async () => {
    setNegociosLoading(true)
    try {
      const res = await fetch(`/api/negocios?lead_id=${id}`)
      if (res.ok) {
        const data = await res.json()
        setNegocios(data.data || [])
      }
    } catch {
      // silently fail
    } finally {
      setNegociosLoading(false)
    }
  }, [id])

  const loadAttachments = useCallback(async () => {
    setAttachmentsLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}/attachments`)
      if (res.ok) {
        const data = await res.json()
        setAttachments(data || [])
      }
    } catch {
      // silently fail
    } finally {
      setAttachmentsLoading(false)
    }
  }, [id])

  const loadConsultants = useCallback(async () => {
    try {
      const res = await fetch('/api/users/consultants')
      if (res.ok) {
        const data = await res.json()
        setConsultants(
          (data || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            commercial_name: c.commercial_name as string,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadLead()
    loadConsultants()
  }, [loadLead, loadConsultants])

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const saveSection = async (fields: string[]) => {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {}
      for (const f of fields) {
        body[f] = form[f] ?? null
      }

      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }

      toast.success('Lead actualizado com sucesso')
      // Update local lead data
      setLead((prev) => (prev ? { ...prev, ...body } : prev))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  // Postal code auto-fill
  const handlePostalCodeLookup = async () => {
    const cp = form.codigo_postal as string
    if (!cp || cp.length < 7) return
    setCpLoading(true)
    try {
      const res = await fetch(`/api/postal-code/${cp}`)
      if (res.ok) {
        const data = await res.json()
        if (data.Distrito) updateField('distrito', data.Distrito)
        if (data.Concelho) updateField('concelho', data.Concelho)
        if (data.Freguesia) updateField('freguesia', data.Freguesia)
        if (data.Localidade) updateField('localidade', data.Localidade)
        toast.success('Morada auto-preenchida')
      } else {
        toast.error('Código postal não encontrado')
      }
    } catch {
      toast.error('Erro ao consultar código postal')
    } finally {
      setCpLoading(false)
    }
  }

  // NIPC auto-fill
  const handleNipcLookup = async () => {
    const nipc = form.nipc as string
    if (!nipc || nipc.replace(/\D/g, '').length !== 9) return
    setNipcLoading(true)
    try {
      const res = await fetch(`/api/nipc/${nipc}`)
      if (res.ok) {
        const data = await res.json()
        if (data.nome) updateField('empresa', data.nome)
        if (data.morada) updateField('morada_empresa', data.morada)
        if (data.telefone) updateField('telefone_empresa', data.telefone)
        if (data.email) updateField('email_empresa', data.email)
        if (data.website) updateField('website_empresa', data.website)
        toast.success('Dados da empresa auto-preenchidos')
      } else {
        const err = await res.json()
        toast.error(err.error || 'NIPC não encontrado')
      }
    } catch {
      toast.error('Erro ao consultar NIPC')
    } finally {
      setNipcLoading(false)
    }
  }

  // Create negocio
  const handleCreateNegocio = async () => {
    if (!newNegocioTipo) return
    setCreatingNegocio(true)
    try {
      const res = await fetch('/api/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id, tipo: newNegocioTipo }),
      })
      if (!res.ok) throw new Error('Erro ao criar negócio')
      const data = await res.json()
      toast.success('Negócio criado com sucesso')
      setNewNegocioOpen(false)
      setNewNegocioTipo('')
      loadNegocios()
      router.push(`/dashboard/leads/${id}/negocios/${data.id}`)
    } catch {
      toast.error('Erro ao criar negócio')
    } finally {
      setCreatingNegocio(false)
    }
  }

  // Delete attachment
  const handleDeleteAttachment = async () => {
    if (!deleteAttachmentId) return
    try {
      const res = await fetch(`/api/leads/attachments/${deleteAttachmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar')
      toast.success('Anexo eliminado')
      loadAttachments()
    } catch {
      toast.error('Erro ao eliminar anexo')
    } finally {
      setDeleteAttachmentId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  if (!lead) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/leads')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{lead.nome}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {lead.estado && <Badge variant="secondary">{lead.estado}</Badge>}
              {lead.temperatura && (() => {
                const t = LEAD_TEMPERATURAS.find((x) => x.value === lead.temperatura)
                return t ? (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.color}`}>
                    {t.label}
                  </span>
                ) : null
              })()}
              {lead.agent?.commercial_name && (
                <span>Consultor: {lead.agent.commercial_name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pessoal" onValueChange={(tab) => {
        if (tab === 'negocios') loadNegocios()
        if (tab === 'anexos') loadAttachments()
      }}>
        <TabsList>
          <TabsTrigger value="pessoal">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="identificacao">Identificação</TabsTrigger>
          <TabsTrigger value="morada">Morada</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="negocios">Negócios</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
        </TabsList>

        {/* Tab 1 - Dados Pessoais */}
        <TabsContent value="pessoal" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informação Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={(form.nome as string) || ''}
                    onChange={(e) => updateField('nome', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input
                    value={(form.full_name as string) || ''}
                    onChange={(e) => updateField('full_name', e.target.value)}
                    placeholder="Nome extraído do documento"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={(form.email as string) || ''}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telemóvel</Label>
                  <Input
                    value={(form.telemovel as string) || ''}
                    onChange={(e) => updateField('telemovel', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone Fixo</Label>
                  <Input
                    value={(form.telefone_fixo as string) || ''}
                    onChange={(e) => updateField('telefone_fixo', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={(form.genero as string) || ''} onValueChange={(v) => updateField('genero', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_GENEROS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={(form.data_nascimento as string) || ''}
                    onChange={(e) => updateField('data_nascimento', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidade</Label>
                  <Input
                    value={(form.nacionalidade as string) || ''}
                    onChange={(e) => updateField('nacionalidade', e.target.value)}
                    placeholder="Portuguesa"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => saveSection(['nome', 'full_name', 'email', 'telemovel', 'telefone_fixo', 'genero', 'data_nascimento', 'nacionalidade'])}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacto e Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={(form.estado as string) || ''} onValueChange={(v) => updateField('estado', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_ESTADOS.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temperatura</Label>
                  <Select value={(form.temperatura as string) || ''} onValueChange={(v) => updateField('temperatura', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_TEMPERATURAS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className={t.color.split(' ')[0]}>{t.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={(form.origem as string) || ''} onValueChange={(v) => updateField('origem', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_ORIGENS.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Forma de Contacto</Label>
                  <Select value={(form.forma_contacto as string) || ''} onValueChange={(v) => updateField('forma_contacto', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FORMAS_CONTACTO.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Meio Preferencial</Label>
                  <Select value={(form.meio_contacto_preferencial as string) || ''} onValueChange={(v) => updateField('meio_contacto_preferencial', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_MEIOS_CONTACTO.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Consultor</Label>
                  <Select value={(form.agent_id as string) || ''} onValueChange={(v) => updateField('agent_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Atribuir consultor" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="consentimento_contacto"
                    checked={!!form.consentimento_contacto}
                    onCheckedChange={(v) => updateField('consentimento_contacto', v)}
                  />
                  <Label htmlFor="consentimento_contacto" className="text-sm">Consentimento de contacto</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="consentimento_webmarketing"
                    checked={!!form.consentimento_webmarketing}
                    onCheckedChange={(v) => updateField('consentimento_webmarketing', v)}
                  />
                  <Label htmlFor="consentimento_webmarketing" className="text-sm">Consentimento webmarketing</Label>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => saveSection(['estado', 'temperatura', 'origem', 'forma_contacto', 'meio_contacto_preferencial', 'agent_id', 'consentimento_contacto', 'consentimento_webmarketing'])}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={4}
                value={(form.observacoes as string) || ''}
                onChange={(e) => updateField('observacoes', e.target.value)}
                placeholder="Notas sobre o lead..."
              />
              <Button
                size="sm"
                onClick={() => saveSection(['observacoes'])}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2 - Identificacao */}
        <TabsContent value="identificacao" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documento de Identificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Documento</Label>
                  <Select value={(form.tipo_documento as string) || ''} onValueChange={(v) => updateField('tipo_documento', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_TIPOS_DOCUMENTO.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número do Documento</Label>
                  <Input
                    value={(form.numero_documento as string) || ''}
                    onChange={(e) => updateField('numero_documento', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>NIF</Label>
                  <Input
                    value={(form.nif as string) || ''}
                    onChange={(e) => updateField('nif', e.target.value)}
                    placeholder="000000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>País Emissor</Label>
                  <Input
                    value={(form.pais_emissor as string) || ''}
                    onChange={(e) => updateField('pais_emissor', e.target.value)}
                    placeholder="Portugal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Validade</Label>
                  <Input
                    type="date"
                    value={(form.data_validade_documento as string) || ''}
                    onChange={(e) => updateField('data_validade_documento', e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => saveSection(['tipo_documento', 'numero_documento', 'nif', 'pais_emissor', 'data_validade_documento'])}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3 - Morada */}
        <TabsContent value="morada" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Morada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <div className="flex gap-2">
                    <Input
                      value={(form.codigo_postal as string) || ''}
                      onChange={(e) => updateField('codigo_postal', e.target.value)}
                      placeholder="XXXX-XXX"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePostalCodeLookup}
                      disabled={cpLoading}
                    >
                      {cpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Auto-preencher'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Localidade</Label>
                  <Input
                    value={(form.localidade as string) || ''}
                    onChange={(e) => updateField('localidade', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Morada</Label>
                <Input
                  value={(form.morada as string) || ''}
                  onChange={(e) => updateField('morada', e.target.value)}
                  placeholder="Rua, número, andar..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Distrito</Label>
                  <Input
                    value={(form.distrito as string) || ''}
                    onChange={(e) => updateField('distrito', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Concelho</Label>
                  <Input
                    value={(form.concelho as string) || ''}
                    onChange={(e) => updateField('concelho', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Freguesia</Label>
                  <Input
                    value={(form.freguesia as string) || ''}
                    onChange={(e) => updateField('freguesia', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zona</Label>
                  <Input
                    value={(form.zona as string) || ''}
                    onChange={(e) => updateField('zona', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>País</Label>
                  <Input
                    value={(form.pais as string) || ''}
                    onChange={(e) => updateField('pais', e.target.value)}
                    placeholder="Portugal"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => saveSection(['codigo_postal', 'localidade', 'morada', 'distrito', 'concelho', 'freguesia', 'zona', 'pais'])}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4 - Empresa */}
        <TabsContent value="empresa" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Dados da Empresa</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="tem_empresa" className="text-sm">Tem empresa</Label>
                  <Switch
                    id="tem_empresa"
                    checked={!!form.tem_empresa}
                    onCheckedChange={(v) => updateField('tem_empresa', v)}
                  />
                </div>
              </div>
            </CardHeader>
            {!!form.tem_empresa && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>NIPC</Label>
                    <div className="flex gap-2">
                      <Input
                        value={(form.nipc as string) || ''}
                        onChange={(e) => updateField('nipc', e.target.value)}
                        placeholder="000000000"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleNipcLookup}
                        disabled={nipcLoading}
                      >
                        {nipcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pesquisar'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input
                      value={(form.empresa as string) || ''}
                      onChange={(e) => updateField('empresa', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Morada da Empresa</Label>
                  <Input
                    value={(form.morada_empresa as string) || ''}
                    onChange={(e) => updateField('morada_empresa', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={(form.telefone_empresa as string) || ''}
                      onChange={(e) => updateField('telefone_empresa', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={(form.email_empresa as string) || ''}
                      onChange={(e) => updateField('email_empresa', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={(form.website_empresa as string) || ''}
                      onChange={(e) => updateField('website_empresa', e.target.value)}
                      placeholder="https://"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => saveSection(['tem_empresa', 'nipc', 'empresa', 'morada_empresa', 'telefone_empresa', 'email_empresa', 'website_empresa'])}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar
                </Button>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Tab 5 - Negocios */}
        <TabsContent value="negocios" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Negócios</h3>
            <Button size="sm" onClick={() => setNewNegocioOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Negócio
            </Button>
          </div>

          {negociosLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : negocios.length === 0 ? (
            <Card className="py-8">
              <CardContent className="text-center">
                <Briefcase className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum negócio associado</p>
                <Button size="sm" className="mt-3" onClick={() => setNewNegocioOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Negócio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {negocios.map((neg) => (
                <Card
                  key={neg.id as string}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => router.push(`/dashboard/leads/${id}/negocios/${neg.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{neg.tipo as string}</Badge>
                      <Badge variant="outline">{(neg.estado as string) || 'Aberto'}</Badge>
                      {!!neg.localizacao && (
                        <span className="text-sm text-muted-foreground">{neg.localizacao as string}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {!!neg.orcamento && (
                        <span className="font-medium">{formatCurrency(neg.orcamento as number)}</span>
                      )}
                      {!!neg.preco_venda && (
                        <span className="font-medium">{formatCurrency(neg.preco_venda as number)}</span>
                      )}
                      <span className="text-muted-foreground">
                        {formatDate(neg.created_at as string)}
                      </span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Dialog criar negocio */}
          <Dialog open={newNegocioOpen} onOpenChange={setNewNegocioOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Negócio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Negócio *</Label>
                  <Select value={newNegocioTipo} onValueChange={setNewNegocioTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {NEGOCIO_TIPOS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewNegocioOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateNegocio} disabled={!newNegocioTipo || creatingNegocio}>
                  {creatingNegocio && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tab 6 - Anexos */}
        <TabsContent value="anexos" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Anexos</h3>
          </div>

          {attachmentsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : attachments.length === 0 ? (
            <Card className="py-8">
              <CardContent className="text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum anexo encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <Card key={att.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {att.name || 'Ficheiro'}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(att.created_at)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteAttachmentId(att.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <AlertDialog open={!!deleteAttachmentId} onOpenChange={() => setDeleteAttachmentId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar anexo</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem a certeza de que pretende eliminar este anexo?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAttachment}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
