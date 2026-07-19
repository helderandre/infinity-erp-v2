'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  ArrowRightLeft,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  StickyNote,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { createCommunication, getCommunications, getStageLog } from '@/app/dashboard/recrutamento/actions'
import type { CommunicationType, RecruitmentCommunication, RecruitmentStageLog } from '@/types/recruitment'
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_DOT, normalizeCandidateStatus } from '@/types/recruitment'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { VoiceInputButton } from '@/components/shared/voice-input-button'

const TYPES: { key: CommunicationType; label: string; icon: LucideIcon }[] = [
  { key: 'note', label: 'Nota', icon: StickyNote },
  { key: 'call', label: 'Chamada', icon: Phone },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'meeting', label: 'Reunião', icon: Users },
]

const TYPE_ICON: Record<string, LucideIcon> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  meeting: Users,
}

const TYPE_LABEL: Record<string, string> = {
  note: 'Nota',
  call: 'Chamada',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  meeting: 'Reunião',
}

type TimelineItem =
  | { kind: 'comm'; id: string; at: string; comm: RecruitmentCommunication }
  | { kind: 'stage'; id: string; at: string; log: RecruitmentStageLog }

function when(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy 'às' HH:mm", { locale: pt })
  } catch {
    return iso
  }
}

export function CandidateActivityTab({
  candidateId,
  onMutated,
}: {
  candidateId: string
  onMutated?: () => void
}) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<CommunicationType>('note')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ communications }, { logs }] = await Promise.all([
        getCommunications(candidateId),
        getStageLog(candidateId),
      ])
      const merged: TimelineItem[] = [
        ...communications.map((c): TimelineItem => ({ kind: 'comm', id: c.id, at: c.created_at, comm: c })),
        ...logs.map((l): TimelineItem => ({ kind: 'stage', id: l.id, at: l.created_at, log: l })),
      ]
      merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      setItems(merged)
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
    if (!body.trim()) return
    setSaving(true)
    try {
      const { error } = await createCommunication(candidateId, {
        type,
        content: body.trim(),
        direction: 'outbound',
      })
      if (error) throw new Error(error)
      setBody('')
      await load()
      onMutated?.()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível registar a actividade')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-3 space-y-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          {TYPES.map((t) => {
            const Icon = t.icon
            const active = type === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                  active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escrever ou ditar…"
            rows={2}
            className="resize-none rounded-xl text-sm pr-10"
          />
          <VoiceInputButton
            onTranscribe={(t) => setBody((b) => (b ? `${b} ${t}` : t))}
            mode="append"
            size="icon-sm"
            variant="ghost"
            className="absolute top-1.5 right-1.5 h-7 w-7 text-muted-foreground"
            label="Ditar nota"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={saving || !body.trim()} className="rounded-full gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Registar
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8">Nenhuma actividade registada</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((item) => {
            if (item.kind === 'stage') {
              const status = normalizeCandidateStatus(item.log.to_status)
              const color = CANDIDATE_STATUS_DOT[status]
              return (
                <li key={item.id} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 h-6 w-6 rounded-full grid place-items-center shrink-0"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px]">
                      Movido para <span className="font-medium">{CANDIDATE_STATUSES[status].label}</span>
                      {item.log.user?.commercial_name ? (
                        <span className="text-muted-foreground"> · {item.log.user.commercial_name}</span>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{when(item.at)}</p>
                  </div>
                </li>
              )
            }
            const Icon = TYPE_ICON[item.comm.type] ?? StickyNote
            return (
              <li key={item.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 h-6 w-6 rounded-full grid place-items-center shrink-0 bg-muted text-muted-foreground">
                  <Icon className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                  {item.comm.subject && <p className="text-[12px] font-medium">{item.comm.subject}</p>}
                  {item.comm.content && (
                    <p className="text-[12px] whitespace-pre-wrap break-words">{item.comm.content}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {TYPE_LABEL[item.comm.type] ?? item.comm.type}
                    {item.comm.user?.commercial_name ? ` · ${item.comm.user.commercial_name}` : ''} · {when(item.at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
