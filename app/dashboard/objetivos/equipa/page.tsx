'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Users, CheckCircle, Send, Clock } from 'lucide-react'
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

export default function EquipaPage() {
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

  const totalConsultants = data?.reports.length || 0
  const submitted = data?.reports.filter(r => r.report?.status === 'submitted' || r.report?.status === 'reviewed').length || 0
  const reviewed = data?.reports.filter(r => r.report?.status === 'reviewed').length || 0
  const pending = totalConsultants - submitted

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/objetivos" className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Equipa — Visão Semanal</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acompanha os relatórios e actividades de cada consultor
            </p>
          </div>
        </div>
        {/* Week navigator */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)} className="rounded-full h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-full bg-muted/60 px-4 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{formatWeekRange(weekStart)}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)} disabled={weekStart >= getMonday(new Date())} className="rounded-full h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Summary cards — Finexy style */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl bg-orange-500 text-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-white/80">Consultores</p>
                <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-bold truncate">{totalConsultants}</p>
              <p className="text-xs text-white/70 mt-1">Com objectivos activos</p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">Submetidos</p>
                <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Send className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-bold truncate">{submitted}</p>
              <p className="text-xs text-muted-foreground mt-1">de {totalConsultants} consultores</p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">Revistos</p>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-bold truncate">{reviewed}</p>
              <p className="text-xs text-muted-foreground mt-1">com feedback enviado</p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
                <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <p className="text-xl sm:text-3xl font-bold truncate">{pending}</p>
              <p className="text-xs text-muted-foreground mt-1">sem relatório</p>
            </div>
          </div>

          {/* AI Briefing */}
          <TeamBriefingPanel
            briefing={briefing}
            isLoading={isBriefingLoading}
            onGenerate={generateBriefing}
          />

          {/* Consultant list */}
          {data?.reports && data.reports.length > 0 ? (
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-sm font-semibold">Consultores</h2>
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
