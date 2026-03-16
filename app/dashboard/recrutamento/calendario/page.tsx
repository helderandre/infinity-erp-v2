"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns"
import { pt } from "date-fns/locale/pt"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Video,
  Phone,
  MapPin,
  Clock,
  User,
  ExternalLink,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { getAllInterviews } from "@/app/dashboard/recrutamento/actions"
import { INTERVIEW_FORMATS } from "@/types/recruitment"
import type { InterviewFormat } from "@/types/recruitment"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarInterview {
  id: string
  candidate_id: string
  candidate_name: string
  interview_date: string
  format: InterviewFormat
  interviewer_name: string | null
  follow_up_date: string | null
  interview_number: number
  notes: string | null
}

// ─── Format Icon ──────────────────────────────────────────────────────────────

function FormatIcon({ fmt, className }: { fmt: InterviewFormat; className?: string }) {
  switch (fmt) {
    case "in_person":
      return <MapPin className={className} />
    case "video_call":
      return <Video className={className} />
    case "phone":
      return <Phone className={className} />
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function CalendarioEntrevistasPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [interviews, setInterviews] = useState<CalendarInterview[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const fetchInterviews = useCallback(async (month: Date) => {
    setLoading(true)
    const start = startOfMonth(month).toISOString()
    const end = endOfMonth(month).toISOString()
    const result = await getAllInterviews(start, end)
    if (result.error) {
      toast.error("Erro ao carregar entrevistas")
    } else {
      setInterviews(result.interviews)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInterviews(currentMonth)
  }, [currentMonth, fetchInterviews])

  // Calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  // Map interviews by date
  const interviewsByDate = useMemo(() => {
    const map: Record<string, CalendarInterview[]> = {}
    for (const iv of interviews) {
      const dateKey = iv.interview_date.substring(0, 10)
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(iv)
    }
    return map
  }, [interviews])

  // Follow-up dates
  const followUpDates = useMemo(() => {
    const set = new Set<string>()
    for (const iv of interviews) {
      if (iv.follow_up_date) set.add(iv.follow_up_date.substring(0, 10))
    }
    return set
  }, [interviews])

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, "yyyy-MM-dd")
    return interviewsByDate[key] ?? []
  }, [selectedDate, interviewsByDate])

  const selectedFollowUps = useMemo(() => {
    if (!selectedDate) return [] as CalendarInterview[]
    const key = format(selectedDate, "yyyy-MM-dd")
    return interviews.filter(
      (iv) => iv.follow_up_date && iv.follow_up_date.substring(0, 10) === key
    )
  }, [selectedDate, interviews])

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendario de Entrevistas</h1>
        <p className="text-muted-foreground text-sm">
          Visualize todas as entrevistas e follow-ups agendados
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Calendar Grid */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: pt })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <CalendarSkeleton />
            ) : (
              <>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                  {weekDays.map((d) => (
                    <div key={d} className="text-muted-foreground py-2 text-center text-xs font-medium">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd")
                    const inMonth = isSameMonth(day, currentMonth)
                    const today = isToday(day)
                    const selected = selectedDate ? isSameDay(day, selectedDate) : false
                    const hasInterviews = !!interviewsByDate[dateKey]
                    const hasFollowUp = followUpDates.has(dateKey)

                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "relative flex flex-col items-center justify-center rounded-lg border border-transparent py-3 text-sm transition-colors hover:bg-muted",
                          !inMonth && "text-muted-foreground/40",
                          today && "font-bold",
                          selected && "border-primary bg-primary/5 font-semibold"
                        )}
                      >
                        <span>{format(day, "d")}</span>
                        {/* Dots */}
                        {(hasInterviews || hasFollowUp) && (
                          <div className="mt-0.5 flex gap-0.5">
                            {hasInterviews && <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />}
                            {hasFollowUp && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-purple-500" /> Entrevista
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Follow-up
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="flex flex-col gap-4">
          {selectedDate ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4" />
                    {format(selectedDate, "d 'de' MMMM, yyyy", { locale: pt })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {selectedEvents.length === 0 && selectedFollowUps.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      Sem eventos neste dia
                    </p>
                  ) : (
                    <>
                      {/* Interviews */}
                      {selectedEvents.map((ev) => (
                        <div key={ev.id} className="flex flex-col gap-2 rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-sm">{ev.candidate_name}</p>
                              <p className="text-muted-foreground text-xs">
                                Entrevista #{ev.interview_number}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              <FormatIcon fmt={ev.format} className="mr-1 h-3 w-3" />
                              {INTERVIEW_FORMATS[ev.format]}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(ev.interview_date), "HH:mm")}
                            </span>
                            {ev.interviewer_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {ev.interviewer_name}
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/dashboard/recrutamento/${ev.candidate_id}`}
                            className="text-primary mt-1 flex items-center gap-1 text-xs font-medium hover:underline"
                          >
                            Ver candidato <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      ))}
                      {/* Follow-ups */}
                      {selectedFollowUps.map((ev) => (
                        <div key={`fu-${ev.id}`} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-sm">{ev.candidate_name}</p>
                              <p className="text-xs text-amber-700">Follow-up pendente</p>
                            </div>
                            <Badge className="shrink-0 bg-amber-100 text-amber-800 text-xs">
                              Follow-up
                            </Badge>
                          </div>
                          <Link
                            href={`/dashboard/recrutamento/${ev.candidate_id}`}
                            className="text-primary mt-1 flex items-center gap-1 text-xs font-medium hover:underline"
                          >
                            Ver candidato <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="text-muted-foreground mb-3 h-10 w-10" />
                <p className="text-muted-foreground text-sm">
                  Seleccione um dia para ver os eventos
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="mx-auto h-4 w-8" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="mx-auto h-10 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}
