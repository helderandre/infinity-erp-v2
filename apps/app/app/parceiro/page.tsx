'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, CheckCircle2, Clock, XCircle, Plus, RefreshCw,
  ArrowRight, MessageSquare, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { usePartner } from './layout'

interface Referral {
  id: string
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  contact_name: string
  pipeline_stage: string | null
  pipeline_stage_color: string | null
  is_won: boolean
  is_lost: boolean
  is_terminal: boolean
}

interface Summary {
  total: number
  pending: number
  accepted: number
  converted: number
  lost: number
  rejected: number
  conversion_rate: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', icon: Clock },
  accepted: { label: 'Aceite', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', icon: CheckCircle2 },
  converted: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', icon: CheckCircle2 },
  lost: { label: 'Perdido', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: XCircle },
  rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', icon: XCircle },
}

export default function PartnerDashboard() {
  const partner = usePartner()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reassignDialog, setReassignDialog] = useState<{ id: string; name: string } | null>(null)
  const [reassignReason, setReassignReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/parceiro/referrals')
      if (res.ok) {
        const data = await res.json()
        setReferrals(data.referrals ?? [])
        setSummary(data.summary ?? null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleReassign = async () => {
    if (!reassignDialog) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/parceiro/request-reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral_id: reassignDialog.id, reason: reassignReason }),
      })
      if (res.ok) {
        toast.success('Pedido enviado à agência')
        setReassignDialog(null)
        setReassignReason('')
      } else {
        toast.error('Erro ao enviar pedido')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">Olá, {partner?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe as suas referências e submeta novas leads.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Total" value={summary.total} icon={Users} color="blue" />
          <SummaryCard label="Pendentes" value={summary.pending} icon={Clock} color="amber" />
          <SummaryCard label="Convertidos" value={summary.converted} icon={CheckCircle2} color="emerald" />
          <SummaryCard label="Conversão" value={`${summary.conversion_rate}%`} icon={ArrowRight} color="indigo" />
        </div>
      )}

      {/* Action */}
      <Button asChild className="w-full rounded-xl h-12 text-sm">
        <Link href="/parceiro/nova-lead">
          <Plus className="h-4 w-4 mr-2" />
          Submeter Nova Lead
        </Link>
      </Button>

      {/* Referrals List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">As suas referências</h2>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading} className="rounded-full h-7 text-xs">
            <RefreshCw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : referrals.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Ainda não tem referências.</p>
            <p className="text-xs text-muted-foreground mt-1">Submeta uma lead para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((r, idx) => {
              const status = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending
              return (
                <div
                  key={r.id}
                  className="rounded-xl border bg-card/50 p-4 transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.contact_name}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className={cn("text-[9px] rounded-full px-2", status.color)}>
                          {status.label}
                        </Badge>
                        {r.pipeline_stage && (
                          <Badge variant="outline" className="text-[9px] rounded-full px-2"
                            style={r.pipeline_stage_color ? { borderColor: r.pipeline_stage_color, color: r.pipeline_stage_color } : {}}>
                            {r.pipeline_stage}
                          </Badge>
                        )}
                        {r.is_won && (
                          <Badge className="text-[9px] rounded-full px-2 bg-emerald-500 text-white">
                            Ganho
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Referido {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: pt })}
                        {r.updated_at !== r.created_at && (
                          <> · Actualizado {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: pt })}</>
                        )}
                      </p>
                    </div>

                    {!r.is_terminal && r.status !== 'rejected' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 rounded-full h-7 text-[10px]"
                        onClick={() => setReassignDialog({ id: r.id, name: r.contact_name })}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Pedir reatribuição
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reassign Dialog */}
      <Dialog open={!!reassignDialog} onOpenChange={o => !o && setReassignDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Pedir Reatribuição</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Quer que outro consultor acompanhe a lead <strong>{reassignDialog?.name}</strong>?
            A agência será notificada.
          </p>
          <Textarea
            placeholder="Motivo (opcional)..."
            value={reassignReason}
            onChange={e => setReassignReason(e.target.value)}
            rows={3}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setReassignDialog(null)}>Cancelar</Button>
            <Button className="rounded-full" onClick={handleReassign} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Enviar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400',
  }
  return (
    <div className="rounded-xl border bg-card/50 p-4">
      <div className="flex items-center gap-2.5">
        <div className={cn("p-2 rounded-lg", colors[color]?.split(' ').slice(0, 2).join(' '))}>
          <Icon className={cn("h-4 w-4", colors[color]?.split(' ').slice(2).join(' '))} />
        </div>
        <div>
          <p className="text-lg font-bold">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}
