// @ts-nocheck
'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { TrainingFilters } from '@/components/training/training-filters'
import { CourseCard } from '@/components/training/course-card'
import { TrainingNotificationsDropdown } from '@/components/training/training-notifications-dropdown'
import {
  GraduationCap,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Plus,
  Settings2,
} from 'lucide-react'
import { useTrainingCourses } from '@/hooks/use-training-courses'
import { toast } from 'sonner'

const PAGE_SIZE = 12

interface Category {
  id: string
  name: string
}

export default function FormacoesPage() {
  return (
    <Suspense fallback={<FormacoesPageSkeleton />}>
      <FormacoesPageContent />
    </Suspense>
  )
}

function FormacoesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
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
    </div>
  )
}

function FormacoesPageContent() {
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [mandatoryCourses, setMandatoryCourses] = useState<number>(0)

  // Filtros
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [page, setPage] = useState(0)

  const {
    courses,
    total,
    isLoading,
    refetch,
  } = useTrainingCourses({
    search,
    categoryId: categoryId !== 'all' ? categoryId : undefined,
    difficulty: difficulty !== 'all' ? difficulty : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  const hasActiveFilters =
    search !== '' || categoryId !== 'all' || difficulty !== 'all'

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

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [search, categoryId, difficulty])

  const clearFilters = () => {
    setSearch('')
    setCategoryId('all')
    setDifficulty('all')
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formações</h1>
          <p className="text-muted-foreground">
            Plataforma de formação e desenvolvimento contínuo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/formacoes/meus-cursos')}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Os Meus Cursos
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/formacoes/gestao')}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Gestão
          </Button>
          <Button
            onClick={() => router.push('/dashboard/formacoes/gestao/novo')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Formação
          </Button>
          <TrainingNotificationsDropdown />
        </div>
      </div>

      {/* Banner de formações obrigatórias pendentes */}
      {mandatoryCourses > 0 && (
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
            onClick={() => router.push('/dashboard/formacoes/meus-cursos')}
          >
            Ver Cursos
          </Button>
        </div>
      )}

      {/* Filtros */}
      <TrainingFilters
        search={search}
        onSearchChange={setSearch}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        categories={categories}
        onClearFilters={clearFilters}
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
          title="Nenhuma formação encontrada"
          description={
            hasActiveFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Ainda não existem formações disponíveis'
          }
          action={
            hasActiveFilters
              ? { label: 'Limpar Filtros', onClick: clearFilters }
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
              />
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} formação{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
