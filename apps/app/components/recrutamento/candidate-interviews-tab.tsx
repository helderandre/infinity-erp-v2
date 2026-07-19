'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { CalendarPlus, Loader2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  createInterview,
  deleteInterview,
  getInterviews,
  updateInterview,
} from '@/app/dashboard/recrutamento/actions'
import type { InterviewFormat, RecruitmentInterview } from '@/types/recruitment'
import { INTERVIEW_FORMATS } from '@/types/recruitment'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Recruiter {
  id: string
  commercial_name: string
}

function when(iso: string | null): string {
  if (!iso) return 'Sem data'
  try {
    return format(new Date(iso), "d MMM yyyy 'às' HH:mm", { locale: pt })
  } catch {
    return iso
  }
}

export function CandidateInterviewsTab({
  candidateId,
  recruiters,
  onMutated,
}: {
  candidateId: string
  recruiters: Recruiter[]
  onMutated?: () => void
}) {
  const [items, setItems] = useState<RecruitmentInterview[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const [scheduledAt, setScheduledAt] = useState('')
  const [fmt, setFmt] = useState<InterviewFormat>('in_person')
  const [conductedBy, setConductedBy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { interviews } = await getInterviews(candidateId)
      setItems(interviews)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    if (!scheduledAt) {
      toast.error('Indica a data da entrevista')
      return
    }
    setSaving(true)
    try {
      const { error } = await createInterview(candidateId, {
        interview_date: new Date(scheduledAt).toISOString(),
        format: fmt,
        conducted_by: conductedBy || undefined,
      })
      if (error) throw new Error(error)
      setScheduledAt('')
      setFmt('in_person')
      setConductedBy('')
      setAdding(false)
      await load()
      onMutated?.()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível agendar a entrevista')
    } finally {
      setSaving(false)
    }
  }

  async function patch(id: string, input: Partial<RecruitmentInterview>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...input } : i)))
    try {
      const { error } = await updateInterview(id, input)
      if (error) throw new Error(error)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao actualizar a entrevista')
      void load()
    }
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const { error } = await deleteInterview(id)
      if (error) throw new Error(error)
      onMutated?.()
    } catch (e) {
      console.error(e)
      void load()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setAdding((v) => !v)}>
          <CalendarPlus className="h-3.5 w-3.5" />
          Nova entrevista
        </Button>
      </div>

      {adding && (
        <div className="rounded-2xl border border-border/40 bg-background/40 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Data e hora</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Formato</Label>
              <Select value={fmt} onValueChange={(v) => setFmt(v as InterviewFormat)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INTERVIEW_FORMATS) as InterviewFormat[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {INTERVIEW_FORMATS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Conduzida por</Label>
            <Select value={conductedBy || 'none'} onValueChange={(v) => setConductedBy(v === 'none' ? '' : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={saving} className="rounded-full gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Agendar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8">Sem entrevistas agendadas</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((iv) => {
            const date = iv.interview_date ? parseISO(iv.interview_date) : null
            const done = date ? isPast(date) && !isToday(date) : false
            const chipColor = done ? '#10b981' : '#3b82f6'
            const followUpOverdue =
              !!iv.follow_up_date && isPast(parseISO(iv.follow_up_date)) && !isToday(parseISO(iv.follow_up_date))
            return (
              <li key={iv.id} className="rounded-2xl border border-border/40 bg-background/40 p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{when(iv.interview_date)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {iv.format ? INTERVIEW_FORMATS[iv.format] : '—'}
                      {iv.interviewer?.commercial_name ? ` · ${iv.interviewer.commercial_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${chipColor}22`, color: chipColor }}
                    >
                      {iv.interview_number}ª entrevista{done ? ' · Realizada' : ''}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(iv.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Próximo passo</Label>
                    <Input
                      defaultValue={iv.next_step ?? ''}
                      onBlur={(e) => {
                        const val = e.target.value
                        if (val !== (iv.next_step ?? '')) patch(iv.id, { next_step: val || null })
                      }}
                      placeholder="Ex.: 2ª entrevista, proposta…"
                      className="h-8 text-[11px] rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Follow-up</Label>
                    <Input
                      type="date"
                      defaultValue={iv.follow_up_date ?? ''}
                      onChange={(e) => patch(iv.id, { follow_up_date: e.target.value || null })}
                      className={cn('h-8 text-[11px] rounded-lg', followUpOverdue && 'text-red-600')}
                    />
                  </div>
                </div>

                <Textarea
                  defaultValue={iv.notes ?? ''}
                  onBlur={(e) => {
                    const val = e.target.value
                    if (val !== (iv.notes ?? '')) patch(iv.id, { notes: val || null })
                  }}
                  placeholder="Notas da entrevista…"
                  rows={2}
                  className="resize-none rounded-xl text-[12px]"
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
