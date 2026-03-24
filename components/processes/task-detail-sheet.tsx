'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Ban,
  Upload,
  Mail,
  FileText,
  CheckSquare,
  Lock,
  X,
  CalendarIcon,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { ACTION_TYPE_LABELS, SUBTASK_TYPE_LABELS, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, PRIORITY_BADGE_CONFIG } from '@/lib/constants'
import type { TaskPriority } from '@/types/process'
import { useTaskComments } from '@/hooks/use-task-comments'
import { useTaskActivities } from '@/hooks/use-task-activities'
import { TaskDetailMetadata } from './task-detail-metadata'
import { TaskDetailActions } from './task-detail-actions'
import { TaskActivityFeed } from './task-activity-feed'
import { TaskActivityTimeline } from './task-activity-timeline'
import { TaskDocumentsPanel } from './task-documents-panel'
import { TaskSheetSidebar, type SheetTab } from './task-sheet-sidebar'
import { CommentInput } from './comment-input'
import { toast } from 'sonner'
import type { ProcessTask, ProcessInstance, ProcessDocument, ProcessOwner, TaskCommentMention } from '@/types/process'
import type { Deal, DealClient, DealPayment } from '@/types/deal'

const STATUS_ICONS = {
  completed: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
  in_progress: <PlayCircle className="h-5 w-5 text-blue-400" />,
  skipped: <Ban className="h-5 w-5 text-orange-400" />,
  pending: <Circle className="h-5 w-5 text-white/40" />,
}

const TAB_LABELS: Record<SheetTab, string> = {
  task: 'Tarefa',
  activity: 'Actividade',
  comments: 'Comentários',
  documents: 'Documentos',
}

interface TaskDetailSheetProps {
  task: ProcessTask | null
  processId: string
  propertyId: string
  consultantId?: string
  property?: ProcessInstance['property']
  processInstance?: ProcessInstance
  processDocuments?: ProcessDocument[]
  owners?: ProcessOwner[]
  deal?: (Deal & { deal_clients?: DealClient[]; deal_payments?: DealPayment[] }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdate: () => void
}

export function TaskDetailSheet({
  task,
  processId,
  propertyId,
  consultantId,
  property,
  processInstance,
  processDocuments,
  owners,
  deal,
  open,
  onOpenChange,
  onTaskUpdate,
}: TaskDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<SheetTab>('task')
  const [splitMode, setSplitMode] = useState(false)
  const [splitTab, setSplitTab] = useState<SheetTab | null>(null)
  const [commentValue, setCommentValue] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; display: string }[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [isHeaderUpdating, setIsHeaderUpdating] = useState(false)

  const handleHeaderUpdate = async (action: string, payload: Record<string, unknown>) => {
    if (!task) return
    setIsHeaderUpdating(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tarefa actualizada')
      onTaskUpdate()
    } catch {
      toast.error('Erro ao actualizar tarefa')
    } finally {
      setIsHeaderUpdating(false)
    }
  }

  const { comments, isLoading: isCommentsLoading, addComment } = useTaskComments(
    processId,
    task?.id ?? null
  )

  const { activities, isLoading: isActivitiesLoading } = useTaskActivities(
    processId,
    task?.id ?? null
  )

  // Reset tab when task changes + log viewed
  const taskId = task?.id ?? null
  useEffect(() => {
    if (!taskId) return
    setActiveTab('task')
    setSplitMode(false)
    setSplitTab(null)
    // Registar visualização (fire-and-forget)
    fetch(`/api/processes/${processId}/tasks/${taskId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_type: 'viewed' }),
    }).catch(() => {})
  }, [taskId, processId])

  // Fetch users for mentions
  useEffect(() => {
    if (!open) return
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) throw new Error()
        const data: { id: string; commercial_name: string }[] = await res.json()
        setMentionUsers(data.map((u) => ({ id: u.id, display: u.commercial_name })))
      } catch {
        // silent
      }
    }
    loadUsers()
  }, [open])

  const handleTabChange = useCallback((tab: SheetTab) => {
    if (splitMode) {
      if (tab === activeTab) return
      if (tab === splitTab) {
        setSplitTab(activeTab)
        setActiveTab(tab)
      } else {
        setSplitTab(tab)
      }
    } else {
      setActiveTab(tab)
    }
  }, [splitMode, activeTab, splitTab])

  const handleSplitToggle = useCallback(() => {
    if (splitMode) {
      setSplitMode(false)
      setSplitTab(null)
    } else {
      setSplitMode(true)
      const defaults: Record<SheetTab, SheetTab> = {
        task: 'documents',
        activity: 'comments',
        comments: 'activity',
        documents: 'task',
      }
      setSplitTab(defaults[activeTab])
    }
  }, [splitMode, activeTab])

  const handleCloseSplit = useCallback(() => {
    setSplitMode(false)
    setSplitTab(null)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLElement && e.target.closest('[contenteditable="true"]')) return
      const tabs: SheetTab[] = ['task', 'activity', 'comments', 'documents']
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < tabs.length) {
        handleTabChange(tabs[idx])
      }
      if (e.key === 's' || e.key === 'S') {
        handleSplitToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleTabChange, handleSplitToggle])

  const handleSubmitComment = useCallback(async () => {
    if (!commentValue.trim() || isSubmittingComment) return
    setIsSubmittingComment(true)
    try {
      const mentions: TaskCommentMention[] = []
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = mentionRegex.exec(commentValue)) !== null) {
        mentions.push({ display_name: match[1], user_id: match[2] })
      }
      await addComment(commentValue, mentions)
      setCommentValue('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar comentário')
    } finally {
      setIsSubmittingComment(false)
    }
  }, [commentValue, isSubmittingComment, addComment])

  if (!task) return null

  const statusIcon = STATUS_ICONS[task.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending

  // Render content for a given tab
  const renderTabContent = (tab: SheetTab) => {
    switch (tab) {
      case 'task':
        return (
          <ScrollArea className="h-full">
            <div className="px-6 py-4 space-y-6">
              <TaskDetailMetadata
                task={task}
                processId={processId}
                onTaskUpdate={onTaskUpdate}
              />
              <TaskDetailActions
                task={task}
                processId={processId}
                propertyId={propertyId}
                consultantId={consultantId}
                property={property}
                processInstance={processInstance}
                processDocuments={processDocuments}
                owners={owners}
                deal={deal}
                onTaskUpdate={onTaskUpdate}
              />
            </div>
          </ScrollArea>
        )

      case 'activity':
        return (
          <TaskActivityTimeline
            activities={activities}
            isLoading={isActivitiesLoading}
          />
        )

      case 'comments':
        return (
          <ScrollArea className="h-full">
            <div className="px-6 py-4">
              <TaskActivityFeed
                comments={comments}
                isLoading={isCommentsLoading}
              />
            </div>
          </ScrollArea>
        )

      case 'documents':
        return (
          <TaskDocumentsPanel
            documents={processDocuments || []}
            owners={owners}
            taskTitle={task.title}
          />
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Mobile: bottom sheet, Desktop: right sheet */}
      <SheetContent
        side="right"
        className={cn(
          'p-0 gap-0 flex flex-col transition-[max-width] duration-300',
          // Mobile: full width, 90% height, bottom sheet style
          'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-[90vh] max-sm:w-full max-sm:max-w-full max-sm:rounded-t-2xl max-sm:translate-y-0 max-sm:data-[state=closed]:translate-y-full max-sm:data-[state=open]:translate-y-0 max-sm:data-[state=closed]:translate-x-0 max-sm:data-[state=open]:translate-x-0',
          // Desktop: right side, normal behavior
          'sm:w-full sm:h-full',
          splitMode ? 'sm:max-w-[90vw] sm:min-w-[900px]' : 'sm:max-w-5xl sm:min-w-[600px]'
        )}
        onInteractOutside={(e) => {
          // Prevent sheet from closing when dragging resize handle
          if (splitMode) e.preventDefault()
        }}
      >
        {/* HEADER FIXO — dark hero */}
        <SheetHeader className="relative overflow-hidden bg-neutral-900 px-4 py-4 sm:px-6 sm:py-5 space-y-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="shrink-0">{statusIcon}</div>
              <SheetTitle className="text-lg text-white font-bold leading-snug flex-1">{task.title}</SheetTitle>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {/* Status — colored */}
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                task.status === 'completed' && 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
                task.status === 'in_progress' && 'bg-blue-500/20 text-blue-300 border-blue-400/30',
                task.status === 'skipped' && 'bg-orange-500/20 text-orange-300 border-orange-400/30',
                task.status === 'pending' && 'bg-sky-500/20 text-sky-300 border-sky-400/30',
              )}>
                {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
              </span>

              {/* Priority — colored picker */}
              {(() => {
                const p = (task.priority as TaskPriority) || 'normal'
                const isEditable = !['completed', 'skipped'].includes(task.status ?? '')
                const priorityColors: Record<string, string> = {
                  urgent: 'bg-red-500/20 text-red-300 border-red-400/30',
                  normal: 'bg-white/10 text-white/60 border-white/20',
                  low: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
                }
                if (!isEditable) {
                  return (
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border', priorityColors[p])}>
                      {TASK_PRIORITY_LABELS[p]}
                    </span>
                  )
                }
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors hover:bg-white/15',
                        priorityColors[p],
                      )}>
                        {TASK_PRIORITY_LABELS[p]}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                      <div className="flex flex-col gap-0.5">
                        {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([key, label]) => (
                          <button
                            key={key}
                            className={cn(
                              'text-xs px-3 py-1.5 rounded-md text-left hover:bg-accent transition-colors',
                              key === p && 'bg-accent font-medium'
                            )}
                            onClick={() => handleHeaderUpdate('update_priority', { priority: key })}
                            disabled={isHeaderUpdating}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })()}

              {/* Blocked */}
              {task.is_blocked && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-400/30 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" />
                  Bloqueada
                </span>
              )}

              {/* Due date — picker */}
              {(() => {
                const isEditable = !['completed', 'skipped'].includes(task.status ?? '')
                const dueDate = task.due_date ? new Date(task.due_date) : undefined
                const now = new Date()
                const msLeft = dueDate ? dueDate.getTime() - now.getTime() : null
                const isOverdue = dueDate && msLeft !== null && msLeft < 0
                const isUrgent = dueDate && msLeft !== null && msLeft >= 0 && msLeft < 24 * 60 * 60 * 1000
                const isWarning = dueDate && msLeft !== null && msLeft >= 24 * 60 * 60 * 1000 && msLeft < 72 * 60 * 60 * 1000
                const dateColor = !isEditable
                  ? 'bg-white/10 text-white/60 border-white/20'
                  : (isOverdue || isUrgent)
                  ? 'bg-red-500/20 text-red-300 border-red-400/30'
                  : isWarning
                  ? 'bg-amber-400/15 text-amber-200 border-amber-300/25'
                  : 'bg-white/10 text-white/60 border-white/20'
                if (!isEditable) {
                  return dueDate ? (
                    <span className={cn(
                      'text-[10px] font-medium px-2.5 py-0.5 rounded-full border flex items-center gap-1',
                      dateColor
                    )}>
                      <CalendarIcon className="h-2.5 w-2.5" />
                      {formatDate(task.due_date)}
                    </span>
                  ) : null
                }
                return (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        'text-[10px] font-medium px-2.5 py-0.5 rounded-full border flex items-center gap-1 cursor-pointer transition-colors hover:bg-white/15',
                        dateColor
                      )}>
                        <CalendarIcon className="h-2.5 w-2.5" />
                        {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: pt }) : 'Definir data limite'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={(date) => {
                          setCalendarOpen(false)
                          handleHeaderUpdate('update_due_date', {
                            due_date: date ? date.toISOString() : null,
                          })
                        }}
                        locale={pt}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )
              })()}

              {/* Owner */}
              {task.owner && (
                <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/20 truncate max-w-[150px]">
                  {task.owner.name}
                </span>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Mobile horizontal tabs */}
        <div className="sm:hidden flex border-b overflow-x-auto">
          {(['task', 'activity', 'comments', 'documents'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                'flex-1 min-w-0 px-3 py-2.5 text-xs font-medium text-center border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* CORPO: SIDEBAR + CONTEÚDO */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar de navegação — hidden on mobile */}
          <div className="hidden sm:flex">
            <TaskSheetSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              commentsCount={comments.length}
              activitiesCount={activities.length}
              splitMode={splitMode}
              splitTab={splitTab}
              onSplitToggle={handleSplitToggle}
            />
          </div>

          {/* Conteúdo principal */}
          {splitMode && splitTab ? (
            // SPLIT VIEW — 2 painéis redimensionáveis
            <ResizablePanelGroup orientation="horizontal" className="flex-1">
              {/* Painel primário */}
              <ResizablePanel defaultSize={55} minSize={30}>
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {TAB_LABELS[activeTab]}
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {renderTabContent(activeTab)}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              {/* Painel secundário */}
              <ResizablePanel defaultSize={45} minSize={25}>
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {TAB_LABELS[splitTab]}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCloseSplit}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {renderTabContent(splitTab)}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            // SINGLE VIEW
            <div className="flex-1 overflow-hidden">
              {renderTabContent(activeTab)}
            </div>
          )}
        </div>

        {/* FOOTER FIXO — Input de comentário (sempre visível) */}
        <div className="border-t px-6 py-3">
          <CommentInput
            value={commentValue}
            onChange={setCommentValue}
            users={mentionUsers}
            onSubmit={handleSubmitComment}
            isSubmitting={isSubmittingComment}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
