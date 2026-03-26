'use client'

import { useState } from 'react'
import { format, parseISO, isPast } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Plus, Calendar, Pencil, Trash2, Loader2, Save, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createInterview, updateInterview, deleteInterview } from '@/app/dashboard/recrutamento/actions'
import type { RecruitmentInterview, InterviewFormat } from '@/types/recruitment'
import { INTERVIEW_FORMATS } from '@/types/recruitment'

interface CandidateInterviewsTabProps {
  candidateId: string
  interviews: RecruitmentInterview[]
  recruiters: Array<{ id: string; commercial_name: string }>
  onReload: () => Promise<void>
}

const emptyForm = { interview_date: '', format: 'in_person' as string, conducted_by: '', notes: '', next_step: '', follow_up_date: '' }

export function CandidateInterviewsTab({ candidateId, interviews, recruiters, onReload }: CandidateInterviewsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecruitmentInterview | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(iv: RecruitmentInterview) {
    setEditing(iv)
    setForm({
      interview_date: iv.interview_date?.slice(0, 16) ?? '',
      format: iv.format,
      conducted_by: iv.conducted_by ?? '',
      notes: iv.notes ?? '',
      next_step: iv.next_step ?? '',
      follow_up_date: iv.follow_up_date ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.interview_date) { toast.error('Data obrigatoria'); return }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await updateInterview(editing.id, {
          interview_date: form.interview_date,
          format: form.format as InterviewFormat,
          conducted_by: form.conducted_by || null,
          notes: form.notes || null,
          next_step: form.next_step || null,
          follow_up_date: form.follow_up_date || null,
        })
        if (error) { toast.error(error); return }
        toast.success('Entrevista actualizada')
      } else {
        const { error } = await createInterview(candidateId, {
          interview_date: form.interview_date,
          format: form.format,
          conducted_by: form.conducted_by || undefined,
          notes: form.notes || undefined,
          next_step: form.next_step || undefined,
          follow_up_date: form.follow_up_date || undefined,
        })
        if (error) { toast.error(error); return }
        toast.success('Entrevista criada')
      }
      setDialogOpen(false)
      await onReload()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await deleteInterview(deleteTarget)
      if (error) { toast.error(error); return }
      toast.success('Entrevista eliminada')
      setDeleteTarget(null)
      await onReload()
    } finally { setDeleting(false) }
  }

  function toggleNotes(id: string) {
    setExpandedNotes(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const recruiterName = (id: string | null) => recruiters.find(r => r.id === id)?.commercial_name ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Entrevistas</h3>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Nova Entrevista</Button>
      </div>

      {interviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Calendar className="h-10 w-10 mb-2" />
          <p>Nenhuma entrevista registada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((iv) => {
            const hasFollowUp = !!iv.follow_up_date
            const followUpPast = hasFollowUp && isPast(parseISO(iv.follow_up_date!))
            return (
              <div key={iv.id} className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    #{iv.interview_number}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{format(parseISO(iv.interview_date), "d MMM yyyy, HH:mm", { locale: pt })}</span>
                      <Badge variant="secondary" className="text-xs">{INTERVIEW_FORMATS[iv.format]}</Badge>
                      <span className="text-xs text-muted-foreground">{iv.interviewer?.commercial_name ?? recruiterName(iv.conducted_by)}</span>
                    </div>
                    {iv.notes && (
                      <p onClick={() => toggleNotes(iv.id)} className={cn("text-sm text-muted-foreground cursor-pointer", !expandedNotes.has(iv.id) && "line-clamp-3")}>
                        {iv.notes}
                      </p>
                    )}
                    {iv.next_step && <p className="text-sm"><span className="font-medium">Passo seguinte:</span> {iv.next_step}</p>}
                    {hasFollowUp && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{format(parseISO(iv.follow_up_date!), "d MMM yyyy", { locale: pt })}</span>
                        <Badge variant="outline" className={cn("text-xs", followUpPast ? "border-red-300 text-red-600" : "border-amber-300 text-amber-600")}>
                          {followUpPast ? 'Atrasado' : 'Pendente'}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(iv)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(iv.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Entrevista' : 'Nova Entrevista'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Data e hora *</Label><Input type="datetime-local" value={form.interview_date} onChange={e => setForm(f => ({ ...f, interview_date: e.target.value }))} /></div>
            <div>
              <Label>Formato</Label>
              <Select value={form.format} onValueChange={v => setForm(f => ({ ...f, format: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(INTERVIEW_FORMATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conduzida por</Label>
              <Select value={form.conducted_by} onValueChange={v => setForm(f => ({ ...f, conducted_by: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{recruiters.map(r => <SelectItem key={r.id} value={r.id}>{r.commercial_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notas</Label><Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div><Label>Passo seguinte</Label><Input value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))} /></div>
            <div><Label>Data de follow-up</Label><Input type="date" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar entrevista</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza de que pretende eliminar esta entrevista?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
