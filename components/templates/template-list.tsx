'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, Pencil, Trash2, Power, Layers, ListChecks, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate } from '@/lib/utils'
import { PROCESS_TYPES } from '@/lib/constants'
import type { TemplateWithCounts } from '@/types/template'

interface TemplateListProps {
  templates: TemplateWithCounts[]
  onRefresh: () => void
}

export function TemplateList({ templates, onRefresh }: TemplateListProps) {
  const router = useRouter()
  const [deactivateId, setDeactivateId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleDeactivate = async () => {
    if (!deactivateId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/templates/${deactivateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desactivar template')
      toast.success('Template desactivado com sucesso')
      onRefresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
      setDeactivateId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/templates/${deleteId}?action=delete`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar template')
      toast.success('Template eliminado com sucesso')
      onRefresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
      setDeleteId(null)
    }
  }

  const handleDuplicate = async (id: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao duplicar template')
      toast.success('Template duplicado com sucesso')
      onRefresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            className="hover:bg-accent/50 transition-colors cursor-pointer h-full"
            onClick={() => router.push(`/dashboard/processos/templates/${tpl.id}/editar`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{tpl.name}</h3>
                  {tpl.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {tpl.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {tpl.process_type && PROCESS_TYPES[tpl.process_type as keyof typeof PROCESS_TYPES] && (
                    <Badge variant="secondary" className={cn(
                      PROCESS_TYPES[tpl.process_type as keyof typeof PROCESS_TYPES].bg,
                      PROCESS_TYPES[tpl.process_type as keyof typeof PROCESS_TYPES].text,
                      'text-xs'
                    )}>
                      {PROCESS_TYPES[tpl.process_type as keyof typeof PROCESS_TYPES].label}
                    </Badge>
                  )}
                  <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                    {tpl.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/processos/templates/${tpl.id}/editar`)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(tpl.id)}
                        disabled={isLoading}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      {tpl.is_active && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeactivateId(tpl.id)}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            Desactivar
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(tpl.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {tpl.stages_count} {tpl.stages_count === 1 ? 'fase' : 'fases'}
                </span>
                <span className="flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  {tpl.tasks_count} {tpl.tasks_count === 1 ? 'tarefa' : 'tarefas'}
                </span>
                <span className="ml-auto">
                  {formatDate(tpl.created_at)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de desactivação */}
      <AlertDialog open={!!deactivateId} onOpenChange={(open) => !open && setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desactivar este template? O template
              ficará inactivo mas não será eliminado. Processos já instanciados
              não serão afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={isLoading}
            >
              {isLoading ? 'A desactivar...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de eliminação */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este template? O template
              será removido da listagem. Processos já instanciados não serão
              afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'A eliminar...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
