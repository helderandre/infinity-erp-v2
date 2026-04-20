'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  CalendarDays, Loader2, Paperclip, Plus, RotateCcw, Send, Trash2, X,
} from 'lucide-react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_MAP, TASK_ENTITY_LABELS } from '@/types/task'
import type { TaskWithRelations, TaskComment, TaskAttachment, TaskEntityType } from '@/types/task'
import { useTaskMutations } from '@/hooks/use-tasks'

// ─── Shared content (usado tanto em sheet como inline) ──────────────────────

interface TaskDetailContentProps {
  taskId: string | null
  variant?: 'sheet' | 'inline'
  onRefresh: () => void
  onCreateSubTask: (parentId: string) => void
  onClose?: () => void
}

export function TaskDetailContent({
  taskId,
  variant = 'sheet',
  onRefresh,
  onCreateSubTask,
  onClose,
}: TaskDetailContentProps) {
  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isSendingComment, setIsSendingComment] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { toggleComplete, deleteTask } = useTaskMutations()

  const fetchTask = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const [taskRes, commentsRes, attachmentsRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/comments`),
        fetch(`/api/tasks/${taskId}/attachments`),
      ])
      if (taskRes.ok) setTask(await taskRes.json())
      if (commentsRes.ok) setComments(await commentsRes.json())
      if (attachmentsRes.ok) setAttachments(await attachmentsRes.json())
    } catch {
      toast.error('Erro ao carregar tarefa')
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (taskId) {
      fetchTask()
    } else {
      setTask(null)
      setComments([])
      setAttachments([])
    }
  }, [taskId, fetchTask])

  const handleToggle = async () => {
    if (!task) return
    try {
      await toggleComplete(task.id, task.is_completed)
      toast.success(task.is_completed ? 'Tarefa reaberta' : 'Tarefa concluída')
      fetchTask()
      onRefresh()
    } catch {
      toast.error('Erro ao actualizar tarefa')
    }
  }

  const handleDelete = async () => {
    if (!task) return
    try {
      await deleteTask(task.id)
      toast.success('Tarefa eliminada')
      onClose?.()
      onRefresh()
    } catch {
      toast.error('Erro ao eliminar tarefa')
    }
  }

  const handleSendComment = async () => {
    if (!taskId || !newComment.trim()) return
    setIsSendingComment(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (!res.ok) throw new Error()
      const comment = await res.json()
      setComments((prev) => [...prev, comment])
      setNewComment('')
    } catch {
      toast.error('Erro ao enviar comentário')
    } finally {
      setIsSendingComment(false)
    }
  }

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !taskId) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const attachment = await res.json()
      setAttachments((prev) => [attachment, ...prev])
      toast.success('Ficheiro anexado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao anexar ficheiro')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteAttachment = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/attachments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAttachments((prev) => prev.filter((a) => a.id !== id))
      toast.success('Anexo eliminado')
    } catch {
      toast.error('Erro ao eliminar anexo')
    }
  }

  const priority = task ? TASK_PRIORITY_MAP[task.priority as keyof typeof TASK_PRIORITY_MAP] : null
  const isOverdue = task?.due_date && !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
  const subTasks = (task?.sub_tasks || []) as TaskWithRelations[]

  const header = (
    <div className="flex items-center justify-between px-6 py-4 border-b">
      <h3 className="text-base font-semibold">Detalhe da Tarefa</h3>
      <div className="flex items-center gap-1">
        {task && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar tarefa</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem a certeza de que pretende eliminar esta tarefa? Esta acção é irreversível.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {variant === 'inline' && onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )

  const body = (
    <>
      {isLoading ? (
        <div className="p-6 space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : task ? (
        <div className="p-6 space-y-6">
          {/* Título com checkbox inline à esquerda */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={task.is_completed}
              onCheckedChange={handleToggle}
              className="mt-1 size-5 rounded-full border-[1.5px] data-checked:bg-blue-500 data-checked:border-blue-500 data-checked:text-white"
            />
            <div className="flex-1 min-w-0">
              <h2 className={cn(
                'text-xl font-semibold leading-tight tracking-tight',
                task.is_completed && 'line-through text-muted-foreground',
              )}>
                {task.title}
              </h2>
              {task.description && (
                <p className="text-sm text-muted-foreground/90 mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Meta: linha única compacta (Todoist style) */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm">
            {task.due_date && (
              <span className={cn(
                'flex items-center gap-1.5',
                isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
              )}>
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(task.due_date), 'd MMM yyyy', { locale: pt })}
              </span>
            )}
            {priority && (
              <span className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', priority.dot)} />
                <span className={priority.color}>{priority.label}</span>
              </span>
            )}
            {task.is_recurring && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                Recorrente
              </span>
            )}
            {task.entity_type && (
              <span className="text-[11px] rounded-full bg-muted/70 px-2 py-0.5 text-muted-foreground">
                {TASK_ENTITY_LABELS[task.entity_type as TaskEntityType]}
              </span>
            )}
          </div>

          {/* Sub-tarefas — sem separador duro, apenas micro-header */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sub-tarefas {subTasks.length > 0 && <span className="text-muted-foreground/60">· {subTasks.length}</span>}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => onCreateSubTask(task.id)}
              >
                <Plus className="h-3 w-3" />
                Adicionar
              </Button>
            </div>
            {subTasks.length > 0 ? (
              <div className="space-y-1">
                {subTasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-2.5 py-1.5 text-sm group">
                    <Checkbox
                      checked={st.is_completed}
                      onCheckedChange={async () => {
                        try {
                          await toggleComplete(st.id, st.is_completed)
                          fetchTask()
                          onRefresh()
                        } catch {
                          toast.error('Erro ao actualizar sub-tarefa')
                        }
                      }}
                      className="size-4 rounded-full border-[1.5px] data-checked:bg-blue-500 data-checked:border-blue-500"
                    />
                    <span className={cn(
                      'flex-1 truncate',
                      st.is_completed && 'line-through text-muted-foreground',
                    )}>
                      {st.title}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {/* Anexos */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Anexos {attachments.length > 0 && <span className="text-muted-foreground/60">· {attachments.length}</span>}
              </h4>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" asChild disabled={isUploading}>
                <label>
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Anexar
                  <input type="file" className="hidden" onChange={handleUploadAttachment} />
                </label>
              </Button>
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-1">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 py-1.5 text-sm group">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {att.file_name}
                    </a>
                    {att.file_size && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {(att.file_size / 1024).toFixed(0)} KB
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteAttachment(att.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {/* Comentários */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Comentários {comments.length > 0 && <span className="text-muted-foreground/60">· {comments.length}</span>}
            </h4>

            {comments.length > 0 && (
              <div className="space-y-2 mb-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">
                        {c.user?.commercial_name || 'Utilizador'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), 'dd MMM · HH:mm', { locale: pt })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escrever comentário..."
                rows={2}
                className="flex-1 text-sm rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSendComment()
                  }
                }}
              />
              <Button
                size="icon"
                className="shrink-0 self-end rounded-full"
                onClick={handleSendComment}
                disabled={!newComment.trim() || isSendingComment}
              >
                {isSendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </section>
        </div>
      ) : (
        <div className="p-6 text-sm text-muted-foreground">
          Tarefa não encontrada.
        </div>
      )}
    </>
  )

  if (variant === 'inline') {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex-1 overflow-y-auto">{body}</div>
      </div>
    )
  }

  return (
    <>
      {header}
      <ScrollArea className="flex-1">{body}</ScrollArea>
    </>
  )
}

// ─── Sheet wrapper ──────────────────────────────────────────────────────────

interface TaskDetailSheetProps {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  onCreateSubTask: (parentId: string) => void
}

export function TaskDetailSheet({ taskId, open, onOpenChange, onRefresh, onCreateSubTask }: TaskDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhe da Tarefa</SheetTitle>
        </SheetHeader>
        <TaskDetailContent
          taskId={open ? taskId : null}
          variant="sheet"
          onRefresh={onRefresh}
          onCreateSubTask={onCreateSubTask}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
