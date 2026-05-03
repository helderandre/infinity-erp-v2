'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Save } from 'lucide-react'
import type { FunnelSide, FunnelStage } from '@/types/funnel-event'

interface AddActivityDialogProps {
  side: FunnelSide
  /** Stages applicable to this side. Other stages won't be shown in the picker. */
  stages: { value: FunnelStage; label: string }[]
  /** Pre-fill the stage (one-click "+ on this row" buttons) */
  defaultStage?: FunnelStage
  /** Default date for the new entry (YYYY-MM-DD). Defaults to today. */
  defaultDate?: string
  trigger?: React.ReactNode
  onSuccess?: () => void
}

function todayInputValue(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function AddActivityDialog({
  side,
  stages,
  defaultStage,
  defaultDate,
  trigger,
  onSuccess,
}: AddActivityDialogProps) {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<FunnelStage>(defaultStage ?? stages[0]?.value)
  const [count, setCount] = useState<number>(1)
  const [date, setDate] = useState<string>(defaultDate ?? todayInputValue())
  const [notes, setNotes] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  function reset() {
    setStage(defaultStage ?? stages[0]?.value)
    setCount(1)
    setDate(defaultDate ?? todayInputValue())
    setNotes('')
  }

  async function handleSubmit() {
    if (!stage || count < 1) return
    setIsSaving(true)
    try {
      const occurredAt = new Date(`${date}T12:00:00`).toISOString()
      const res = await fetch('/api/agent-funnel-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side,
          stage,
          count,
          occurred_at: occurredAt,
          source: 'manual',
          notes: notes.trim() || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body?.error || 'Erro ao registar atividade')
        return
      }
      toast.success(`Atividade registada (${count}× ${stages.find(s => s.value === stage)?.label})`)
      reset()
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <span onClick={() => setOpen(true)} className="inline-block">
        {trigger ?? (
          <Button size="sm" variant="outline" className="rounded-full gap-1.5 h-7 text-xs">
            <Plus className="h-3 w-3" />
            Atividade
          </Button>
        )}
      </span>

      <DialogContent className="sm:max-w-md rounded-2xl bg-background/95 supports-[backdrop-filter]:bg-background/85 backdrop-blur-2xl border-border/40">
        <DialogHeader>
          <DialogTitle>Adicionar atividade</DialogTitle>
          <DialogDescription className="text-xs">
            Registar uma atividade que fizeste fora do app (ou que não foi capturada automaticamente).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Etapa
            </Label>
            <Select value={stage} onValueChange={(v) => setStage(v as FunnelStage)}>
              <SelectTrigger className="rounded-xl bg-background/60 border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Quantidade
              </Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="rounded-xl bg-background/60 border-border/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Data
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl bg-background/60 border-border/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Notas (opcional)
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: 5 chamadas frias para clientes inativos"
              className="rounded-xl bg-background/60 border-border/40 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
            className="rounded-full"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-full gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'A guardar…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
