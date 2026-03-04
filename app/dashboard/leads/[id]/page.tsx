'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  Briefcase,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/constants'
import { NEGOCIO_TIPOS } from '@/lib/constants'
import { LeadSidebar } from '@/components/leads/lead-sidebar'
import { LeadDataCard } from '@/components/leads/lead-data-card'
import type { LeadWithAgent, LeadAttachment } from '@/types/lead'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [lead, setLead] = useState<LeadWithAgent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [form, setForm] = useState<Record<string, unknown>>({})

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

  // Auto-fill states
  const [cpLoading, setCpLoading] = useState(false)
  const [nipcLoading, setNipcLoading] = useState(false)

  /* ─── Data Loading ─── */

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

  useEffect(() => {
    loadLead()
  }, [loadLead])

  /* ─── Form Handlers ─── */

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const saveFields = async (fields: string[]) => {
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
      setLead((prev) => (prev ? { ...prev, ...body } : prev))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  // Quick save for sidebar fields (estado, temperatura)
  const saveSidebarField = async (field: string, value: string) => {
    updateField(field, value)
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error('Erro ao guardar')
      setLead((prev) => (prev ? { ...prev, [field]: value } : prev))
      toast.success('Actualizado')
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  /* ─── Postal Code Auto-fill ─── */

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

  /* ─── NIPC Auto-fill ─── */

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

  /* ─── Document Analysis ─── */

  const handleDocumentAnalysisApply = (fields: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined) {
        updateField(key, value)
      }
    }
  }

  /* ─── Negocios ─── */

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

  /* ─── Attachments ─── */

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

  /* ─── Loading State ─── */

  if (isLoading) {
    return (
      <div className="flex gap-6">
        <div className="w-72 shrink-0">
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!lead) return null

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/leads')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      {/* 2-column layout: sidebar + main */}
      <div className="flex gap-6 items-start">
        {/* Left sidebar */}
        <div className="w-72 shrink-0">
          <LeadSidebar
            lead={lead}
            estado={(form.estado as string) || ''}
            temperatura={(form.temperatura as string) || ''}
            onEstadoChange={(v) => saveSidebarField('estado', v)}
            onTemperaturaChange={(v) => saveSidebarField('temperatura', v)}
          />
        </div>

        {/* Right main content */}
        <div className="flex-1 min-w-0">
          <Tabs
            defaultValue="dados"
            onValueChange={(tab) => {
              if (tab === 'negocios') loadNegocios()
              if (tab === 'historico') loadAttachments()
            }}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="negocios">Negócios</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            {/* ─── Dados Tab ─── */}
            <TabsContent value="dados" className="mt-0">
              <LeadDataCard
                lead={lead}
                form={form}
                onFieldChange={updateField}
                onSave={saveFields}
                isSaving={isSaving}
                attachments={attachments}
                onDeleteAttachment={(attId) => setDeleteAttachmentId(attId)}
                onDocumentAnalysisApply={handleDocumentAnalysisApply}
                cpLoading={cpLoading}
                onPostalCodeLookup={handlePostalCodeLookup}
                nipcLoading={nipcLoading}
                onNipcLookup={handleNipcLookup}
              />
            </TabsContent>

            {/* ─── Negócios Tab ─── */}
            <TabsContent value="negocios" className="mt-0 space-y-4">
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

            {/* ─── Histórico Tab ─── */}
            <TabsContent value="historico" className="mt-0 space-y-4">
              <h3 className="text-lg font-semibold">Histórico e Anexos</h3>

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
      </div>
    </div>
  )
}
