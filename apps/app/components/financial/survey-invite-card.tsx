'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Star,
  MessageCircle,
  Mail,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SurveySummary {
  id: string
  token: string
  invited_at: string
  completed_at: string | null
  q6_experiencia_global: string | null
  q7_recomendaria: string | null
  google_review_clicked_at: string | null
}

interface SurveyInviteCardProps {
  dealId: string
  dealStatus: string | null
  className?: string
}

function buildPublicUrl(token: string): string {
  if (typeof window === 'undefined') return `/inquerito/${token}`
  return `${window.location.origin}/inquerito/${token}`
}

export function SurveyInviteCard({ dealId, dealStatus, className }: SurveyInviteCardProps) {
  const [surveys, setSurveys] = useState<SurveySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviting, setIsInviting] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const refetch = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/satisfaction-surveys`)
      if (res.ok) {
        const { data } = await res.json()
        setSurveys(data ?? [])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  const handleInvite = async () => {
    setIsInviting(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/satisfaction-survey/invite?reuse=pending`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Erro ao gerar convite')
        return
      }
      const { data } = await res.json()
      toast.success(data.reused ? 'Convite reaberto' : 'Convite criado')
      await refetch()
      // Auto-copy URL on creation
      try {
        await navigator.clipboard.writeText(buildPublicUrl(data.token))
        setCopiedToken(data.token)
        toast.success('URL copiado para a área de transferência')
        setTimeout(() => setCopiedToken(null), 2500)
      } catch {
        // clipboard may be blocked — silently ignore
      }
    } finally {
      setIsInviting(false)
    }
  }

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildPublicUrl(token))
      setCopiedToken(token)
      toast.success('URL copiado')
      setTimeout(() => setCopiedToken(null), 2500)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const handleWhatsApp = (token: string) => {
    const url = buildPublicUrl(token)
    const text = encodeURIComponent(
      `Olá! Gostaríamos muito de saber a sua opinião sobre o processo. ` +
      `Demora menos de 2 minutos:\n${url}\n\nObrigado pela confiança!\n— Equipa Infinity Group`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
  }

  const handleEmail = (token: string) => {
    const url = buildPublicUrl(token)
    const subject = encodeURIComponent('Inquérito de satisfação — Infinity Group')
    const body = encodeURIComponent(
      `Olá!\n\nGostaríamos muito de saber a sua opinião sobre a nossa equipa e o processo. ` +
      `Demora menos de 2 minutos:\n\n${url}\n\nObrigado pela confiança!\n\n— Equipa Infinity Group`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self')
  }

  const pending = surveys.find((s) => !s.completed_at)
  const completed = surveys.filter((s) => s.completed_at)

  // Permite criar convites mesmo antes de status='completed' (consultor pode preferir antes)
  // — o gating fica sob critério editorial.

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm p-5 space-y-4', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center">
            <Star className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Inquérito de Satisfação</h3>
            <p className="text-[11px] text-muted-foreground">
              Envia um link ao cliente após o fecho — gera review no Google se a experiência for positiva.
            </p>
          </div>
        </div>
        {completed.length > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {completed.length} respondido{completed.length === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      {dealStatus !== 'completed' && (
        <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          O negócio ainda não está marcado como concluído. Podes enviar o inquérito mesmo assim, mas
          tipicamente faz mais sentido após a escritura.
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          A carregar…
        </div>
      ) : pending ? (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Convite criado a {new Date(pending.invited_at).toLocaleDateString('pt-PT')} — ainda não respondido.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={buildPublicUrl(pending.token)}
                className="flex-1 text-xs font-mono"
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(pending.token)}
                className="shrink-0 gap-1.5"
              >
                {copiedToken === pending.token ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copiar
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                onClick={() => handleWhatsApp(pending.token)}
                className="bg-[#25D366] hover:bg-[#1da851] gap-1.5"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleEmail(pending.token)}
                className="gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleInvite}
                disabled={isInviting}
                className="gap-1.5 ml-auto"
                title="Gerar novo token (invalida o anterior se este ainda não tiver sido respondido)"
              >
                {isInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Re-emitir
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={handleInvite}
          disabled={isInviting}
          className="gap-1.5"
        >
          {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
          Convidar cliente para inquérito
        </Button>
      )}

      {completed.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Respostas
          </p>
          {completed.map((s) => {
            const promoter =
              (s.q6_experiencia_global === 'excelente' || s.q6_experiencia_global === 'boa') &&
              s.q7_recomendaria === 'sim_com_certeza'
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-md border bg-muted/10 px-3 py-2 text-xs"
              >
                {promoter ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="flex-1">
                  Respondido em {new Date(s.completed_at!).toLocaleDateString('pt-PT')}
                  {promoter && <span className="ml-1.5 text-emerald-700">· Promoter</span>}
                </span>
                {s.google_review_clicked_at && (
                  <Badge variant="outline" className="text-[9px] gap-0.5">
                    <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-400" />
                    Review
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
