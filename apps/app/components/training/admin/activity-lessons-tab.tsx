'use client'

import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { CourseActivityLessonRow } from '@/types/training'

interface Props {
  lessons: CourseActivityLessonRow[]
}

function formatSeconds(s: number): string {
  if (!s || s < 60) return `${Math.round(s)}s`
  const mins = Math.round(s / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`
}

const SOURCE_LABELS: Record<string, string> = {
  auto_watch: 'Auto (≥90%)',
  manual: 'Manual',
  admin_override: 'Override',
  quiz_pass: 'Quiz',
  unknown: 'Desconhecido',
}

export function ActivityLessonsTab({ lessons }: Props) {
  if (lessons.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Sem lições.</p>
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Lição</TableHead>
            <TableHead>Módulo</TableHead>
            <TableHead className="text-right">Vistos</TableHead>
            <TableHead className="text-right">% média</TableHead>
            <TableHead className="text-right">Tempo médio</TableHead>
            <TableHead className="text-right">Concluídos</TableHead>
            <TableHead>Origem da conclusão</TableHead>
            <TableHead className="text-right">Reports</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lessons.map((l) => {
            const totalSources = Object.values(l.completion_by_source).reduce((a, b) => a + b, 0)
            return (
              <TableRow key={l.lesson_id}>
                <TableCell className="text-muted-foreground">{l.order_index + 1}</TableCell>
                <TableCell>
                  <div className="font-medium truncate max-w-[260px]">{l.title}</div>
                  <div className="text-xs text-muted-foreground">{l.content_type}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.module_title}</TableCell>
                <TableCell className="text-right tabular-nums">{l.total_viewed}</TableCell>
                <TableCell className="text-right tabular-nums">{l.avg_watch_percent}%</TableCell>
                <TableCell className="text-right tabular-nums">{formatSeconds(l.avg_time_spent_seconds)}</TableCell>
                <TableCell className="text-right tabular-nums">{l.completed_count}</TableCell>
                <TableCell>
                  {totalSources === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(l.completion_by_source)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-[10px] px-1.5 py-0">
                            {SOURCE_LABELS[k] ?? k}: {v}
                          </Badge>
                        ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.reports_count > 0
                    ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{l.reports_count}</Badge>
                    : <span className="text-muted-foreground">0</span>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
