// @ts-nocheck
'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { TrainingFilters } from '@/components/training/training-filters'
import { CourseCard } from '@/components/training/course-card'
import { CourseCreateDialog } from '@/components/training/admin/course-create-dialog'
import {
  GraduationCap,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Plus,
  Settings2,
  LayoutGrid,
} from 'lucide-react'
import { useTrainingCourses } from '@/hooks/use-training-courses'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 12

interface Category {
  id: string
  name: string
  color?: string
}

const TABS = [
  { key: 'catalogo' as const, label: 'Catálogo', icon: LayoutGrid },
  { key: 'meus-cursos' as const, label: 'Os Meus Cursos', icon: BookOpen },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function FormacoesPage() {
  return (
    <Suspense fallback={<FormacoesPageSkeleton />}>
      <FormacoesPageContent />
    </Suspense>
  )
}

function FormacoesPageSkeleton() {
  return (
    <div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="mt-6 flex items-center gap-2">
        <Skeleton className="h-9 w-60 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border overflow-hidden">
            <Skeleton className="h-40 w-full" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormacoesPageContent() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('catalogo')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [mandatoryCourses, setMandatoryCourses] = useState<number>(0)

  // My courses state (separate from catalogue)
  const [myCourses, setMyCourses] = useState<any[]>([])
  const [myCoursesTotal, setMyCoursesTotal] = useState(0)
  const [myCoursesLoading, setMyCoursesLoading] = useState(false)

  // Filtros
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([])
  const [page, setPage] = useState(0)

  const isMyCourses = activeTab === 'meus-cursos'

  // Catalogue hook
  const {
    courses: catalogueCourses,
    total: catalogueTotal,
    isLoading: catalogueLoading,
  } = useTrainingCourses({
    search,
    categoryId: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
    difficulty: selectedDifficulties.length > 0 ? selectedDifficulties.join(',') : undefined,
    page: page + 1,
    perPage: PAGE_SIZE,
  })

  // My courses fetch
  const loadMyCourses = useCallback(async () => {
    setMyCoursesLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('page', String(page + 1))
      params.set('limit', String(PAGE_SIZE))

      const res = await fetch(`/api/training/my-courses?${params.toString()}`)
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      const items = data.data || data || []
      setMyCourses(items.map?.((e: any) => ({ ...e.course, enrollment: e })) || [])
      setMyCoursesTotal(data.total || items.length || 0)
    } catch {
      setMyCourses([])
      setMyCoursesTotal(0)
    } finally {
      setMyCoursesLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    if (isMyCourses) loadMyCourses()
  }, [isMyCourses, loadMyCourses])

  const courses = isMyCourses ? myCourses : catalogueCourses
  const total = isMyCourses ? myCoursesTotal : catalogueTotal
  const isLoading = isMyCourses ? myCoursesLoading : catalogueLoading

  const hasActiveFilters =
    search !== '' || selectedCategories.length > 0 || selectedDifficulties.length > 0

  // Carregar categorias
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/training/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.data || data || [])
      }
    } catch {
      // silently fail
    }
  }, [])

  // Verificar formações obrigatórias pendentes
  const checkMandatory = useCallback(async () => {
    try {
      const res = await fetch('/api/training/my-courses?status=in_progress')
      if (res.ok) {
        const data = await res.json()
        const enrollments = data.data || data || []
        const mandatory = enrollments.filter(
          (e: { course?: { is_mandatory?: boolean } }) => e.course?.is_mandatory
        )
        setMandatoryCourses(mandatory.length)
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadCategories()
    checkMandatory()
  }, [loadCategories, checkMandatory])

  // Reset page when filters or tab change
  useEffect(() => {
    setPage(0)
  }, [search, selectedCategories, selectedDifficulties, activeTab])

  const clearFilters = () => {
    setSearch('')
    setSelectedCategories([])
    setSelectedDifficulties([])
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Formação
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Formações
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Plataforma de formação e desenvolvimento contínuo
          </p>
        </div>
        {/* Action buttons */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20"
            onClick={() => router.push('/dashboard/formacoes/gestao')}
          >
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            Gestão
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova Formação
          </Button>
        </div>
      </div>

      {/* ─── Pill Toggle Navigation ─── */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {TABS.map((tab) => {
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

      {/* ─── Content ─── */}
      <div className="mt-6 pb-6">
        <div key={activeTab} className="animate-in fade-in duration-300 space-y-5">
          {/* Banner de formações obrigatórias pendentes */}
          {!isMyCourses && mandatoryCourses > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Formações Obrigatórias Pendentes
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Tem {mandatoryCourses} formação{mandatoryCourses !== 1 ? 'ões' : ''} obrigatória{mandatoryCourses !== 1 ? 's' : ''} em progresso.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
                onClick={() => setActiveTab('meus-cursos')}
              >
                Ver Cursos
              </Button>
            </div>
          )}

          {/* Filtros */}
          <TrainingFilters
            search={search}
            onSearchChange={setSearch}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            selectedDifficulties={selectedDifficulties}
            onDifficultiesChange={setSelectedDifficulties}
            categories={categories}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Grid de cursos */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg border overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex items-center justify-between pt-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={isMyCourses ? 'Nenhuma inscrição encontrada' : 'Nenhuma formação encontrada'}
              description={
                hasActiveFilters
                  ? 'Tente ajustar os critérios de pesquisa'
                  : isMyCourses
                    ? 'Ainda não está inscrito em nenhuma formação'
                    : 'Ainda não existem formações disponíveis'
              }
              action={
                hasActiveFilters
                  ? { label: 'Limpar Filtros', onClick: clearFilters }
                  : isMyCourses
                    ? { label: 'Ver Catálogo', onClick: () => setActiveTab('catalogo') }
                    : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onClick={() => router.push(`/dashboard/formacoes/cursos/${course.id}`)}
                    showProgress={isMyCourses}
                  />
                ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-muted-foreground">
                    {total} formação{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-full"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-full"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Shared Nova Formação sheet (same used in gestão page) */}
      <CourseCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  )
}
