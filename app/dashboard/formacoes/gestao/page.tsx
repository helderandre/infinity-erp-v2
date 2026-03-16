'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, ChevronLeft, ChevronRight, Search, MoreHorizontal, Pencil, Globe, Archive, Trash2, Eye, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TRAINING_COURSE_STATUS_OPTIONS, TRAINING_DIFFICULTY_COLORS, formatDate } from '@/lib/constants'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { TrainingCourse } from '@/types/training'

const PAGE_SIZE = 20

export default function GestaoFormacoesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <GestaoContent />
    </Suspense>
  )
}

function GestaoContent() {
  const router = useRouter()
  const [courses, setCourses] = useState<TrainingCourse[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [page, setPage] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const fetchCourses = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusTab !== 'all') params.set('status', statusTab)
      params.set('limit', String(PAGE_SIZE))
      params.set('page', String(page + 1))
      const res = await fetch(`/api/training/courses?${params.toString()}`)
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      setCourses(data.data || [])
      setTotal(data.total || 0)
    } catch {
      setCourses([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, statusTab, page])

  useEffect(() => { fetchCourses() }, [fetchCourses])
  useEffect(() => { setPage(0) }, [debouncedSearch, statusTab])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/formacoes"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Formações</h1>
            <p className="text-muted-foreground">Criar e gerir cursos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><Link href="/dashboard/formacoes/gestao/categorias">Categorias</Link></Button>
          <Button variant="outline" asChild><Link href="/dashboard/formacoes/percursos">Percursos</Link></Button>
          <Button asChild><Link href="/dashboard/formacoes/gestao/novo"><Plus className="h-4 w-4 mr-1" />Nova Formação</Link></Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar formações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <Tabs value={statusTab} onValueChange={setStatusTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="draft">Rascunhos</TabsTrigger>
          <TabsTrigger value="published">Publicados</TabsTrigger>
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
        </TabsList>

        <TabsContent value={statusTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Nenhuma formação encontrada.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Dificuldade</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map(course => {
                    const statusOpt = TRAINING_COURSE_STATUS_OPTIONS.find(s => s.value === course.status)
                    const diffConfig = TRAINING_DIFFICULTY_COLORS[course.difficulty_level as keyof typeof TRAINING_DIFFICULTY_COLORS]
                    return (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.title}</TableCell>
                        <TableCell>{(course.category as any)?.name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            course.status === 'published' && 'bg-emerald-500/15 text-emerald-500',
                            course.status === 'draft' && 'bg-slate-500/15 text-slate-500',
                            course.status === 'archived' && 'bg-amber-500/15 text-amber-500',
                          )}>
                            {statusOpt?.label || course.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {diffConfig && (
                            <Badge className={cn(diffConfig.bg, diffConfig.text)}>{diffConfig.label}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(course.created_at)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">{total} formação{total !== 1 ? 'ões' : ''}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

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
