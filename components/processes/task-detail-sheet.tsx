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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTION_TYPE_LABELS, SUBTASK_TYPE_LABELS } from '@/lib/constants'
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
import type { ProcessTask, ProcessDocument, ProcessOwner, TaskCommentMention } from '@/types/process'

const STATUS_ICONS = {
  completed: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  in_progress: <PlayCircle className="h-5 w-5 text-blue-500" />,
  skipped: <Ban className="h-5 w-5 text-orange-500" />,
  pending: <Circle className="h-5 w-5 text-muted-foreground" />,
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
  processDocuments?: ProcessDocument[]
  owners?: ProcessOwner[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdate: () => void
}

export function TaskDetailSheet({
  task,
  processId,
  propertyId,
  processDocuments,
  owners,
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
              <div className="h-px bg-border" />
              <TaskDetailActions
                task={task}
                processId={processId}
                propertyId={propertyId}
                processDocuments={processDocuments}
                owners={owners}
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
            taskTitle={task.title}
          />
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'w-full p-0 gap-0 flex flex-col h-full transition-[max-width] duration-300',
          splitMode ? 'sm:max-w-[90vw] min-w-[900px]' : 'sm:max-w-5xl min-w-[600px]'
        )}
        onInteractOutside={(e) => {
          // Prevent sheet from closing when dragging resize handle
          if (splitMode) e.preventDefault()
        }}
      >
        {/* HEADER FIXO */}
        <SheetHeader className="border-b px-6 py-4 space-y-2">
          <div className="flex items-center gap-2">
            {statusIcon}
            <SheetTitle className="text-lg">{task.title}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {task.is_blocked && (
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary bg-primary/5">
                <Lock className="h-3 w-3" />
                Bloqueada
              </Badge>
            )}
            {task.action_type === 'COMPOSITE' && task.subtasks && task.subtasks.length > 0 ? (
              (() => {
                const types = [...new Set(task.subtasks.map((s) => (s.config as any)?.type || (s.config as any)?.check_type || 'checklist'))]
                const ICON_MAP: Record<string, React.ReactNode> = {
                  upload: <Upload className="h-3 w-3" />,
                  checklist: <CheckSquare className="h-3 w-3" />,
                  manual: <CheckSquare className="h-3 w-3" />,
                  email: <Mail className="h-3 w-3" />,
                  generate_doc: <FileText className="h-3 w-3" />,
                }
                return types.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1">
                    {ICON_MAP[t] || null}
                    {SUBTASK_TYPE_LABELS[t] || t}
                  </Badge>
                ))
              })()
            ) : (
              <Badge variant="secondary" className="text-xs">
                {ACTION_TYPE_LABELS[task.action_type as keyof typeof ACTION_TYPE_LABELS] ?? task.action_type}
              </Badge>
            )}
            {task.is_mandatory && (
              <Badge variant="outline" className="text-xs">
                Obrigatória
              </Badge>
            )}
            {task.stage_name && (
              <Badge variant="outline" className="text-xs">
                {task.stage_name}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* CORPO: SIDEBAR + CONTEÚDO */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar de navegação */}
          <TaskSheetSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            commentsCount={comments.length}
            activitiesCount={activities.length}
            splitMode={splitMode}
            splitTab={splitTab}
            onSplitToggle={handleSplitToggle}
          />

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
