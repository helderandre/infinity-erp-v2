'use client'

import { Pencil } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { CourseEditorBody } from './course-editor-body'

interface Props {
  courseId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after any mutation so the host list can refresh. */
  onChanged?: () => void
}

/**
 * Sheet "Editar formação" — o mesmo editor da página
 * `/gestao/[id]/editar` (detalhes + conteúdo) apresentado num Sheet
 * glassmorphic, sem navegar para outra página.
 */
export function CourseEditSheet({ courseId, open, onOpenChange, onChanged }: Props) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[92dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-3xl sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}
        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base pr-8">
            <Pencil className="h-5 w-5" />
            Editar formação
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Detalhes e conteúdo do curso.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {courseId && (
            <CourseEditorBody courseId={courseId} embedded onChanged={onChanged} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
