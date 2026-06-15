// @ts-nocheck
'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { CourseEditorBody, CourseEditorSkeleton } from '@/components/training/admin/course-editor-body'

export default function EditarCursoPage() {
  return (
    <Suspense fallback={<CourseEditorSkeleton />}>
      <EditarCursoContent />
    </Suspense>
  )
}

function EditarCursoContent() {
  const params = useParams()
  const courseId = params.id as string
  return <CourseEditorBody courseId={courseId} />
}
