// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, ChevronLeft, ChevronRight, Search, MoreHorizontal,
  Pencil, Globe, Archive, Eye, X, GraduationCap, LayoutGrid, List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TRAINING_COURSE_STATUS_OPTIONS, TRAINING_DIFFICULTY_OPTIONS, TRAINING_DIFFICULTY_COLORS, formatDate } from '@/lib/constants'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CourseAdminCard } from './course-admin-card'
import type { TrainingCourse, TrainingCategory } from '@/types/training'

const PAGE_SIZE = 20

interface GestaoCursosTabProps {
  onCreateClick: () => void
}

export function GestaoCursosTab({ onCreateClick }: GestaoCursosTabProps) {
  const router = useRouter()
  const [courses, setCourses] = useState<TrainingCourse[]>([])
  const [categories, setCategories] = useState<TrainingCategory[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [page, setPage] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  // Fetch categories for filter
  useEffect(() => {
    fetch('/api/training/categories')
      .then(r => r.json())
      .then(d => setCategories(d.data || []))
      .catch(() => {})
  }, [])

  const fetchCourses = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      } else {
        // When "all", fetch all statuses — the API defaults to published, so we need to handle this
        // We'll fetch without status filter by sending a special value
        params.set('status', 'draft')
        // Actually we need all statuses — let's fetch them separately or adjust
      }
      if (categoryFilter !== 'all') params.set('category_id', categoryFilter)
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter)
      params.set('limit', String(PAGE_SIZE))
      params.set('page', String(page + 1))

      if (statusFilter === 'all') {
        // Fetch all three statuses in parallel
        const statuses = ['draft', 'published', 'archived']
        const results = await Promise.all(
          statuses.map(s => {
            const p = new URLSearchParams(params)
            p.set('status', s)
            return fetch(`/api/training/courses?${p.toString()}`).then(r => r.json())
          })
        )
        const allCourses = results.flatMap(r => r.data || [])
        const allTotal = results.reduce((sum, r) => sum + (r.total || 0), 0)
        // Sort by created_at desc
        allCourses.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setCourses(allCourses.slice(0, PAGE_SIZE))
        setTotal(allTotal)
      } else {
        params.set('status', statusFilter)
        const res = await fetch(`/api/training/courses?${params.toString()}`)
        if (!res.ok) throw new Error('Erro')
        const data = await res.json()
        setCourses(data.data || [])
        setTotal(data.total || 0)
      }
    } catch {
      setCourses([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, statusFilter, categoryFilter, difficultyFilter, page])

  useEffect(() => { fetchCourses() }, [fetchCourses])
  useEffect(() => { setPage(0) }, [debouncedSearch, statusFilter, categoryFilter, difficultyFilter])

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/training/courses/${id}/publish`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao publicar')
      }
      toast.success('Formação publicada com sucesso')
      fetchCourses()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/training/courses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro')
      toast.success('Formação arquivada')
      fetchCourses()
    } catch {
      toast.error('Erro ao arquivar')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = search || statusFilter !== 'all' || categoryFilter !== 'all' || difficultyFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setCategoryFilter('all')
    setDifficultyFilter('all')
  }

  return (
    <div className="space-y-5">
      {/* ─── Toolbar ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar formações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button type="button" title="Limpar pesquisa" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Status Select */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TRAINING_COURSE_STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Select */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Difficulty Select */}
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Dificuldade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {TRAINING_DIFFICULTY_OPTIONS.map(d => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View mode toggle */}
        <div className="inline-flex items-center gap-0.5 px-1 py-1 rounded-full bg-muted/40 border border-border/30">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
              viewMode === 'table' ? 'bg-neutral-800 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
              viewMode === 'grid' ? 'bg-neutral-800 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Create button */}
        <Button size="sm" onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Formação
        </Button>
      </div>

      {/* ─── Content ─── */}
      {isLoading ? (
        viewMode === 'table' ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        )
      ) : courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Nenhuma formação encontrada"
          description={
            hasFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Ainda não existem formações. Comece por criar a primeira.'
          }
          action={
            hasFilters
              ? { label: 'Limpar Filtros', onClick: clearFilters }
              : { label: 'Nova Formação', onClick: onCreateClick }
          }
        />
      ) : viewMode === 'grid' ? (
        /* ─── Grid View ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map(course => (
            <CourseAdminCard
              key={course.id}
              course={course}
              onPublish={handlePublish}
              onArchive={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      ) : (
        /* ─── Table View ─── */
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Título</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Categoria</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Dificuldade</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Criado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map(course => {
                const statusOpt = TRAINING_COURSE_STATUS_OPTIONS.find(s => s.value === course.status)
                const diffConfig = TRAINING_DIFFICULTY_COLORS[course.difficulty_level as keyof typeof TRAINING_DIFFICULTY_COLORS]
                return (
                  <TableRow
                    key={course.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                    onClick={() => router.push(`/dashboard/formacoes/gestao/${course.id}/editar`)}
                  >
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(course.category as any)?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        'rounded-full text-[10px] px-2 py-0.5',
                        course.status === 'published' && 'bg-emerald-500/15 text-emerald-600',
                        course.status === 'draft' && 'bg-slate-500/15 text-slate-500',
                        course.status === 'archived' && 'bg-amber-500/15 text-amber-600',
                      )}>
                        {statusOpt?.label || course.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {diffConfig && (
                        <Badge className={cn('rounded-full text-[10px] px-2 py-0.5', diffConfig.bg, diffConfig.text)}>{diffConfig.label}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(course.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/formacoes/gestao/${course.id}/editar`)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/formacoes/cursos/${course.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />Pré-visualizar
                          </DropdownMenuItem>
                          {course.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handlePublish(course.id)}>
                              <Globe className="h-4 w-4 mr-2" />Publicar
                            </DropdownMenuItem>
                          )}
                          {course.status !== 'archived' && (
                            <DropdownMenuItem onClick={() => setDeleteId(course.id)} className="text-red-600">
                              <Archive className="h-4 w-4 mr-2" />Arquivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
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
              onClick={() => setPage(p => Math.max(0, p - 1))}
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
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar formação</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza de que pretende arquivar esta formação?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) handleArchive(deleteId); setDeleteId(null) }}>
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
