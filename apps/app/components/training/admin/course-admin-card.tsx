// @ts-nocheck
'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CourseCard } from '@/components/training/course-card'
import { TRAINING_COURSE_STATUS_OPTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { MoreHorizontal, Pencil, Eye, Globe, Archive } from 'lucide-react'
import type { TrainingCourse } from '@/types/training'

interface CourseAdminCardProps {
  course: TrainingCourse
  onPublish: (id: string) => void
  onArchive: (id: string) => void
}

export function CourseAdminCard({ course, onPublish, onArchive }: CourseAdminCardProps) {
  const router = useRouter()
  const statusOpt = TRAINING_COURSE_STATUS_OPTIONS.find(s => s.value === course.status)

  return (
    <div className="relative group">
      <CourseCard
        course={course}
        onClick={() => router.push(`/dashboard/formacoes/gestao/${course.id}/editar`)}
      />

      {/* Status badge overlay (top-right, over card) */}
      <Badge
        variant="outline"
        className={cn(
          'absolute top-2 right-2 z-10 rounded-full text-[10px] px-2 py-0.5 backdrop-blur-sm',
          course.status === 'published' && 'bg-emerald-500/90 text-white border-transparent',
          course.status === 'draft' && 'bg-slate-600/90 text-white border-transparent',
          course.status === 'archived' && 'bg-amber-500/90 text-white border-transparent',
        )}
      >
        {statusOpt?.label || course.status}
      </Badge>

      {/* Actions dropdown (appears on hover) */}
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow-sm backdrop-blur-sm bg-white/90 dark:bg-neutral-800/90">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => router.push(`/dashboard/formacoes/gestao/${course.id}/editar`)}>
              <Pencil className="h-4 w-4 mr-2" />Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/dashboard/formacoes/cursos/${course.id}`)}>
              <Eye className="h-4 w-4 mr-2" />Pré-visualizar
            </DropdownMenuItem>
            {course.status === 'draft' && (
              <DropdownMenuItem onClick={() => onPublish(course.id)}>
                <Globe className="h-4 w-4 mr-2" />Publicar
              </DropdownMenuItem>
            )}
            {course.status !== 'archived' && (
              <DropdownMenuItem onClick={() => onArchive(course.id)} className="text-red-600">
                <Archive className="h-4 w-4 mr-2" />Arquivar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
