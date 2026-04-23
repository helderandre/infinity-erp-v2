'use client'

import { Users, PlayCircle, CheckCircle2, Gauge, Clock, Award, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { CourseActivityPayload } from '@/types/training'

interface Props {
  payload: CourseActivityPayload
}

function formatSeconds(s: number): string {
  if (!s || s < 60) return `${Math.round(s)}s`
  const mins = Math.round(s / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`
}

export function ActivitySummaryTab({ payload }: Props) {
  const { summary, course } = payload
  const items = [
    { icon: Users, label: 'Inscritos', value: summary.total_enrolled, tone: 'text-sky-600' },
    { icon: PlayCircle, label: 'Em progresso', value: summary.in_progress, tone: 'text-blue-600' },
    { icon: CheckCircle2, label: 'Concluídos', value: summary.completed, tone: 'text-emerald-600' },
    { icon: Gauge, label: '% média de progresso', value: `${summary.avg_progress_percent}%`, tone: 'text-violet-600' },
    { icon: Clock, label: 'Tempo médio assistido', value: formatSeconds(summary.avg_time_spent_seconds), tone: 'text-amber-600' },
    { icon: Award, label: 'Certificados emitidos', value: summary.certificates_issued, tone: 'text-teal-600' },
    { icon: AlertTriangle, label: 'Reports abertos', value: summary.open_reports, tone: 'text-rose-600' },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(({ icon: Icon, label, value, tone }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${tone}`} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="text-lg font-semibold truncate">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Curso: <strong>{course.title}</strong> — {course.total_modules} módulos, {course.total_lessons} lições, {course.total_quizzes} quizzes.
      </p>
    </div>
  )
}
