'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Mail, FileText, Circle } from 'lucide-react'
import { ACTION_TYPES } from '@/lib/constants'
import type { TemplateDetail } from '@/types/template'

interface TemplatePreviewProps {
  template: TemplateDetail
}

const getTaskIcon = (actionType: string) => {
  switch (actionType) {
    case 'UPLOAD':
      return <Upload className="h-4 w-4 text-blue-600" />
    case 'EMAIL':
      return <Mail className="h-4 w-4 text-amber-600" />
    case 'GENERATE_DOC':
      return <FileText className="h-4 w-4 text-purple-600" />
    default:
      return <Circle className="h-4 w-4 text-slate-500" />
  }
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const stages = [...(template.tpl_stages || [])].sort(
    (a, b) => a.order_index - b.order_index
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{template.name}</h2>
        {template.description && (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-min pb-2">
          {stages.map((stage, index) => {
            const tasks = [...(stage.tpl_tasks || [])].sort(
              (a, b) => a.order_index - b.order_index
            )

            return (
              <Card key={stage.id} className="w-72 shrink-0">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {index + 1}. {stage.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-3 space-y-1.5">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-2 rounded border text-xs"
                    >
                      {getTaskIcon(task.action_type)}
                      <span className="flex-1 truncate">{task.title}</span>
                      {task.is_mandatory && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          Obrig.
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
