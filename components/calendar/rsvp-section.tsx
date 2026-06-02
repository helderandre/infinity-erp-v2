'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ThumbsUp, ThumbsDown, Pencil, Trash2 } from 'lucide-react'
import { parseOccurrenceId } from '@/lib/calendar/occurrence-id'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface RsvpProfile {
  profile_photo_url: string | null
}

interface RsvpUser {
  id: string
  commercial_name: string | null
  profile?: RsvpProfile | RsvpProfile[] | null
}

interface RsvpEntry {
  id: string
  user_id: string
  status: 'going' | 'not_going' | 'pending'
  reason?: string | null
  user?: RsvpUser | null
}

interface RsvpSectionProps {
  /** Composite event id ("<uuid>" or "<uuid>_<iso>" for recurring occurrences). */
  eventId: string
  currentUserId?: string
  currentUserName?: string | null
  currentUserPhoto?: string | null
  /** Managers see every name; a regular consultor sees only their own entry. */
  isManager: boolean
  /** Notify parent so it can refetch the calendar (e.g. month-view counts). */
  onChanged?: () => void
}

function photoOf(user?: RsvpUser | null): string | null {
  if (!user?.profile) return null
  const p = Array.isArray(user.profile) ? user.profile[0] : user.profile
  return p?.profile_photo_url ?? null
}

function initialsOf(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

export function RsvpSection({
  eventId,
  currentUserId,
  currentUserName,
  currentUserPhoto,
  isManager,
  onChanged,
}: RsvpSectionProps) {
  const [rsvpList, setRsvpList] = useState<RsvpEntry[]>([])
  const [tab, setTab] = useState<'going' | 'not_going'>('going')
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false)
  const [reasonText, setReasonText] = useState('')

  const fetchRsvps = useCallback(async () => {
    try {
      const { eventId: realId, occurrenceDate } = parseOccurrenceId(eventId)
      const qs = occurrenceDate ? `?occurrence_date=${encodeURIComponent(occurrenceDate)}` : ''
      const res = await fetch(`/api/calendar/events/${realId}/rsvp${qs}`)
      if (res.ok) {
        const json = await res.json()
        setRsvpList(json.data ?? [])
      }
    } catch {
      // silently fail
    }
  }, [eventId])

  useEffect(() => {
    fetchRsvps()
  }, [fetchRsvps])

  const myRsvp = useMemo(
    () => rsvpList.find((r) => r.user_id === currentUserId),
    [rsvpList, currentUserId],
  )
  const goingList = useMemo(() => rsvpList.filter((r) => r.status === 'going'), [rsvpList])
  const notGoingList = useMemo(() => rsvpList.filter((r) => r.status === 'not_going'), [rsvpList])

  // After the user responds, surface the tab their entry lives in.
  useEffect(() => {
    if (myRsvp?.status === 'going' || myRsvp?.status === 'not_going') {
      setTab(myRsvp.status)
    }
  }, [myRsvp?.status])

  // Own entry pinned on top; others alphabetical (managers only).
  const orderedFor = useCallback(
    (list: RsvpEntry[]) => {
      const mine = list.filter((r) => r.user_id === currentUserId)
      const others = isManager
        ? list
            .filter((r) => r.user_id !== currentUserId)
            .sort((a, b) =>
              (a.user?.commercial_name ?? '').localeCompare(
                b.user?.commercial_name ?? '',
                'pt',
              ),
            )
        : []
      return [...mine, ...others]
    },
    [currentUserId, isManager],
  )

  const visibleList = tab === 'going' ? orderedFor(goingList) : orderedFor(notGoingList)
  const hiddenOthers = !isManager
    ? (tab === 'going' ? goingList : notGoingList).filter((r) => r.user_id !== currentUserId).length
    : 0

  const respond = useCallback(
    async (status: 'going' | 'not_going', reason?: string) => {
      if (!currentUserId) return
      // Optimistic: reflect instantly so buttons hide and the entry appears.
      setRsvpList((prev) => {
        const others = prev.filter((r) => r.user_id !== currentUserId)
        return [
          {
            id: `optimistic-${currentUserId}`,
            user_id: currentUserId,
            status,
            reason: reason ?? null,
            user: {
              id: currentUserId,
              commercial_name: currentUserName ?? 'Eu',
              profile: { profile_photo_url: currentUserPhoto ?? null },
            },
          },
          ...others,
        ]
      })
      setTab(status)
      try {
        const { eventId: realId, occurrenceDate } = parseOccurrenceId(eventId)
        const res = await fetch(`/api/calendar/events/${realId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, reason, occurrence_date: occurrenceDate }),
        })
        if (!res.ok) throw new Error()
        toast.success(status === 'going' ? 'Presença confirmada!' : 'Ausência registada.')
      } catch {
        toast.error('Erro ao guardar. Tente novamente.')
      }
      fetchRsvps()
      onChanged?.()
    },
    [currentUserId, currentUserName, currentUserPhoto, eventId, fetchRsvps, onChanged],
  )

  const clearRsvp = useCallback(async () => {
    if (!currentUserId) return
    setRsvpList((prev) => prev.filter((r) => r.user_id !== currentUserId)) // optimistic
    try {
      const { eventId: realId, occurrenceDate } = parseOccurrenceId(eventId)
      const qs = occurrenceDate ? `?occurrence_date=${encodeURIComponent(occurrenceDate)}` : ''
      const res = await fetch(`/api/calendar/events/${realId}/rsvp${qs}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Presença removida.')
    } catch {
      toast.error('Erro ao remover. Tente novamente.')
    }
    fetchRsvps()
    onChanged?.()
  }, [currentUserId, eventId, fetchRsvps, onChanged])

  // Pencil = switch to the opposite option. Going→Não vou asks for a reason.
  const switchMine = useCallback(() => {
    if (myRsvp?.status === 'going') {
      setReasonText('')
      setReasonDialogOpen(true)
    } else {
      respond('going')
    }
  }, [myRsvp?.status, respond])

  return (
    <div className="space-y-3">
      {/* Confirm/deny buttons — only while the user has no entry. */}
      {!myRsvp && (
        <>
          <p className="text-xs text-muted-foreground/80">Confirmar presença</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-full"
              onClick={() => respond('going')}
            >
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
              Vou
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-full"
              onClick={() => {
                setReasonText('')
                setReasonDialogOpen(true)
              }}
            >
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
              Não vou
            </Button>
          </div>
        </>
      )}

      {/* Tabs + lists */}
      {rsvpList.length > 0 && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'going' | 'not_going')}>
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/50">
            <TabsTrigger value="going" className="rounded-full text-xs">
              Vão · {goingList.length}
            </TabsTrigger>
            <TabsTrigger value="not_going" className="rounded-full text-xs">
              Não vão · {notGoingList.length}
            </TabsTrigger>
          </TabsList>

          <div className="mt-2.5 space-y-1.5">
            {visibleList.map((r) => {
              const isOwn = r.user_id === currentUserId
              const photo = photoOf(r.user)
              const name = isOwn
                ? (r.user?.commercial_name ?? currentUserName ?? 'Você')
                : (r.user?.commercial_name ?? 'Utilizador')
              return (
                <div
                  key={r.user_id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border px-3 py-2',
                    isOwn
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/40 bg-background/40',
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {photo && <AvatarImage src={photo} alt={name} />}
                    <AvatarFallback className="text-[11px]">{initialsOf(name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {name}
                      {isOwn && (
                        <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </p>
                    {r.status === 'not_going' && r.reason && (
                      <p className="text-[11px] text-muted-foreground italic truncate">
                        — {r.reason}
                      </p>
                    )}
                  </div>
                  {isOwn && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={myRsvp?.status === 'going' ? 'Mudar para "Não vou"' : 'Mudar para "Vou"'}
                        onClick={switchMine}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Remover resposta"
                        onClick={clearRsvp}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}

            {visibleList.length === 0 && (
              <p className="px-1 py-2 text-[11px] text-muted-foreground">
                {tab === 'going' ? 'Ninguém confirmou.' : 'Ninguém marcou ausência.'}
              </p>
            )}

            {hiddenOthers > 0 && (
              <p className="px-1 text-[10.5px] text-muted-foreground/70">
                Só vê a sua própria resposta.
              </p>
            )}
          </div>
        </Tabs>
      )}

      {/* Reason dialog — initial "Não vou" or switching going → não vou. */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Porquê não pode ir?</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Motivo (opcional)"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReasonDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                respond('not_going', reasonText || undefined)
                setReasonDialogOpen(false)
              }}
            >
              Confirmar ausência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
