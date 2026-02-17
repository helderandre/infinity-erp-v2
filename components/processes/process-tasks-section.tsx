'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Ban,
  FileText,
  Mail,
  Upload,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface ProcessTasksSectionProps {
  processId: string
  stages: any[]
  onTaskUpdate: () => void
}

export function ProcessTasksSection({
  processId,
  stages,
  onTaskUpdate,
}: ProcessTasksSectionProps) {
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [bypassReason, setBypassReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleTaskAction = async (taskId: string, action: string) => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/processes/${processId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao actualizar tarefa')
      }

      toast.success('Tarefa actualizada com sucesso!')
      onTaskUpdate()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBypassSubmit = async () => {
    if (!selectedTask || bypassReason.length < 10) {
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch(
        `/api/processes/${processId}/tasks/${selectedTask.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bypass',
            bypass_reason: bypassReason,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao dispensar tarefa')
      }

      toast.success('Tarefa dispensada com sucesso!')
      setBypassDialogOpen(false)
      setBypassReason('')
      setSelectedTask(null)
      onTaskUpdate()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const getTaskIcon = (actionType: string) => {
    switch (actionType) {
      case 'UPLOAD':
        return <Upload className="h-4 w-4" />
      case 'EMAIL':
        return <Mail className="h-4 w-4" />
      case 'GENERATE_DOC':
        return <FileText className="h-4 w-4" />
      default:
        return <Circle className="h-4 w-4" />
    }
  }

  return (
    <>
      <div className="space-y-6">
        {stages.map((stage) => (
          <Card key={stage.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{stage.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {stage.tasks_completed}/{stage.tasks_total}
                  </Badge>
                  <StatusBadge status={stage.status} type="task" showDot={false} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stage.tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="shrink-0">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : task.status === 'in_progress' ? (
                        <PlayCircle className="h-5 w-5 text-blue-600" />
                      ) : task.status === 'skipped' ? (
                        <Ban className="h-5 w-5 text-orange-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getTaskIcon(task.action_type)}
                        <span className="font-medium text-sm truncate">{task.title}</span>
                        {task.is_mandatory && (
                          <Badge variant="secondary" className="text-xs">
                            Obrigatória
                          </Badge>
                        )}
                      </div>
                      {task.is_bypassed && task.bypass_reason && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          Dispensada: {task.bypass_reason}
                        </p>
                      )}
                    </div>

                    <StatusBadge status={task.status} type="task" showDot={false} />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isProcessing}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {task.status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => handleTaskAction(task.id, 'start')}
                          >
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Iniciar
                          </DropdownMenuItem>
                        )}

                        {['pending', 'in_progress'].includes(task.status) && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleTaskAction(task.id, 'complete')}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Marcar como Concluída
                            </DropdownMenuItem>
                            {!task.is_mandatory && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTask(task)
                                    setBypassDialogOpen(true)
                                  }}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Dispensar Tarefa
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}

                        {task.status === 'skipped' && (
                          <DropdownMenuItem
                            onClick={() => handleTaskAction(task.id, 'reset')}
                          >
                            <Circle className="mr-2 h-4 w-4" />
                            Reactivar Tarefa
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de Dispensa */}
      <Dialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispensar Tarefa</DialogTitle>
            <DialogDescription>
              Indique o motivo para dispensar esta tarefa (mínimo 10 caracteres)
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="py-2">
              <p className="text-sm font-medium">{selectedTask.title}</p>
            </div>
          )}
          <Textarea
            placeholder="Ex: Documento não aplicável a este tipo de imóvel..."
            value={bypassReason}
            onChange={(e) => setBypassReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBypassDialogOpen(false)
                setBypassReason('')
                setSelectedTask(null)
              }}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBypassSubmit}
              disabled={isProcessing || bypassReason.length < 10}
            >
              <Ban className="mr-2 h-4 w-4" />
              Dispensar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
