'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Loader2, Paperclip, Plus, RotateCcw, Send, Trash2, X,
} from 'lucide-react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { TASK_ENTITY_LABELS } from '@/types/task'
import type { TaskWithRelations, TaskComment, TaskAttachment, TaskEntityType } from '@/types/task'
import { useTaskMutations } from '@/hooks/use-tasks'
import {
  PriorityCheck, PriorityFlag, DueDateText,
} from '@/components/tasks/task-primitives'

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

  const dueDate = task?.due_date ? new Date(task.due_date) : null
  const subTasks = (task?.sub_tasks || []) as TaskWithRelations[]

  const header = (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
      <h3 className="text-xs font-medium text-muted-foreground/80">
        Tarefa
      </h3>
      {variant === 'inline' && onClose && (
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )

  const deleteAction = task ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar tarefa
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
  ) : null

  const body = (
    <>
      {isLoading ? (
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-[22px] rounded-full mt-1" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-1/3" />
        </div>
      ) : task ? (
        <div className="p-5 space-y-5">
          {/* Título com checkbox inline à esquerda (mesmo primitivo da lista) */}
          <div className="flex items-start gap-3">
            <div className="mt-1.5">
              <PriorityCheck
                priority={task.priority}
                checked={task.is_completed}
                onClick={handleToggle}
                size="md"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className={cn(
                  'text-lg font-semibold leading-tight tracking-tight',
                  task.is_completed && 'line-through text-muted-foreground',
                )}>
                  {task.title}
                </h2>
                {!task.is_completed && (
                  <div className="shrink-0 mt-1">
                    <PriorityFlag priority={task.priority} />
                  </div>
                )}
              </div>
              {task.description && (
                task.description.includes('<') ? (
                  <div
                    className="prose prose-sm max-w-none text-[13px] text-muted-foreground/90 mt-1.5 leading-relaxed [&_p]:my-0.5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_a]:text-primary [&_a]:underline break-words"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                  />
                ) : (
                  <p className="text-[13px] text-muted-foreground/90 mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                )
              )}
            </div>
          </div>

          {/* Meta: linha compacta (same visual language da lista) */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-[11.5px] pl-[34px]">
            {dueDate && (
              <DueDateText
                date={dueDate}
                isCompleted={task.is_completed}
                variant="long"
              />
            )}
            {task.is_recurring && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <RotateCcw className="h-3 w-3" />
                Recorrente
              </span>
            )}
            {task.entity_type && (
              <span className="text-[10.5px] text-muted-foreground/80">
                @{TASK_ENTITY_LABELS[task.entity_type as TaskEntityType].toLowerCase()}
              </span>
            )}
          </div>

          {/* Sub-tarefas — rows estilo Todoist com connector line à esquerda */}
          <section>
            <div className="flex items-center justify-between mb-1 px-1">
              <h4 className="text-xs font-medium text-muted-foreground/80">
                Sub-tarefas {subTasks.length > 0 && <span className="text-muted-foreground/60 font-normal normal-case">· {subTasks.length}</span>}
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
            {subTasks.length > 0 && (
              <div className="ml-[9px] border-l border-border/60 pl-[13px]">
                {subTasks.map((st) => (
                  <div
                    key={st.id}
                    className={cn(
                      'group flex items-center gap-2.5 py-1.5 text-[13px] border-b border-border/40 last:border-b-0',
                      st.is_completed && 'opacity-55',
                    )}
                  >
                    <PriorityCheck
                      priority={st.priority}
                      checked={st.is_completed}
                      onClick={async () => {
                        try {
                          await toggleComplete(st.id, st.is_completed)
                          fetchTask()
                          onRefresh()
                        } catch {
                          toast.error('Erro ao actualizar sub-tarefa')
                        }
                      }}
                    />
                    <span className={cn(
                      'flex-1 truncate',
                      st.is_completed && 'line-through text-muted-foreground',
                    )}>
                      {st.title}
                    </span>
                    {!st.is_completed && <PriorityFlag priority={st.priority} />}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Anexos */}
          <section>
            <div className="flex items-center justify-between mb-1 px-1">
              <h4 className="text-xs font-medium text-muted-foreground/80">
                Anexos {attachments.length > 0 && <span className="text-muted-foreground/60 font-normal normal-case">· {attachments.length}</span>}
              </h4>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" asChild disabled={isUploading}>
                <label>
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Anexar
                  <input type="file" className="hidden" onChange={handleUploadAttachment} />
                </label>
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="border-t border-border/40">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 py-2 px-1 text-[13px] group border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors rounded">
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
            )}
          </section>

          {/* Comentários */}
          <section>
            <h4 className="text-xs font-medium text-muted-foreground/80 mb-2 px-1">
              Comentários {comments.length > 0 && <span className="text-muted-foreground/60 font-normal normal-case">· {comments.length}</span>}
            </h4>

            {comments.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11.5px] font-medium">
                        {c.user?.commercial_name || 'Utilizador'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), 'dd MMM · HH:mm', { locale: pt })}
                      </span>
                    </div>
                    <p className="text-[13px] whitespace-pre-wrap leading-snug">{c.content}</p>
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
                className="flex-1 text-[13px] rounded-xl resize-none min-h-0 bg-background/40 border-border/40 backdrop-blur-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSendComment()
                  }
                }}
              />
              <Button
                size="icon"
                className="shrink-0 self-end rounded-full h-8 w-8"
                onClick={handleSendComment}
                disabled={!newComment.trim() || isSendingComment}
              >
                {isSendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </section>

          {deleteAction && (
            <div className="pt-2 flex justify-center">
              {deleteAction}
            </div>
          )}
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
  const isMobile = useIsMobile()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}
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
