'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GoalStatusIndicator } from './goal-status-indicator'
import type { DailyActions, GoalStatus } from '@/types/goal'
import type { GoalActivity } from '@/types/goal'

interface GoalDailyActionsProps {
  targets: DailyActions
  todayActivities: GoalActivity[]
}

export function GoalDailyActions({ targets, todayActivities }: GoalDailyActionsProps) {
  const today = new Date().toISOString().split('T')[0]
  const todayActs = todayActivities.filter(a => a.activity_date === today)

  const metrics = [
    {
      label: 'Leads a contactar',
      target: targets.leads_to_contact,
      done: todayActs.filter(a => a.activity_type === 'lead_contact').length,
      statusKey: 'leads',
    },
    {
      label: 'Chamadas',
      target: targets.calls_minimum,
      done: todayActs.filter(a => a.activity_type === 'call').length,
      statusKey: 'calls',
    },
    {
      label: 'Visitas (semana)',
      target: targets.visits_to_schedule,
      done: todayActs.filter(a => a.activity_type === 'visit').length,
      statusKey: 'visits',
    },
    {
      label: 'Follow-ups',
      target: targets.follow_ups,
      done: todayActs.filter(a => a.activity_type === 'follow_up').length,
      statusKey: 'follow_ups',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ações de Hoje</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Métrica</TableHead>
              <TableHead className="text-right">Objetivo</TableHead>
              <TableHead className="text-right">Feito</TableHead>
              <TableHead className="w-[60px] text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m) => (
              <TableRow key={m.label}>
                <TableCell className="font-medium">{m.label}</TableCell>
                <TableCell className="text-right tabular-nums">{m.target}</TableCell>
                <TableCell className="text-right tabular-nums">{m.done}</TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <GoalStatusIndicator
                      status={(targets.status[m.statusKey] as GoalStatus) || 'red'}
                      size="md"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
