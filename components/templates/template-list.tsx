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
import { MoreHorizontal, Pencil, Trash2, Layers, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { TemplateWithCounts } from '@/types/template'

interface TemplateListProps {
  templates: TemplateWithCounts[]
  onRefresh: () => void
}

export function TemplateList({ templates, onRefresh }: TemplateListProps) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeactivate = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/templates/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desactivar template')
      toast.success('Template desactivado com sucesso')
      onRefresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(tpl.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Desactivar
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

      {/* Dialog de confirmação */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
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
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'A desactivar...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
