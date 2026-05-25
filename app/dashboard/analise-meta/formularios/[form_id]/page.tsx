import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Mail,
  Phone,
  Tag,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatLocale,
  formatMetaStatus,
  formatQuestionType,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Formulário — Análise Meta' }

interface FormQuestion {
  id: string
  key: string
  label: string
  type: string
  options?: Array<{ key: string; value: string }>
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

interface LeadFieldData {
  name: string
  values: string[]
}

interface LeadEventEnvelope {
  lead?: { field_data?: LeadFieldData[] }
}

/**
 * Tally das respostas: Map<question_key, Map<answer_value_or_key, count>>.
 * Para perguntas de escolha múltipla, o lead pode ter múltiplas entradas no
 * mesmo `values` array — cada uma conta como uma resposta separada.
 */
function tallyAnswers(
  leads: Array<{ payload: unknown }>,
): Map<string, Map<string, number>> {
  const tally = new Map<string, Map<string, number>>()
  for (const lead of leads) {
    const fieldData =
      (lead.payload as LeadEventEnvelope | undefined)?.lead?.field_data ?? []
    for (const fd of fieldData) {
      if (!fd?.name || !Array.isArray(fd.values)) continue
      let questionMap = tally.get(fd.name)
      if (!questionMap) {
        questionMap = new Map()
        tally.set(fd.name, questionMap)
      }
      for (const v of fd.values) {
        questionMap.set(v, (questionMap.get(v) ?? 0) + 1)
      }
    }
  }
  return tally
}

function fmtPt(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default async function FormularioDetailPage({
  params,
}: {
  params: Promise<{ form_id: string }>
}) {
  const { form_id } = await params
  const supabase = createCrmAdminClient()

  const [formRes, settingsRes, leadsCountRes, leadsRes, statsLeadsRes] =
    await Promise.all([
      supabase
        .schema('meta')
        .from('meta_forms_raw')
        .select('*')
        .eq('form_id', form_id)
        .maybeSingle(),
      supabase
        .schema('meta')
        .from('meta_form_settings')
        .select('*, meta_form_groups(id, name, color)')
        .eq('form_id', form_id)
        .maybeSingle(),
      supabase
        .schema('meta')
        .from('meta_leads_raw')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', form_id),
      supabase
        .schema('meta')
        .from('meta_leads_raw')
        .select(
          'id, leadgen_id, email, full_name, phone, received_at, fb_created_time, processed, lead_id',
        )
        .eq('form_id', form_id)
        .order('fb_created_time', { ascending: false, nullsFirst: false })
        .order('received_at', { ascending: false })
        .limit(20),
      // Para estatísticas: precisamos do field_data de TODOS os leads (cap 5000
      // por segurança; em forms enormes mostraremos um aviso).
      supabase
        .schema('meta')
        .from('meta_leads_raw')
        .select('payload')
        .eq('form_id', form_id)
        .limit(5000),
    ])

  if (!formRes.data) notFound()

  const form = formRes.data
  const settings = settingsRes.data
  const totalLeads = leadsCountRes.count ?? 0
  const recentLeads = leadsRes.data ?? []
  const questions: FormQuestion[] =
    (form.payload as { form?: { questions?: FormQuestion[] } })?.form
      ?.questions ?? []

  // Tally das respostas para as perguntas tipo CUSTOM com opções
  const statsLeads = statsLeadsRes.data ?? []
  const answerTally = tallyAnswers(statsLeads)
  const statsTruncated = statsLeads.length >= 5000

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/dashboard/analise-meta/formularios">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground h-5 w-5" />
            <h1 className="text-2xl font-semibold">
              {form.form_name ?? '(sem nome)'}
            </h1>
            <Badge variant={metaStatusVariant(form.status)} className="text-[10px]">
              {formatMetaStatus(form.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-xs">{form.form_id}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile label="Leads" value={totalLeads} icon={<User className="h-4 w-4" />} />
        <KpiTile
          label="Idioma"
          value={formatLocale(form.locale)}
          icon={<Globe className="h-4 w-4" />}
        />
        <KpiTile
          label="Criado"
          value={fmtRelative(form.fb_created_time)}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Settings interno do CRM */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Definições internas</CardTitle>
            <CardDescription>
              Configuração específica do CRM para este formulário (não vem da Meta).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Row label="Nome de exibição" value={settings.display_name ?? '—'} />
              <Row
                label="Idioma"
                value={
                  <span>
                    {settings.language}
                    {settings.language_auto_detected && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (auto)
                      </span>
                    )}
                  </span>
                }
              />
              {settings.meta_form_groups && (
                <Row
                  label="Grupo"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Tag className="h-3 w-3" />
                      {(settings.meta_form_groups as { name: string }).name}
                    </span>
                  }
                />
              )}
              <Row label="Variante" value={settings.variant_label ?? '—'} />
            </div>
            {settings.notes && (
              <div className="mt-3 rounded-md border p-3 text-sm">
                <p className="text-muted-foreground mb-1 text-xs uppercase">
                  Notas
                </p>
                {settings.notes}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Perguntas
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              ({questions.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              — sem perguntas registadas no payload —
            </p>
          ) : (
            <ol className="divide-y rounded-md border">
              {questions.map((q, idx) => (
                <li key={q.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <span className="text-muted-foreground mr-2 text-xs tabular-nums">
                          {idx + 1}.
                        </span>
                        {q.label}
                      </p>
                      <p className="text-muted-foreground font-mono text-[10px]">
                        key: {q.key}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {formatQuestionType(q.type)}
                    </Badge>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <ul className="mt-2 ml-6 space-y-0.5 text-sm">
                      {q.options.map((opt) => (
                        <li
                          key={opt.key}
                          className="text-muted-foreground flex items-center gap-2"
                        >
                          <span className="text-foreground">•</span>
                          {opt.value}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Answer stats — percentagens por opção em CUSTOM */}
      <AnswerStatsCard
        questions={questions}
        tally={answerTally}
        truncated={statsTruncated}
        totalLeads={totalLeads}
      />

      {/* Recent leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Leads recentes
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              ({recentLeads.length} de {totalLeads})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentLeads.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Ainda não chegou nenhum lead deste formulário.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="w-[140px]">Criado</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/dashboard/analise-meta/leads/${lead.id}`}
                          className="flex items-center gap-1.5 font-medium hover:underline"
                        >
                          <User className="text-muted-foreground h-3.5 w-3.5" />
                          {lead.full_name ?? '—'}
                        </Link>
                        {lead.email && (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtRelative(lead.fb_created_time ?? lead.received_at)}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  // Plain divs em vez de dt/dd: jsx-a11y não consegue analisar a relação dl→dt/dd
  // através de helpers/fragments e o linter dispara false positives em ambos os
  // sentidos (filhos não-permitidos no <dl>, ou dt/dd "órfãos" no helper).
  // Trocar para divs preserva o layout (CSS grid) e silencia o linter sem hacks.
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </>
  )
}

/**
 * Renderiza percentagens por opção para perguntas tipo CUSTOM com options
 * definidas (single/multiple choice). Para perguntas tipo CUSTOM sem options
 * (texto livre) e para perguntas standard (EMAIL/PHONE/FULL_NAME), apenas
 * indica o nº de respostas — não há sentido em "percentagem".
 */
function AnswerStatsCard({
  questions,
  tally,
  truncated,
  totalLeads,
}: {
  questions: FormQuestion[]
  tally: Map<string, Map<string, number>>
  truncated: boolean
  totalLeads: number
}) {
  const choiceQuestions = questions.filter(
    (q) => q.type === 'CUSTOM' && (q.options?.length ?? 0) > 0,
  )

  if (choiceQuestions.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estatísticas das respostas</CardTitle>
        <CardDescription>
          Distribuição de escolhas por pergunta de selecção. Baseado em{' '}
          {totalLeads} lead{totalLeads === 1 ? '' : 's'}
          {truncated && ' (limitado às últimas 5000)'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {choiceQuestions.map((q) => {
          const counts = tally.get(q.key) ?? new Map<string, number>()
          // Total de respostas DECLARADAS dentro das opções do form (ignora
          // respostas com keys "fantasma" que não correspondem a nenhuma opção
          // — pode acontecer em forms reeditados). Para multiple-choice, soma
          // > nº de leads.
          const knownTotal = q.options!.reduce(
            (s, opt) => s + (counts.get(opt.key) ?? 0),
            0,
          )

          return (
            <div key={q.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{q.label}</p>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {knownTotal} resposta{knownTotal === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="space-y-1.5">
                {q.options!.map((opt) => {
                  const n = counts.get(opt.key) ?? 0
                  const pct = knownTotal > 0 ? (n / knownTotal) * 100 : 0
                  return (
                    <li key={opt.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{opt.value}</span>
                        <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                          {n} <span className="text-[10px]">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      {/* SVG em vez de div+inline-style: a largura dinâmica
                          (0-100%) entra como atributo `width` do <rect>, NÃO
                          como style — satisfaz o linter sem disable. ViewBox
                          0..100 + preserveAspectRatio="none" faz o rect
                          escalar para a largura do container. */}
                      <svg
                        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                        viewBox="0 0 100 1"
                        preserveAspectRatio="none"
                        aria-label={`${pct.toFixed(0)} por cento`}
                      >
                        <rect
                          x={0}
                          y={0}
                          width={pct}
                          height={1}
                          className="fill-primary"
                        />
                      </svg>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
