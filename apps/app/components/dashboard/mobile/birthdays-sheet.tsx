'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { differenceInCalendarDays, format, parse } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowRight, Cake, Gift, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface BirthdaysSheetProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Lead {
  id: string
  nome: string | null
  telemovel: string | null
  email: string | null
  data_nascimento: string | null
  agent_id: string | null
}

export interface UpcomingBirthday extends Lead {
  nextBirthday: Date
  daysUntil: number
  age: number | null
}

const BIRTHDAY_WINDOW_DAYS = 60
export const BIRTHDAY_NOTIFY_DAYS = 4

export function useUpcomingBirthdays(userId: string, open: boolean) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch without agent_id filter — include leads assigned to this
      // consultor AND leads with no agent yet (e.g. freshly created by the
      // consultor but not self-assigned). Scope enforced client-side below.
      const res = await fetch(`/api/leads?limit=200`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      const all: Lead[] = json.data ?? []
      setLeads(
        all.filter((l) => l.agent_id === userId || l.agent_id == null),
      )
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const upcoming = useMemo<UpcomingBirthday[]>(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const result: UpcomingBirthday[] = []

    for (const l of leads) {
      if (!l.data_nascimento) continue
      let birth: Date
      try {
        birth = parse(l.data_nascimento.slice(0, 10), 'yyyy-MM-dd', new Date())
      } catch {
        continue
      }
      if (Number.isNaN(birth.getTime())) continue

      let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
      if (next < today) {
        next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate())
      }

      const daysUntil = differenceInCalendarDays(next, today)
      if (daysUntil > BIRTHDAY_WINDOW_DAYS) continue

      const age = next.getFullYear() - birth.getFullYear()

      result.push({
        ...l,
        nextBirthday: next,
        daysUntil,
        age: Number.isFinite(age) && age > 0 && age < 130 ? age : null,
      })
    }

    return result.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [leads])

  return { upcoming, loading }
}

export function BirthdaysSheet({
  userId,
  open,
  onOpenChange,
}: BirthdaysSheetProps) {
  const isMobile = useIsMobile()
  const { upcoming, loading } = useUpcomingBirthdays(userId, open)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 gap-0 flex-row items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Cake className="h-4 w-4 shrink-0 text-pink-600 dark:text-pink-400" />
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight truncate">
                Próximos aniversários
              </SheetTitle>
            </div>
            <SheetDescription className="sr-only">
              Próximos aniversários dos teus contactos
            </SheetDescription>
            {!loading && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {upcoming.length}{' '}
                {upcoming.length === 1 ? 'aniversário' : 'aniversários'} nos
                próximos {BIRTHDAY_WINDOW_DAYS} dias
              </p>
            )}
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 shrink-0"
          >
            <Link href="/dashboard/leads" onClick={() => onOpenChange(false)}>
              Ver contactos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5 pt-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Gift className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Sem aniversários próximos</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {upcoming.map((b) => (
                <BirthdayRow
                  key={b.id}
                  birthday={b}
                  onOpen={() => onOpenChange(false)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function BirthdayRow({
  birthday,
  onOpen,
}: {
  birthday: UpcomingBirthday
  onOpen: () => void
}) {
  const { daysUntil, nextBirthday, age } = birthday
  const isNotify = daysUntil <= BIRTHDAY_NOTIFY_DAYS

  const chip =
    daysUntil === 0
      ? { label: 'Hoje', class: 'bg-pink-400/80 text-white' }
      : daysUntil === 1
      ? { label: 'Amanhã', class: 'bg-pink-300/80 text-white' }
      : isNotify
      ? {
          label: `${daysUntil}d`,
          class: 'bg-pink-100/80 text-pink-700 dark:bg-pink-500/20 dark:text-pink-200',
        }
      : {
          label: `${daysUntil}d`,
          class: 'bg-muted/60 text-foreground/80',
        }

  return (
    <Link
      href={`/dashboard/leads/${birthday.id}`}
      onClick={onOpen}
      className={cn(
        'flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/40',
        isNotify && 'bg-pink-50/40 dark:bg-pink-500/[0.06]',
      )}
    >
      <div
        className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
          isNotify
            ? 'bg-pink-400/80 text-white'
            : 'bg-muted/60 text-muted-foreground',
        )}
      >
        <Cake className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {birthday.nome || 'Sem nome'}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {format(nextBirthday, "d 'de' MMM", { locale: pt })}
          {age != null && ` · ${age} anos`}
          {birthday.telemovel && (
            <>
              {' · '}
              <span className="inline-flex items-center gap-0.5">
                <Phone className="h-2.5 w-2.5" />
                {birthday.telemovel}
              </span>
            </>
          )}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full',
          chip.class,
        )}
      >
        {chip.label}
      </span>
    </Link>
  )
}
