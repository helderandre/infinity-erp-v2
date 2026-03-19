// @ts-nocheck
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { AlertTriangle, MessageSquare, TrendingUp, Download } from 'lucide-react'
import { useTrainingAdminStats } from '@/hooks/use-training-admin-stats'
import type { ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  count: {
    label: 'Conclusões',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

function formatMonth(month: string) {
  const [, m] = month.split('-')
  return MONTH_LABELS[m] || m
}

interface CompletionOverviewProps {
  courseId?: string
}

export function CompletionOverview({ courseId }: CompletionOverviewProps) {
  const { courseStats, overview, completionByMonth, isLoading } = useTrainingAdminStats()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  const kpis = [
    {
      label: 'Reports Abertos',
      value: overview.total_reports_open,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Comentários Pendentes',
      value: overview.total_comments_unresolved,
      icon: MessageSquare,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Taxa Conclusão Média',
      value: `${overview.avg_completion_rate}%`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Total Downloads',
      value: overview.total_downloads,
      icon: Download,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
    },
  ]

  const chartData = completionByMonth.map((item: any) => ({
    month: formatMonth(item.month),
    count: item.count,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="bg-card/30 backdrop-blur-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-xl p-3 ${kpi.bg}`}>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Completion by Month Chart */}
      {chartData.length > 0 && (
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conclusões por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Course Completion Table */}
      {courseStats.length > 0 && (
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conclusão por Curso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Curso</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Inscritos</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Concluídos</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Taxa (%)</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Progresso Médio (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseStats.map((course: any) => (
                    <TableRow key={course.course_id}>
                      <TableCell className="font-medium max-w-[250px] truncate">{course.title}</TableCell>
                      <TableCell className="text-center">{course.total_enrolled}</TableCell>
                      <TableCell className="text-center">{course.total_completed}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={course.completion_rate || 0} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{course.completion_rate || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{course.avg_progress || 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
