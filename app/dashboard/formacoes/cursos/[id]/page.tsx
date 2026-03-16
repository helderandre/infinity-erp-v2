'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, BookOpen, Clock, FileText, Award, User, Tag, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CourseDetailHeader } from '@/components/training/course-detail-header'
import { CourseCurriculum } from '@/components/training/course-curriculum'
import { useTrainingBookmarks } from '@/hooks/use-training-bookmarks'
import { TRAINING_DIFFICULTY_COLORS, formatDate } from '@/lib/constants'
import { toast } from 'sonner'
import type { TrainingCourse } from '@/types/training'

export default function CourseDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CourseDetailContent />
    </Suspense>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    </div>
  )
}

function CourseDetailContent() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const [course, setCourse] = useState<TrainingCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const { isBookmarked, toggleBookmark } = useTrainingBookmarks()

  const fetchCourse = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}`)
      if (!res.ok) throw new Error('Erro ao carregar formação')
      const data = await res.json()
      setCourse(data)
    } catch {
      toast.error('Erro ao carregar formação')
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => { fetchCourse() }, [fetchCourse])

  const handleEnroll = async () => {
    setIsEnrolling(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}/enroll`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao inscrever')
      }
      toast.success('Inscrição realizada com sucesso!')
      fetchCourse()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao inscrever')
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleContinue = () => {
    if (course?.modules?.[0]?.lessons?.[0]) {
      const firstIncomplete = course.modules
        .flatMap(m => m.lessons || [])
        .find(l => l.progress?.status !== 'completed')
      const targetLesson = firstIncomplete || course.modules[0].lessons![0]
      router.push(`/dashboard/formacoes/cursos/${courseId}/licoes/${targetLesson.id}`)
    }
  }

  if (isLoading) return <PageSkeleton />
  if (!course) return (
    <div className="flex flex-col items-center justify-center py-16">
      <h3 className="text-lg font-semibold">Formação não encontrada</h3>
      <Button className="mt-4" asChild><Link href="/dashboard/formacoes">Voltar</Link></Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/formacoes"><ChevronLeft className="h-4 w-4 mr-1" />Voltar ao Catálogo</Link>
      </Button>

      <CourseDetailHeader
        course={course}
        onEnroll={handleEnroll}
        onContinue={handleContinue}
        onBookmark={() => toggleBookmark({ course_id: courseId })}
        isBookmarked={isBookmarked(courseId)}
        isEnrolling={isEnrolling}
      />

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="about">Sobre</TabsTrigger>
          {course.has_certificate && <TabsTrigger value="certificate">Certificado</TabsTrigger>}
        </TabsList>

        <TabsContent value="content" className="mt-4">
          <CourseCurriculum
            modules={course.modules || []}
            enrollment={course.enrollment}
            onLessonClick={(lessonId) => router.push(`/dashboard/formacoes/cursos/${courseId}/licoes/${lessonId}`)}
          />
        </TabsContent>

        <TabsContent value="about" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {course.description && (
                <Card>
                  <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p>
                  </CardContent>
                </Card>
              )}
              {course.tags.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {course.tags.map(tag => (
                      <Badge key={tag} variant="outline"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {course.instructor_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Formador: <strong>{course.instructor_name}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>{course.modules?.length || 0} módulos, {course.modules?.reduce((a, m) => a + (m.lessons?.length || 0), 0) || 0} lições</span>
                  </div>
                  {course.estimated_duration_minutes && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{Math.round(course.estimated_duration_minutes / 60)}h estimadas</span>
                    </div>
                  )}
                  {course.is_mandatory && (
                    <Badge className="bg-amber-500/15 text-amber-500">Obrigatório</Badge>
                  )}
                  {course.has_certificate && (
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span>Com certificado{course.certificate_validity_months ? ` (${course.certificate_validity_months} meses)` : ''}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Publicado: {formatDate(course.published_at)}
                  </div>
                </CardContent>
              </Card>
              {course.prerequisite_course_ids.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Pré-requisitos</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Esta formação tem {course.prerequisite_course_ids.length} pré-requisito{course.prerequisite_course_ids.length > 1 ? 's' : ''}.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {course.has_certificate && (
          <TabsContent value="certificate" className="mt-4">
            <Card>
              <CardContent className="p-8 text-center">
                <Award className="h-16 w-16 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Certificado de Conclusão</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ao concluir esta formação com nota mínima de {course.passing_score}%, receberá um certificado interno.
                  {course.certificate_validity_months && (
                    <> Validade: {course.certificate_validity_months} meses.</>
                  )}
                </p>
                {course.enrollment?.certificate_issued && (
                  <Badge className="bg-emerald-500/15 text-emerald-500 text-base px-4 py-2">
                    <Award className="h-4 w-4 mr-2" />Certificado Emitido
                  </Badge>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
