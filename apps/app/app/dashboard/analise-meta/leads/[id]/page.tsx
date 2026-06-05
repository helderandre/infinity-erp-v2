import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mail,
  Phone,
  Target,
  User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatQuestionType } from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lead — Análise Meta' }

interface FormQuestionOption {
  key: string
  value: string
}

interface FormQuestion {
  id: string
  key: string
  label: string
  type: string
  options?: FormQuestionOption[]
}

interface LeadFieldData {
  name: string
  values: string[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

function fmtPt(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/**
 * Resolve uma resposta crua (string) para o seu valor humanizado, quando a
 * pergunta é tipo CUSTOM com opções declaradas. A Meta envia as chaves
 * normalizadas (ex.: `t1_-_desde_€305.000_`); queremos o `value` (ex.:
 * `T1 - desde €305.000`).
 */
function resolveAnswerValue(
  rawValue: string,
  question: FormQuestion | undefined,
): string {
  if (!question?.options) return rawValue
  const opt = question.options.find((o) => o.key === rawValue)
  return opt?.value ?? rawValue
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (!UUID_RE.test(id)) notFound()

  const supabase = createCrmAdminClient()
  const leadRes = await supabase
    .schema('meta')
    .from('meta_leads_raw')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!leadRes.data) notFound()

  const lead = leadRes.data

  // Carregar form (perguntas) + campaign/ad (nomes) em paralelo
  const [formRes, campRes, adRes] = await Promise.all([
    lead.form_id
      ? supabase
          .schema('meta')
          .from('meta_forms_raw')
          .select('form_id, form_name, payload')
          .eq('form_id', lead.form_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    lead.campaign_id
      ? supabase
          .schema('meta')
          .from('meta_campaigns_raw')
          .select('campaign_id, name')
          .eq('campaign_id', lead.campaign_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    lead.ad_id
      ? supabase
          .schema('meta')
          .from('meta_ads_raw')
          .select('ad_id, name')
          .eq('ad_id', lead.ad_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const form = formRes.data
  const campaign = campRes.data
  const ad = adRes.data

  const questions: FormQuestion[] =
    (form?.payload as { form?: { questions?: FormQuestion[] } } | undefined)
      ?.form?.questions ?? []
  const questionByKey = new Map(questions.map((q) => [q.key, q]))

  const fieldData: LeadFieldData[] =
    (lead.payload as { lead?: { field_data?: LeadFieldData[] } } | undefined)
      ?.lead?.field_data ?? []

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/analise-meta/leads">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <User className="text-muted-foreground h-5 w-5" />
          <h1 className="text-2xl font-semibold">
            {lead.full_name ?? '(sem nome)'}
          </h1>
          {lead.processed ? (
            <Badge variant="default" className="gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3" />
              Processado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Por processar
            </Badge>
          )}
          {lead.lead_id && (
            <Badge variant="secondary" className="text-[10px]">
              Associado a CRM
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground font-mono text-xs">
          ID Facebook: {lead.leadgen_id}
        </p>
      </div>

      {/* Contacto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {lead.email && (
            <p className="flex items-center gap-2">
              <Mail className="text-muted-foreground h-4 w-4" />
              <a
                href={`mailto:${lead.email}`}
                className="hover:underline"
              >
                {lead.email}
              </a>
            </p>
          )}
          {lead.phone && (
            <p className="flex items-center gap-2">
              <Phone className="text-muted-foreground h-4 w-4" />
              <a
                href={`tel:${lead.phone.replace(/\s/g, '')}`}
                className="hover:underline"
              >
                {lead.phone}
              </a>
            </p>
          )}
          {!lead.email && !lead.phone && (
            <p className="text-muted-foreground text-sm">
              Sem dados de contacto.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Respostas ao formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respostas ao formulário</CardTitle>
          {form && (
            <CardDescription>
              <Link
                href={`/dashboard/analise-meta/formularios/${form.form_id}`}
                className="hover:underline"
              >
                {form.form_name ?? form.form_id}
              </Link>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {fieldData.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sem field_data no payload deste lead.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {fieldData.map((fd) => {
                const q = questionByKey.get(fd.name)
                return (
                  <li key={fd.name} className="space-y-1 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">
                        {q?.label ?? fd.name}
                      </p>
                      {q?.type && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {formatQuestionType(q.type)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {fd.values.length === 0 ? (
                        <span>—</span>
                      ) : fd.values.length === 1 ? (
                        <span className="text-foreground">
                          {resolveAnswerValue(fd.values[0], q)}
                        </span>
                      ) : (
                        <ul className="text-foreground list-disc pl-5">
                          {fd.values.map((v, i) => (
                            <li key={`${v}-${i}`}>
                              {resolveAnswerValue(v, q)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Origem (form / campanha / ad) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Origem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <OriginRow
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Formulário"
            name={form?.form_name ?? null}
            id={lead.form_id}
            href={
              lead.form_id
                ? `/dashboard/analise-meta/formularios/${lead.form_id}`
                : null
            }
          />
          <OriginRow
            icon={<Target className="h-3.5 w-3.5" />}
            label="Campanha"
            name={campaign?.name ?? null}
            id={lead.campaign_id}
            href={
              lead.campaign_id
                ? `/dashboard/analise-meta/campanhas/${lead.campaign_id}`
                : null
            }
          />
          <OriginRow
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            label="Anúncio"
            name={ad?.name ?? null}
            id={lead.ad_id}
            href={
              lead.ad_id
                ? `/dashboard/analise-meta/ads/${lead.ad_id}`
                : null
            }
          />
          {lead.page_id && (
            <OriginRow
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              label="Page"
              name={null}
              id={lead.page_id}
              href={null}
            />
          )}
        </CardContent>
      </Card>

      {/* Datas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p className="flex items-center gap-2">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground">Criado no Facebook:</span>{' '}
            <span>{fmtPt(lead.fb_created_time)}</span>
            <span className="text-muted-foreground text-xs">
              ({fmtRelative(lead.fb_created_time)})
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground">Recebido pelo ERP:</span>{' '}
            <span>{fmtPt(lead.received_at)}</span>
            <span className="text-muted-foreground text-xs">
              ({fmtRelative(lead.received_at)})
            </span>
          </p>
          {lead.processed && lead.processed_at && (
            <p className="flex items-center gap-2">
              <CheckCircle2 className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">Processado:</span>{' '}
              <span>{fmtPt(lead.processed_at)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OriginRow({
  icon,
  label,
  name,
  id,
  href,
}: {
  icon: React.ReactNode
  label: string
  name: string | null
  id: string | null
  href: string | null
}) {
  if (!id) {
    return (
      <p className="flex items-center gap-2">
        {icon}
        <span className="text-muted-foreground">{label}:</span>{' '}
        <span className="text-muted-foreground/70">—</span>
      </p>
    )
  }

  return (
    <p className="flex items-center gap-2">
      {icon}
      <span className="text-muted-foreground">{label}:</span>{' '}
      {href ? (
        <Link href={href} className="hover:underline">
          {name ?? (
            <span className="text-muted-foreground font-mono text-xs">
              {id}
            </span>
          )}
        </Link>
      ) : name ? (
        <span>{name}</span>
      ) : (
        <span className="text-muted-foreground font-mono text-xs">{id}</span>
      )}
    </p>
  )
}
