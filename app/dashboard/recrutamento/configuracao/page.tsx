'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
  getCommTemplates,
  createCommTemplate,
  updateCommTemplate,
  deleteCommTemplate,
} from '@/app/dashboard/recrutamento/actions'

import type {
  RecruitmentCommTemplate,
  CandidateStatus,
  CommTemplateChannel,
} from '@/types/recruitment'

import {
  COMM_TEMPLATE_CHANNELS,
  CANDIDATE_STATUSES,
  PIPELINE_STAGES,
} from '@/types/recruitment'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, Loader2, Pencil, Trash2, FileText, Settings2, Eye, ExternalLink, Mail,
} from 'lucide-react'

import { SubmissionsTab } from '@/components/recrutamento/submissions-tab'
import { FormEditorTab } from '@/components/recrutamento/form-editor-tab'

// ─── Templates Tab Constants ────────────────────────────────────────────────

const AVAILABLE_VARIABLES = ['{{nome}}', '{{recrutador}}', '{{empresa}}', '{{data}}', '{{telefone}}', '{{email}}']

const EMPTY_FORM = {
  name: '',
  stage: '' as string,
  channel: '' as string,
  subject: '',
  body: '',
  is_active: true,
}

// ─── Templates Tab Content ──────────────────────────────────────────────────

function TemplatesTabContent() {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<RecruitmentCommTemplate[]>([])
  const [filterStage, setFilterStage] = useState<string>('all')
  const [filterChannel, setFilterChannel] = useState<string>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    const { templates: data, error } = await getCommTemplates()
    if (error) toast.error('Erro ao carregar templates')
    else setTemplates(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const filtered = templates.filter((t) => {
    if (filterStage !== 'all' && t.stage !== filterStage) return false
    if (filterChannel !== 'all' && t.channel !== filterChannel) return false
    return true
  })

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(t: RecruitmentCommTemplate) {
    setEditingId(t.id)
    setForm({
      name: t.name,
      stage: t.stage,
      channel: t.channel,
      subject: t.subject || '',
      body: t.body,
      is_active: t.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.stage || !form.channel || !form.body.trim()) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }
    setSaving(true)
    const variables = AVAILABLE_VARIABLES.filter((v) => form.body.includes(v))

    if (editingId) {
      const { success, error } = await updateCommTemplate(editingId, {
        name: form.name,
        stage: form.stage as CandidateStatus,
        channel: form.channel as CommTemplateChannel,
        subject: form.channel === 'email' ? form.subject || null : null,
        body: form.body,
        variables,
        is_active: form.is_active,
      })
      if (error) toast.error(error)
      else { toast.success('Template actualizado'); setDialogOpen(false); loadTemplates() }
    } else {
      const { error } = await createCommTemplate({
        name: form.name,
        stage: form.stage as CandidateStatus,
        channel: form.channel as CommTemplateChannel,
        subject: form.channel === 'email' ? form.subject : undefined,
        body: form.body,
        variables,
        is_active: form.is_active,
      })
      if (error) toast.error(error)
      else { toast.success('Template criado'); setDialogOpen(false); loadTemplates() }
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await deleteCommTemplate(deleteId)
    if (error) toast.error(error)
    else { toast.success('Template eliminado'); loadTemplates() }
    setDeleteId(null)
    setDeleting(false)
  }

  async function handleToggleActive(t: RecruitmentCommTemplate) {
    const { error } = await updateCommTemplate(t.id, { is_active: !t.is_active })
    if (error) toast.error(error)
    else {
      setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
    }
  }

  function insertVariable(v: string) {
    const ta = bodyRef.current
    if (!ta) { setForm({ ...form, body: form.body + v }); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newBody = form.body.slice(0, start) + v + form.body.slice(end)
    setForm({ ...form, body: newBody })
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + v.length, start + v.length) }, 0)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap gap-3">
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fase" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fases</SelectItem>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{CANDIDATE_STATUSES[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {(Object.entries(COMM_TEMPLATE_CHANNELS) as [CommTemplateChannel, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo Template</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum template criado</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />Criar Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className={cn('transition-opacity', !t.is_active && 'opacity-60')}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm leading-tight">{t.name}</h3>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={cn(CANDIDATE_STATUSES[t.stage]?.color, 'text-xs')}>{CANDIDATE_STATUSES[t.stage]?.label}</Badge>
                  <Badge variant="outline" className="text-xs">{COMM_TEMPLATE_CHANNELS[t.channel]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{t.body}</p>
                {t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-[10px] font-mono">{v}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">{t.is_active ? 'Ativo' : 'Inativo'}</span>
                  <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Primeiro contacto LinkedIn" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fase do Pipeline *</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{CANDIDATE_STATUSES[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal *</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(COMM_TEMPLATE_CHANNELS) as [CommTemplateChannel, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.channel === 'email' && (
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Assunto do email" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Corpo da Mensagem *</Label>
              <Textarea
                ref={bodyRef}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={8}
                placeholder="Escreva a mensagem..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Variaveis disponiveis (clique para inserir)</Label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARIABLES.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs font-mono transition-colors"
                    onClick={() => insertVariable(v)}
                  >
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este template? Esta accao e irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Formulario Tab Content ─────────────────────────────────────────────────

function FormularioTabContent() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Button variant="outline" className="gap-2" asChild>
          <a href="/entryform" target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" />
            Ver Formulario
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="rounded-lg">
          <TabsTrigger value="submissions" className="gap-1.5 rounded-md">
            <FileText className="h-4 w-4" />
            Submissoes
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-1.5 rounded-md">
            <Settings2 className="h-4 w-4" />
            Editor de Campos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-4">
          <SubmissionsTab />
        </TabsContent>

        <TabsContent value="editor" className="mt-4">
          <FormEditorTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConfiguracaoPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracao</h1>
        <p className="text-muted-foreground text-sm">
          Gerir templates de comunicacao e formulario de entrada
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="rounded-xl bg-muted/40 backdrop-blur-sm p-1">
          <TabsTrigger value="templates" className="gap-1.5 rounded-lg">
            <Mail className="h-4 w-4" />
            Templates de Comunicacao
          </TabsTrigger>
          <TabsTrigger value="formulario" className="gap-1.5 rounded-lg">
            <FileText className="h-4 w-4" />
            Formulario de Entrada
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <TemplatesTabContent />
        </TabsContent>

        <TabsContent value="formulario" className="mt-6">
          <FormularioTabContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
