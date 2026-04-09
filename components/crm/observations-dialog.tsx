'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StickyNote, Pencil, Trash2, Check, X, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { VoiceRecorder } from '@/components/processes/voice-recorder'

// ─── Types & helpers ─────────────────────────────────────────────

export interface Observation {
  id: string
  text: string
  created_at: string
}

export function parseObservations(raw: string | null | undefined): Observation[] {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((o) => o && typeof o.text === 'string' && o.text.trim() !== '')
        .map((o) => ({
          id: typeof o.id === 'string' ? o.id : genId(),
          text: o.text,
          created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
        }))
    }
  } catch {
    // Not JSON — treat as legacy plain text
  }
  return [
    {
      id: 'legacy',
      text: raw,
      created_at: new Date(0).toISOString(),
    },
  ]
}

function serializeObservations(obs: Observation[]): string | null {
  if (obs.length === 0) return null
  return JSON.stringify(obs)
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── Main component (button + dialog) ────────────────────────────

interface ObservationsButtonProps {
  observacoes: string | null | undefined
  onSave: (next: string | null) => Promise<void>
}

export function ObservationsButton({ observacoes, onSave }: ObservationsButtonProps) {
  const [open, setOpen] = useState(false)
  const observations = useMemo(() => parseObservations(observacoes), [observacoes])
  const count = observations.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-900 h-7 px-3 text-[11px] font-semibold shadow-sm hover:bg-white/90 transition-colors border border-white/10"
        aria-label="Observações"
      >
        <StickyNote className="h-3 w-3" />
        Observações
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-sky-200 text-sky-800 text-[10px] font-bold px-1">
            {count}
          </span>
        )}
      </button>

      <ObservationsDialog
        open={open}
        onOpenChange={setOpen}
        observations={observations}
        onSave={onSave}
      />
    </>
  )
}

// ─── Dialog ──────────────────────────────────────────────────────

interface ObservationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  observations: Observation[]
  onSave: (next: string | null) => Promise<void>
}

function ObservationsDialog({
  open,
  onOpenChange,
  observations,
  onSave,
}: ObservationsDialogProps) {
  const [working, setWorking] = useState<Observation[]>(observations)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [newDraft, setNewDraft] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sync when dialog opens or observations change
  useEffect(() => {
    if (open) {
      setWorking(observations)
      setEditingId(null)
      setEditDraft('')
      setNewDraft('')
    }
  }, [open, observations])

  async function persist(next: Observation[]) {
    setSaving(true)
    try {
      await onSave(serializeObservations(next))
      setWorking(next)
    } catch {
      toast.error('Erro ao guardar observações')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    const text = newDraft.trim()
    if (!text) return
    const next: Observation[] = [
      { id: genId(), text, created_at: new Date().toISOString() },
      ...working,
    ]
    await persist(next)
    setNewDraft('')
    toast.success('Observação adicionada')
  }

  async function handleDelete(id: string) {
    const next = working.filter((o) => o.id !== id)
    await persist(next)
    toast.success('Observação eliminada')
  }

  function startEdit(o: Observation) {
    setEditingId(o.id)
    setEditDraft(o.text)
  }

  async function saveEdit() {
    if (!editingId) return
    const text = editDraft.trim()
    if (!text) {
      toast.error('A observação não pode estar vazia')
      return
    }
    const next = working.map((o) => (o.id === editingId ? { ...o, text } : o))
    await persist(next)
    setEditingId(null)
    setEditDraft('')
    toast.success('Observação actualizada')
  }

  async function handleVoiceTranscription(blob: Blob) {
    setTranscribing(true)
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'audio.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const text: string = (data?.text || '').trim()
      if (!text) {
        toast.error('Não foi possível transcrever o áudio')
        return
      }
      setNewDraft((prev) => (prev ? `${prev}\n${text}` : text))
      toast.success('Áudio transcrito')
    } catch {
      toast.error('Erro na transcrição do áudio')
    } finally {
      setTranscribing(false)
    }
  }

  function formatDate(iso: string) {
    if (iso === new Date(0).toISOString()) return 'Legado'
    try {
      return format(parseISO(iso), "d MMM yyyy 'às' HH:mm", { locale: pt })
    } catch {
      return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col !rounded-2xl !p-0 !gap-0 !ring-0 overflow-hidden" showCloseButton={false}>
        {/* Dark header */}
        <div className="bg-neutral-900 rounded-t-2xl px-5 py-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-white/10 border border-white/15">
              <StickyNote className="h-3.5 w-3.5" />
            </div>
            Observações
            {working.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-sky-200 text-sky-800 text-[10px] font-bold px-1.5">
                {working.length}
              </span>
            )}
          </DialogTitle>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {working.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <StickyNote className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">Sem observações registadas</p>
              <p className="text-xs mt-1">Adicione uma observação abaixo</p>
            </div>
          ) : (
            working.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 group"
              >
                {editingId === o.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="text-sm resize-y"
                      disabled={saving}
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null)
                          setEditDraft('')
                        }}
                        disabled={saving}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1" />
                        )}
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1 min-w-0">{o.text}</p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => startEdit(o)}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          aria-label="Editar"
                          disabled={saving}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(o.id)}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          aria-label="Eliminar"
                          disabled={saving}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {formatDate(o.created_at)}
                    </p>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add new */}
        <div className="border-t border-border/60 px-5 py-4 space-y-2 bg-background">
          <Textarea
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            placeholder={transcribing ? 'A transcrever áudio...' : 'Escreva uma nova observação...'}
            rows={3}
            className="text-sm resize-none rounded-lg"
            disabled={saving || transcribing}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <VoiceRecorder
                onSend={async (blob) => {
                  await handleVoiceTranscription(blob)
                }}
                onCancel={() => {}}
                disabled={saving}
              />
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newDraft.trim() || saving || transcribing}
              className="shrink-0"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
