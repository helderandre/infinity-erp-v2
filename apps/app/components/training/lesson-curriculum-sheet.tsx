'use client'

import { useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LessonSidebar } from './lesson-sidebar'

interface LessonCurriculumSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modules: React.ComponentProps<typeof LessonSidebar>['modules']
  currentLessonId: string
  courseId: string
  courseTitle: string
  progressPercent: number
}

/**
 * Bottom sheet that surfaces the full course curriculum (modules + lessons) on
 * mobile — the desktop sidebar isn't shown on phones. Reuses <LessonSidebar>.
 * Closes itself whenever the current lesson changes (i.e. after navigating).
 */
export function LessonCurriculumSheet({
  open,
  onOpenChange,
  modules,
  currentLessonId,
  courseId,
  courseTitle,
  progressPercent,
}: LessonCurriculumSheetProps) {
  // Auto-close after the user picks a lesson (route param changes).
  useEffect(() => {
    onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85dvh] rounded-t-3xl p-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-2xl"
      >
        <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="px-4 pt-6 pb-2 shrink-0">
          <SheetTitle className="text-base">Aulas</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <LessonSidebar
            modules={modules}
            currentLessonId={currentLessonId}
            courseId={courseId}
            courseTitle={courseTitle}
            progressPercent={progressPercent}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
