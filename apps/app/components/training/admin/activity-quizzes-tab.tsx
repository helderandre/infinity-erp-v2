'use client'

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { CourseActivityQuizRow } from '@/types/training'

interface Props {
  quizzes: CourseActivityQuizRow[]
}

export function ActivityQuizzesTab({ quizzes }: Props) {
  if (quizzes.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Este curso ainda não tem quizzes.</p>
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quiz</TableHead>
            <TableHead className="text-right">Tentativas</TableHead>
            <TableHead className="text-right">Utilizadores únicos</TableHead>
            <TableHead className="text-right">% Aprovação</TableHead>
            <TableHead className="text-right">Nota média</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quizzes.map((q) => (
            <TableRow key={q.quiz_id}>
              <TableCell className="font-medium">{q.title}</TableCell>
              <TableCell className="text-right tabular-nums">{q.attempts_count}</TableCell>
              <TableCell className="text-right tabular-nums">{q.unique_attempters}</TableCell>
              <TableCell className="text-right tabular-nums">{q.pass_rate}%</TableCell>
              <TableCell className="text-right tabular-nums">{q.avg_score}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
