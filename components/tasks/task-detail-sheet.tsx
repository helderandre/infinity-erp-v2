'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  CalendarDays, Check, ChevronDown, Download, Loader2, MessageSquare,
  Paperclip, Plus, RotateCcw, Send, Trash2, User, X,
} from 'lucide-react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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

interface TaskDetailSheetProps {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  onCreateSubTask: (parentId: string) => void
}

export function TaskDetailSheet({ taskId, open, onOpenChange, onRefresh, onCreateSubTask }: TaskDetailSheetProps) {
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
    if (open && taskId) fetchTask()
  }, [open, taskId, fetchTask])

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
      onOpenChange(false)
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

  if (!task && !isLoading) return null

  const priority = task ? TASK_PRIORITY_MAP[task.priority as keyof typeof TASK_PRIORITY_MAP] : null
  const isOverdue = task?.due_date && !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
  const subTasks = (task?.sub_tasks || []) as TaskWithRelations[]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Detalhe da Tarefa</SheetTitle>
            <div className="flex items-center gap-1">
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
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : task ? (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-5">
              {/* Title + Complete */}
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={handleToggle}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h3 className={cn(
                    'text-lg font-semibold',
                    task.is_completed && 'line-through text-muted-foreground',
                  )}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Priority */}
                {priority && (
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', priority.dot)} />
                    <span className={priority.color}>{priority.label}</span>
                  </div>
                )}

                {/* Due date */}
                {task.due_date && (
                  <div className={cn(
                    'flex items-center gap-2',
                    isOverdue && 'text-red-600 font-medium',
                  )}>
                    <CalendarDays className="h-4 w-4" />
                    {format(new Date(task.due_date), 'PPP', { locale: pt })}
                  </div>
                )}

                {/* Assignee */}
                {task.assignee && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {task.assignee.commercial_name}
                  </div>
                )}

                {/* Recurring */}
                {task.is_recurring && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RotateCcw className="h-4 w-4" />
                    Recorrente
                  </div>
                )}

                {/* Entity link */}
                {task.entity_type && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {TASK_ENTITY_LABELS[task.entity_type as TaskEntityType]}
                    </Badge>
                  </div>
                )}

                {/* Creator */}
                {task.creator && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    Criada por {task.creator.commercial_name}
                  </div>
                )}
              </div>

              {/* Sub-tasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Sub-tarefas ({subTasks.length})</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => onCreateSubTask(task.id)}
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar
                  </Button>
                </div>
                {subTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    {subTasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
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
                          className="h-3.5 w-3.5"
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
                ) : (
                  <p className="text-xs text-muted-foreground">Sem sub-tarefas</p>
                )}
              </div>

              <Separator />

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Paperclip className="h-4 w-4" />
                    Anexos ({attachments.length})
                  </h4>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild disabled={isUploading}>
                    <label>
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Anexar
                      <input type="file" className="hidden" onChange={handleUploadAttachment} />
                    </label>
                  </Button>
                </div>
                {attachments.length > 0 ? (
                  <div className="space-y-1.5">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 truncate text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {att.file_name}
                        </a>
                        {att.file_size && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {(att.file_size / 1024).toFixed(0)} KB
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteAttachment(att.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem anexos</p>
                )}
              </div>

              <Separator />

              {/* Comments */}
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                  <MessageSquare className="h-4 w-4" />
                  Comentários ({comments.length})
                </h4>

                {comments.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">
                            {c.user?.commercial_name || 'Utilizador'}
                          </span>
                          <span className="text-[0.65rem] text-muted-foreground">
                            {format(new Date(c.created_at), 'dd/MM HH:mm', { locale: pt })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* New comment input */}
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escrever comentário..."
                    rows={2}
                    className="flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSendComment()
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="shrink-0 self-end"
                    onClick={handleSendComment}
                    disabled={!newComment.trim() || isSendingComment}
                  >
                    {isSendingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
