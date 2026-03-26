'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  Award,
  User,
  Tag,
  Lock,
  PlayCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CourseCurriculum } from '@/components/training/course-curriculum'
import { CourseProgressBar } from '@/components/training/course-progress-bar'
import { DifficultyBadge } from '@/components/training/difficulty-badge'
import { BookmarkButton } from '@/components/training/bookmark-button'
import { useTrainingBookmarks } from '@/hooks/use-training-bookmarks'
import { useBreadcrumbSet } from '@/hooks/use-breadcrumb-overrides'
import { formatDate } from '@/lib/constants'
import { cn } from '@/lib/utils'
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
    <div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="mt-6">
        <Skeleton className="h-10 w-72 rounded-full" />
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

const TABS = [
  { key: 'content' as const, label: 'Conteúdo', icon: BookOpen },
  { key: 'about' as const, label: 'Sobre', icon: FileText },
  { key: 'certificate' as const, label: 'Certificado', icon: Award },
] as const

type TabKey = (typeof TABS)[number]['key']

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getResumeLesson(course: TrainingCourse): { id: string; title: string; moduleName?: string } | null {
  const allLessons = (course.modules || [])
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap(m =>
      (m.lessons || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(l => ({ ...l, moduleName: m.title }))
    )

  if (!allLessons.length) return null

  // Find the last accessed lesson (most recent last_accessed_at)
  const accessedLessons = allLessons
    .filter(l => l.progress?.last_accessed_at)
    .sort((a, b) =>
      new Date(b.progress!.last_accessed_at!).getTime() - new Date(a.progress!.last_accessed_at!).getTime()
    )

  if (accessedLessons.length > 0) {
    const last = accessedLessons[0]
    return { id: last.id, title: last.title, moduleName: last.moduleName }
  }

  // No lesson accessed yet — return first incomplete, or first lesson
  const firstIncomplete = allLessons.find(l => l.progress?.status !== 'completed')
  const target = firstIncomplete || allLessons[0]
  return { id: target.id, title: target.title, moduleName: target.moduleName }
}

function CourseDetailContent() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const [course, setCourse] = useState<TrainingCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('content')
  const { isBookmarked, toggleBookmark } = useTrainingBookmarks()

  useBreadcrumbSet(useMemo(() => ({
    ...(course ? { cursos: course.title } : {}),
  }), [course]))

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

  if (isLoading) return <PageSkeleton />
  if (!course) return (
    <div className="flex flex-col items-center justify-center py-16">
      <h3 className="text-lg font-semibold">Formação não encontrada</h3>
      <Link href="/dashboard/formacoes" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"><ArrowLeft className="h-3.5 w-3.5" />Voltar</Link>
    </div>
  )

  const enrollment = course.enrollment
  const isCompleted = enrollment?.status === 'completed'
  const isEnrolled = !!enrollment
  const isInProgress = enrollment?.status === 'in_progress' || enrollment?.status === 'enrolled'
  const instructorName = course.instructor?.commercial_name || course.instructor_name || 'Sem instrutor'
  const categoryColor = course.category?.color || '#6366f1'
  const resumeLesson = getResumeLesson(course)

  const availableTabs = course.has_certificate
    ? TABS
    : TABS.filter(t => t.key !== 'certificate')

  const handleGoToLesson = () => {
    if (resumeLesson) {
      router.push(`/dashboard/formacoes/cursos/${courseId}/licoes/${resumeLesson.id}`)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-6 min-h-[calc(100vh-8rem)]">
      {/* ─── LEFT: Dark Hero Panel ─── */}
      <div className="relative overflow-hidden rounded-xl flex flex-col">
        {/* Background: cover image or gradient */}
        <div className="absolute inset-0">
          {course.cover_image_url ? (
            <>
              <img
                src={course.cover_image_url}
                alt={course.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-neutral-900/40" />
            </>
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `linear-gradient(135deg, ${categoryColor}33, ${categoryColor}66)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/80 via-neutral-900/50 to-neutral-900/70" />
        </div>

        {/* Content */}
        <div className="relative z-10 px-8 py-8 sm:px-10 sm:py-10 flex flex-col flex-1">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/15 hover:bg-white/20 hover:text-white mb-5 -ml-1 w-fit"
          >
            <Link href="/dashboard/formacoes">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Catálogo
            </Link>
          </Button>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {course.title}
          </h1>

          {/* Instructor */}
          <div className="mt-3 flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-white/20">
              <AvatarFallback className="text-xs bg-white/15 text-white">
                {getInitials(instructorName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-neutral-300">{instructorName}</span>
          </div>

          {/* Meta badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {course.category && (
              <Badge
                className="border-transparent text-primary-foreground rounded-full text-[11px]"
                style={{ backgroundColor: categoryColor }}
              >
                {course.category.name}
              </Badge>
            )}

            <DifficultyBadge difficulty={course.difficulty_level} />

            {course.estimated_duration_minutes && (
              <span className="flex items-center gap-1 text-sm text-neutral-400">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(course.estimated_duration_minutes)}
              </span>
            )}

            {course.has_certificate && (
              <Badge variant="outline" className="gap-1 rounded-full border-white/20 bg-white/10 text-white text-[11px]">
                <Award className="h-3 w-3" />
                Certificado
              </Badge>
            )}

            {isCompleted && (
              <Badge className="rounded-full gap-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluído
              </Badge>
            )}

            <BookmarkButton
              isBookmarked={isBookmarked(courseId)}
              onToggle={() => toggleBookmark({ course_id: courseId })}
            />
          </div>

          {/* Progress */}
          {isEnrolled && !isCompleted && (
            <div className="mt-5">
              <CourseProgressBar
                percent={enrollment!.progress_percent}
                size="md"
                showLabel
              />
            </div>
          )}

          {/* Spacer to push CTA to bottom */}
          <div className="flex-1 min-h-6" />

          {/* CTA: Go to lesson */}
          {resumeLesson && !isCompleted && (
            <div className="space-y-2">
              {isEnrolled ? (
                <Button
                  onClick={handleGoToLesson}
                  className="w-full rounded-xl gap-2 bg-white text-neutral-900 hover:bg-white/90 h-12 text-sm font-semibold"
                >
                  <PlayCircle className="h-5 w-5" />
                  Continuar Formação
                </Button>
              ) : (
                <Button
                  onClick={handleEnroll}
                  disabled={isEnrolling}
                  className="w-full rounded-xl gap-2 bg-white text-neutral-900 hover:bg-white/90 h-12 text-sm font-semibold"
                >
                  {isEnrolling ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <PlayCircle className="h-5 w-5" />
                  )}
                  Inscrever-se
                </Button>
              )}
              <p className="text-xs text-neutral-500 text-center truncate">
                {resumeLesson.moduleName && (
                  <span className="text-neutral-600">{resumeLesson.moduleName} · </span>
                )}
                {resumeLesson.title}
              </p>
            </div>
          )}

          {isCompleted && resumeLesson && (
            <Button
              onClick={handleGoToLesson}
              variant="ghost"
              className="w-full rounded-xl gap-2 text-white border border-white/15 hover:bg-white/10 hover:text-white h-12 text-sm"
            >
              <PlayCircle className="h-5 w-5" />
              Rever Formação
            </Button>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Tabs + Content ─── */}
      <div className="flex flex-col min-h-0">
        {/* Pill Toggle Navigation */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
            {availableTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                    isActive
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 pb-6 overflow-y-auto">
          <div key={activeTab} className="animate-in fade-in duration-300">
            {activeTab === 'content' && (
              <CourseCurriculum
                modules={course.modules || []}
                enrollment={course.enrollment}
                onLessonClick={(lessonId) => router.push(`/dashboard/formacoes/cursos/${courseId}/licoes/${lessonId}`)}
              />
            )}

            {activeTab === 'about' && (
              <div className="space-y-6">
                {course.description && (
                  <Card>
                    <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p>
                    </CardContent>
                  </Card>
                )}
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
            )}

            {activeTab === 'certificate' && course.has_certificate && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
