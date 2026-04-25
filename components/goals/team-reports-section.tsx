'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react'
import { TeamWeekCard } from '@/components/goals/team-week-card'
import { TeamBriefingPanel } from '@/components/goals/team-briefing-panel'
import { useTeamWeek } from '@/hooks/use-team-week'

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function formatWeekRange(monday: string): string {
  const start = new Date(monday)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  return `${start.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} — ${end.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

export function TeamReportsSection() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const { data, isLoading, refetch, briefing, isBriefingLoading, generateBriefing } = useTeamWeek(weekStart)

  const navigateWeek = (dir: -1 | 1) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const handleReview = async (reportId: string, feedback: string) => {
    const res = await fetch(`/api/goals/weekly-reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_feedback: feedback }),
    })
    if (!res.ok) throw new Error('Erro ao enviar feedback')
    refetch()
  }

  return (
    <div className="space-y-5">
      {/* Week navigator */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)} className="rounded-full h-8 w-8 shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 rounded-full bg-muted/60 px-3 sm:px-4 py-1.5 min-w-0">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate">{formatWeekRange(weekStart)}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)} disabled={weekStart >= getMonday(new Date())} className="rounded-full h-8 w-8 shrink-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <TeamBriefingPanel
            briefing={briefing}
            isLoading={isBriefingLoading}
            onGenerate={generateBriefing}
          />

          {data?.reports && data.reports.length > 0 ? (
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b">
                <h3 className="text-sm font-semibold">Consultores</h3>
              </div>
              <div className="divide-y">
                {data.reports.map(row => (
                  <TeamWeekCard
                    key={row.consultant_id}
                    consultantName={row.commercial_name}
                    report={row.report}
                    activities={row.activities}
                    pipelineValue={row.pipeline_value}
                    leadSources={row.lead_sources}
                    trustRatio={row.trust_ratio}
                    onReview={handleReview}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-white p-16 text-center shadow-sm">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Nenhum consultor com objectivos activos para {new Date(weekStart).getFullYear()}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
