'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BookOpen,
  Users,
  TrendingUp,
  Award,
  BarChart3,
} from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { TrainingOverviewStats } from '@/types/training'

interface TrainingStatsOverviewProps {
  stats: TrainingOverviewStats | null
  isLoading: boolean
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

export function TrainingStatsOverview({
  stats,
  isLoading,
}: TrainingStatsOverviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Cursos"
          value={stats.total_courses}
          icon={<BookOpen className="h-5 w-5" />}
          description={`${stats.total_published_courses} publicados`}
        />
        <StatCard
          title="Inscricoes"
          value={stats.total_enrollments}
          icon={<Users className="h-5 w-5" />}
          description={`${stats.total_completions} concluidas`}
        />
        <StatCard
          title="Taxa de Conclusao"
          value={`${Math.round(stats.average_completion_rate)}%`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Nota Media"
          value={`${Math.round(stats.average_quiz_score)}%`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title="Certificados"
          value={stats.total_certificates_issued}
          icon={<Award className="h-5 w-5" />}
        />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top courses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cursos Mais Populares</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.top_courses.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sem dados disponiveis.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Curso</TableHead>
                    <TableHead className="text-right">Inscricoes</TableHead>
                    <TableHead className="text-right">Conclusao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.top_courses.map((course) => (
                    <TableRow key={course.course_id}>
                      <TableCell className="font-medium">
                        {course.title}
                      </TableCell>
                      <TableCell className="text-right">
                        {course.enrollments}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round(course.completion_rate)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent completions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conclusoes Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recent_completions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sem conclusoes recentes.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recent_completions.map((completion, i) => (
                  <div
                    key={`${completion.user_id}-${i}`}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {completion.user_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {completion.course_title}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        new Date(completion.completed_at),
                        "d 'de' MMM yyyy",
                        { locale: pt }
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
