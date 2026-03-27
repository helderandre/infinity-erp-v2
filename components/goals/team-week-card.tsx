'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Send, CheckCircle, Clock, FileText, MessageSquare, Loader2, Eye, TrendingUp, ShoppingCart, Home, Key } from 'lucide-react'
import { GoalStatusIndicator } from './goal-status-indicator'
import { getGoalStatus } from '@/lib/goals/calculations'
import { GOAL_ACTIVITY_TYPES } from '@/lib/constants'
import { toast } from 'sonner'

interface PipelineValue {
  compra: number     // budget × 5%
  venda: number      // listing price × 5%
  arrendamento: number // rent × 150%
  total: number
}

interface LeadSourceCount {
  source: string
  count: number
}

interface TeamWeekCardProps {
  consultantName: string
  report: {
    id: string
    status: string
    notes_wins: string | null
    notes_challenges: string | null
    notes_next_week: string | null
    submitted_at: string | null
    manager_feedback: string | null
    ai_advice: string | null
  } | null
  activities: {
    total: number
    system: number
    declared: number
    by_type: Record<string, { done: number; target: number; system?: number; declared?: number }>
  }
  trustRatio: number
  pipelineValue?: PipelineValue
  leadSources?: LeadSourceCount[]
  onReview?: (reportId: string, feedback: string) => Promise<void>
}

const STATUS_ICON = {
  draft: Clock,
  submitted: Send,
  reviewed: CheckCircle,
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Submetido',
  reviewed: 'Revisto',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-emerald-100 text-emerald-700',
}

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  website: 'Website',
  landing_page: 'Landing Page',
  partner: 'Parceiro',
  organic: 'Orgânico',
  walk_in: 'Presencial',
  phone_call: 'Chamada',
  social_media: 'Redes Sociais',
  referral: 'Referência',
  other: 'Outro',
}

function formatCommission(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k€`
  return `${Math.round(value)}€`
}

const metricKeys = ['call', 'visit', 'lead_contact', 'listing', 'follow_up'] as const

export function TeamWeekCard({ consultantName, report, activities, trustRatio, pipelineValue, leadSources, onReview }: TeamWeekCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [feedback, setFeedback] = useState(report?.manager_feedback || '')
  const [isSending, setIsSending] = useState(false)

  const status = report?.status || 'none'
  const Icon = STATUS_ICON[status as keyof typeof STATUS_ICON] || FileText

  const handleSendFeedback = async () => {
    if (!report?.id || !feedback.trim() || !onReview) return
    setIsSending(true)
    try {
      await onReview(report.id, feedback.trim())
      toast.success('Feedback enviado')
    } catch {
      toast.error('Erro ao enviar feedback')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {/* Row — click to open sheet */}
      <button
        onClick={() => setSheetOpen(true)}
        className="w-full transition-colors hover:bg-muted/30 text-left"
      >
        <div className="flex items-center gap-4 px-6 py-4">
          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{consultantName}</p>
              {report ? (
                <Badge variant="secondary" className={`${STATUS_COLOR[status] || 'bg-slate-100'} text-[10px] rounded-lg`}>
                  <Icon className="mr-1 h-2.5 w-2.5" />
                  {STATUS_LABEL[status] || 'Sem relatório'}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-50 text-red-600 text-[10px] rounded-lg">
                  Pendente
                </Badge>
              )}
            </div>

            {/* Inline metrics */}
            <div className="flex items-center gap-3 mt-1.5">
              {metricKeys.map(key => {
                const metric = activities.by_type[key]
                if (!metric) return null
                const goalStatus = getGoalStatus(metric.done, metric.target)
                return (
                  <div key={key} className="flex items-center gap-1 text-xs">
                    <GoalStatusIndicator status={goalStatus} size="sm" />
                    <span className="text-muted-foreground">{(GOAL_ACTIVITY_TYPES as Record<string, string>)[key]?.slice(0, 3) || key}:</span>
                    <span className="font-medium tabular-nums">{metric.done}/{metric.target}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pipeline value pills */}
          {pipelineValue && pipelineValue.total > 0 && (
            <div className="hidden lg:flex items-center gap-1.5">
              {pipelineValue.venda > 0 && (
                <div className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] text-blue-700 font-medium flex items-center gap-1">
                  <Home className="h-2.5 w-2.5" />
                  {formatCommission(pipelineValue.venda)}
                </div>
              )}
              {pipelineValue.compra > 0 && (
                <div className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                  <ShoppingCart className="h-2.5 w-2.5" />
                  {formatCommission(pipelineValue.compra)}
                </div>
              )}
              {pipelineValue.arrendamento > 0 && (
                <div className="rounded-lg bg-purple-50 px-2 py-1 text-[10px] text-purple-700 font-medium flex items-center gap-1">
                  <Key className="h-2.5 w-2.5" />
                  {formatCommission(pipelineValue.arrendamento)}
                </div>
              )}
            </div>
          )}

          {/* Fiabilidade pill */}
          <div className={`hidden sm:flex flex-col items-center rounded-lg px-2.5 py-1 text-[10px] font-medium ${
            trustRatio >= 0.8 ? 'bg-emerald-50 text-emerald-700' :
            trustRatio >= 0.6 ? 'bg-blue-50 text-blue-700' :
            trustRatio >= 0.4 ? 'bg-amber-50 text-amber-700' :
            'bg-red-50 text-red-700'
          }`}>
            <span className="font-bold tabular-nums">{Math.round(trustRatio * 100)}%</span>
            <span className="text-[8px] opacity-70">no sistema</span>
          </div>

          <Eye className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        </div>
      </button>

      {/* Detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-2.5">
              <SheetTitle className="text-lg font-semibold">{consultantName}</SheetTitle>
              {report ? (
                <Badge variant="secondary" className={`${STATUS_COLOR[status] || 'bg-slate-100'} text-[10px] rounded-lg`}>
                  <Icon className="mr-1 h-2.5 w-2.5" />
                  {STATUS_LABEL[status] || 'Sem relatório'}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-50 text-red-600 text-[10px] rounded-lg">
                  Pendente
                </Badge>
              )}
            </div>
          </SheetHeader>

          <div className="px-6 py-6 space-y-6">
            {/* Pipeline value cards */}
            {pipelineValue && pipelineValue.total > 0 && (
              <div className="pb-6 border-b">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Comissão potencial em pipeline
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <Home className="h-4 w-4 text-blue-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-blue-600 font-medium mb-0.5">Venda</p>
                    <p className="text-sm font-bold text-blue-800 tabular-nums">{formatCommission(pipelineValue.venda)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4 text-center">
                    <ShoppingCart className="h-4 w-4 text-emerald-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-emerald-600 font-medium mb-0.5">Compra</p>
                    <p className="text-sm font-bold text-emerald-800 tabular-nums">{formatCommission(pipelineValue.compra)}</p>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-4 text-center">
                    <Key className="h-4 w-4 text-purple-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-purple-600 font-medium mb-0.5">Arrend.</p>
                    <p className="text-sm font-bold text-purple-800 tabular-nums">{formatCommission(pipelineValue.arrendamento)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Lead sources */}
            {leadSources && leadSources.length > 0 && (
              <div className="pb-6 border-b">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Origem dos leads esta semana
                </h4>
                <div className="flex flex-wrap gap-2">
                  {leadSources.map(ls => (
                    <div key={ls.source} className="rounded-xl bg-muted/50 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">{SOURCE_LABELS[ls.source] || ls.source}</span>
                      <span className="ml-1.5 font-bold tabular-nums">{ls.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity breakdown — dual color */}
            <div className="pb-6 border-b">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actividades</h4>
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Sistema</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Adicionais</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {metricKeys.map(key => {
                  const metric = activities.by_type[key] as { done: number; target: number; system?: number; declared?: number } | undefined
                  if (!metric) return null
                  const typeSystem = metric.system ?? metric.done
                  const typeDeclared = metric.declared ?? 0
                  const maxVal = Math.max(metric.target, metric.done, 1)
                  const systemPct = (typeSystem / maxVal) * 100
                  const declaredPct = (typeDeclared / maxVal) * 100

                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span>{(GOAL_ACTIVITY_TYPES as Record<string, string>)[key] || key}</span>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          {typeDeclared > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {typeSystem} + {typeDeclared}
                            </span>
                          )}
                          <span className="font-medium">{metric.done}/{metric.target}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                        {typeSystem > 0 && (
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${systemPct}%` }} />
                        )}
                        {typeDeclared > 0 && (
                          <div className="h-full bg-emerald-300 transition-all" style={{ width: `${declaredPct}%` }} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Total: {activities.total} ({activities.system} sistema · {activities.declared} adicionais)</span>
                <span className={`font-medium ${
                  trustRatio >= 0.8 ? 'text-emerald-600' : trustRatio >= 0.6 ? 'text-blue-600' : trustRatio >= 0.4 ? 'text-amber-600' : 'text-red-600'
                }`}>{Math.round(trustRatio * 100)}% no sistema</span>
              </div>
            </div>

            {/* Consultant notes */}
            {report && (report.notes_wins || report.notes_challenges || report.notes_next_week) && (
              <div className="pb-6 border-b">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notas do consultor</h4>
                <div className="space-y-2.5">
                  {report.notes_wins && (
                    <div className="rounded-xl bg-emerald-50/50 p-3">
                      <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider mb-0.5">Correu bem</p>
                      <p className="text-xs text-emerald-800">{report.notes_wins}</p>
                    </div>
                  )}
                  {report.notes_challenges && (
                    <div className="rounded-xl bg-amber-50/50 p-3">
                      <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider mb-0.5">Dificuldades</p>
                      <p className="text-xs text-amber-800">{report.notes_challenges}</p>
                    </div>
                  )}
                  {report.notes_next_week && (
                    <div className="rounded-xl bg-blue-50/50 p-3">
                      <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wider mb-0.5">Próxima semana</p>
                      <p className="text-xs text-blue-800">{report.notes_next_week}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI advice */}
            {report?.ai_advice && (() => {
              try {
                const advice = JSON.parse(report.ai_advice)
                return (
                  <div className="rounded-xl bg-purple-50/50 border border-purple-100 p-4">
                    <p className="text-[10px] text-purple-600 font-medium uppercase tracking-wider mb-1">Conselho IA</p>
                    {advice.weekly_tips?.map((tip: string, i: number) => (
                      <p key={i} className="text-xs text-purple-800 mb-1">• {tip}</p>
                    ))}
                  </div>
                )
              } catch { return null }
            })()}

            {/* Manager feedback */}
            {report && (status === 'submitted' || status === 'reviewed') && onReview && (
              <div className="pt-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <MessageSquare className="h-3 w-3" />
                  Feedback do manager
                </h4>
                <Textarea
                  placeholder="Escreve feedback para o consultor..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[80px] rounded-xl text-xs resize-none"
                  disabled={status === 'reviewed'}
                />
                {status !== 'reviewed' && (
                  <Button
                    size="sm"
                    onClick={handleSendFeedback}
                    disabled={!feedback.trim() || isSending}
                    className="rounded-xl text-xs mt-2"
                  >
                    {isSending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                    Enviar feedback e marcar como revisto
                  </Button>
                )}
                {status === 'reviewed' && report.manager_feedback && (
                  <div className="rounded-xl bg-muted/50 p-3 mt-2">
                    <p className="text-xs">{report.manager_feedback}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
