'use client'

import { useState } from 'react'
import {
  FileText,
  Phone,
  Mail,
  Users,
  FileCheck,
  Send,
  FileSpreadsheet,
  Home,
  FileSignature,
  Plus,
  Loader2,
  RefreshCw,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CREDIT_ACTIVITY_TYPE_OPTIONS } from '@/lib/constants'
import type { CreditActivity } from '@/types/credit'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  Phone,
  Mail,
  Users,
  FileCheck,
  Send,
  FileSpreadsheet,
  Home,
  FileSignature,
  RefreshCw,
  MessageSquare,
}

function getActivityIcon(tipo: string): React.ElementType {
  const opt = CREDIT_ACTIVITY_TYPE_OPTIONS.find((o) => o.value === tipo)
  if (opt?.icon && ICON_MAP[opt.icon]) return ICON_MAP[opt.icon]

  // Fallback mapping
  switch (tipo) {
    case 'status_change':
      return RefreshCw
    case 'simulacao':
      return FileSpreadsheet
    case 'proposta_aceite':
      return FileCheck
    default:
      return MessageSquare
  }
}

function getActivityLabel(tipo: string): string {
  const opt = CREDIT_ACTIVITY_TYPE_OPTIONS.find((o) => o.value === tipo)
  return opt?.label ?? tipo
}

function getActivityColor(tipo: string): string {
  switch (tipo) {
    case 'chamada_banco':
    case 'chamada_cliente':
      return 'bg-blue-500'
    case 'email_banco':
    case 'email_cliente':
      return 'bg-indigo-500'
    case 'reuniao':
      return 'bg-purple-500'
    case 'documento_recebido':
    case 'documento_enviado':
      return 'bg-emerald-500'
    case 'proposta_recebida':
    case 'proposta_aceite':
      return 'bg-teal-500'
    case 'avaliacao_imovel':
      return 'bg-amber-500'
    case 'escritura':
      return 'bg-green-600'
    case 'status_change':
      return 'bg-slate-500'
    case 'simulacao':
      return 'bg-cyan-500'
    default:
      return 'bg-slate-400'
  }
}

interface CreditActivityTimelineProps {
  activities: CreditActivity[]
  onAddActivity: (data: { tipo: string; descricao: string }) => Promise<void>
}

export function CreditActivityTimeline({
  activities,
  onAddActivity,
}: CreditActivityTimelineProps) {
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!tipo || !descricao.trim()) {
      toast.error('Preencha o tipo e a descricao da actividade.')
      return
    }

    setIsSubmitting(true)
    try {
      await onAddActivity({ tipo, descricao: descricao.trim() })
      toast.success('Actividade registada com sucesso')
      setTipo('')
      setDescricao('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registar actividade')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {activities.length} {activities.length === 1 ? 'actividade' : 'actividades'}
        </h3>
        <Button
          size="sm"
          variant={showForm ? 'secondary' : 'default'}
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Actividade
        </Button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="activity-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="activity-tipo">
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_ACTIVITY_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="activity-descricao">Descricao</Label>
            <Textarea
              id="activity-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a actividade..."
              rows={2}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registar
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma actividade registada</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.tipo)
              const color = getActivityColor(activity.tipo)
              const label = getActivityLabel(activity.tipo)
              const date = new Date(activity.created_at)

              return (
                <div key={activity.id} className="relative flex gap-3">
                  {/* Dot */}
                  <div
                    className={cn(
                      'absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background',
                      color
                    )}
                  >
                    <Icon className="h-3 w-3 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{label}</span>
                      {activity.user_name && (
                        <span className="text-xs text-muted-foreground">
                          por {activity.user_name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {date.toLocaleDateString('pt-PT')}{' '}
                        {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{activity.descricao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
