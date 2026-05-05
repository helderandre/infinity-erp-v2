'use client'

import { useEffect, useState } from 'react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Sparkles, RefreshCw, Loader2, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, Heart, CalendarDays, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Mini renderer markdown — só **negrito**, *itálico* e parágrafos
 * separados por linhas vazias. Suficiente para os resumos da IA sem
 * adicionar uma dependência. Sanitização nativa: usamos React text nodes,
 * nunca dangerouslySetInnerHTML.
 */
function renderMarkdown(text: string): React.ReactNode {
  // Split em parágrafos por linhas vazias (\n\n) ou single \n.
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return paragraphs.map((para, pIdx) => (
    <p key={pIdx} className="leading-relaxed">
      {renderInline(para)}
    </p>
  ))
}

function renderInline(text: string): React.ReactNode[] {
  // Token regex — captura **bold**, *italic* (não conflita porque ** vai primeiro)
  const tokens: React.ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      tokens.push(<strong key={`b-${key++}`} className="font-semibold text-foreground">{m[1]}</strong>)
    } else if (m[2] !== undefined) {
      tokens.push(<em key={`i-${key++}`}>{m[2]}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push(text.slice(last))
  return tokens
}

interface AiProfileShape {
  summary_md?: string | null
  traits?: string[]
  preferences?: string[]
  concerns?: string[]
  opportunities?: string[]
  key_dates?: { label: string; date: string }[]
  data_quality?: 'low' | 'medium' | 'high'
}

interface ProfileResponse {
  ai_profile: AiProfileShape | null
  ai_profile_summary_md: string | null
  ai_profile_generated_at: string | null
}

interface ClientProfileCardProps {
  contactId: string
  /** Bumped by the parent whenever activities change — triggers a "stale" hint */
  invalidateKey?: number
}

export function ClientProfileCard({ contactId, invalidateKey }: ClientProfileCardProps) {
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [staleSince, setStaleSince] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/leads/${contactId}/ai-profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        setData(json)
      })
      .catch(() => {})
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [contactId])

  // Track when the parent signals new activities arrived after the last
  // generation — show "perfil desactualizado" hint
  useEffect(() => {
    if (typeof invalidateKey === 'number' && invalidateKey > 0 && data?.ai_profile_generated_at) {
      setStaleSince(Date.now())
    }
  }, [invalidateKey, data?.ai_profile_generated_at])

  async function generate() {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/leads/${contactId}/ai-profile`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao gerar perfil')
      }
      const json = await res.json()
      setData(json)
      setStaleSince(null)
      toast.success('Perfil gerado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar perfil')
    } finally {
      setIsGenerating(false)
    }
  }

  const profile = data?.ai_profile
  const generatedAt = data?.ai_profile_generated_at
    ? parseISO(data.ai_profile_generated_at)
    : null
  const summaryMd = data?.ai_profile_summary_md ?? profile?.summary_md ?? null

  // Empty state — never generated
  if (!isLoading && !profile) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 bg-card/30 backdrop-blur-sm px-4 py-5 flex flex-col items-center text-center">
        <div className="h-10 w-10 rounded-2xl bg-muted/50 flex items-center justify-center mb-2">
          <Sparkles className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium">Perfil do cliente</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
          Sintetiza com IA todas as observações, interacções e negócios deste cliente num perfil estruturado.
        </p>
        <Button
          size="sm"
          onClick={generate}
          disabled={isGenerating}
          className="mt-3 rounded-full text-xs h-8"
        >
          {isGenerating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          Gerar perfil
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-violet-500/5 to-blue-500/5 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Perfil do cliente</p>
            <p className="text-[10px] text-muted-foreground/80 mt-0.5">
              {generatedAt
                ? `Gerado ${formatDistanceToNow(generatedAt, { addSuffix: true, locale: pt })}`
                : 'Nunca gerado'}
              {profile?.data_quality && (
                <>
                  {' · '}
                  <span
                    className={cn(
                      'font-medium',
                      profile.data_quality === 'high'
                        ? 'text-emerald-600'
                        : profile.data_quality === 'medium'
                        ? 'text-amber-600'
                        : 'text-red-500'
                    )}
                  >
                    qualidade {profile.data_quality === 'high' ? 'alta' : profile.data_quality === 'medium' ? 'média' : 'baixa'}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={generate}
            disabled={isGenerating}
            className="h-7 px-2.5 rounded-full text-xs"
            title="Regerar com dados mais recentes"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 p-0 rounded-full"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Stale hint */}
      {staleSince && (
        <div className="mx-4 mb-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-amber-700 dark:text-amber-400">
            Novas observações desde a última síntese — pode regerar.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={generate}
            disabled={isGenerating}
            className="h-6 px-2 text-[11px] rounded-full text-amber-700 hover:text-amber-800 hover:bg-amber-500/15"
          >
            Regerar
          </Button>
        </div>
      )}

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {summaryMd && (
            <div className="text-sm text-foreground leading-relaxed space-y-2">
              {renderMarkdown(summaryMd)}
            </div>
          )}

          {profile?.traits && profile.traits.length > 0 && (
            <ProfileSection
              icon={Heart}
              iconClass="text-rose-600 bg-rose-500/10"
              title="Traços"
              items={profile.traits}
            />
          )}
          {profile?.preferences && profile.preferences.length > 0 && (
            <ProfileSection
              icon={Target}
              iconClass="text-emerald-600 bg-emerald-500/10"
              title="Preferências"
              items={profile.preferences}
            />
          )}
          {profile?.concerns && profile.concerns.length > 0 && (
            <ProfileSection
              icon={AlertTriangle}
              iconClass="text-amber-600 bg-amber-500/10"
              title="Preocupações / Objecções"
              items={profile.concerns}
            />
          )}
          {profile?.opportunities && profile.opportunities.length > 0 && (
            <ProfileSection
              icon={Lightbulb}
              iconClass="text-violet-600 bg-violet-500/10"
              title="Próximas acções / Oportunidades"
              items={profile.opportunities}
            />
          )}
          {profile?.key_dates && profile.key_dates.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Datas-chave
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-8">
                {profile.key_dates.map((kd, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="rounded-full text-[11px] font-normal"
                  >
                    {kd.label} · {tryFormatDate(kd.date)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProfileSection({
  icon: Icon,
  iconClass,
  title,
  items,
}: {
  icon: React.ElementType
  iconClass: string
  title: string
  items: string[]
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center', iconClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <ul className="space-y-0.5 pl-8">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-foreground/90 leading-snug">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function tryFormatDate(s: string): string {
  try {
    return format(parseISO(s), "d 'de' MMM yyyy", { locale: pt })
  } catch {
    return s
  }
}
