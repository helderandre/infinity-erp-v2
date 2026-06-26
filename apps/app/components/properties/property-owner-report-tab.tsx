'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  FileText,
  Loader2,
  Download,
  ExternalLink,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useOwnerReports } from '@/hooks/use-owner-reports'

type BlockKey = 'funnel' | 'meta' | 'visits' | 'feedback' | 'price' | 'portals'

const BLOCKS: { key: BlockKey; label: string; hint: string }[] = [
  { key: 'funnel', label: 'Funil de conversão', hint: 'Leads → pedidos → visitas → interessados' },
  { key: 'meta', label: 'Campanhas Meta', hint: 'Impressões, cliques e leads das campanhas' },
  { key: 'visits', label: 'Detalhe de visitas', hint: 'Agendadas, realizadas, não comparecidas' },
  { key: 'feedback', label: 'Feedback das visitas', hint: 'Médias das fichas (anonimizado)' },
  { key: 'price', label: 'Preço pedido vs. valor percebido', hint: 'Compara com o valor das fichas' },
  { key: 'portals', label: 'Visualizações nos portais', hint: 'Valores introduzidos manualmente' },
]

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function PropertyOwnerReportTab({ propertyId }: { propertyId: string }) {
  const { items, loading, refetch } = useOwnerReports(propertyId)

  const [blocks, setBlocks] = useState<Record<BlockKey, boolean>>({
    funnel: true,
    meta: true,
    visits: true,
    feedback: true,
    price: true,
    portals: false,
  })
  const [agentNote, setAgentNote] = useState('')
  const [portals, setPortals] = useState({
    idealista: '',
    imovirtual: '',
    casaSapo: '',
    website: '',
  })
  const [generating, setGenerating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toNum = (v: string) => {
    const t = v.trim()
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }

  async function generate() {
    setGenerating(true)
    const tId = toast.loading('A gerar relatório… (pode demorar alguns segundos)')
    try {
      const res = await fetch(`/api/properties/${propertyId}/owner-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks,
          agentNote: agentNote.trim() || null,
          portalViews: {
            idealista: toNum(portals.idealista),
            imovirtual: toNum(portals.imovirtual),
            casaSapo: toNum(portals.casaSapo),
            website: toNum(portals.website),
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao gerar relatório')
      toast.success('Relatório gerado com sucesso', { id: tId })
      if (json.pdf_url) window.open(json.pdf_url, '_blank')
      await refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar relatório', { id: tId })
    } finally {
      setGenerating(false)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/properties/${propertyId}/owner-report/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast.success('Relatório eliminado')
      await refetch()
    } catch {
      toast.error('Erro ao eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {/* ── Configurador ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Configurar relatório</h3>
        </div>

        {/* Blocos */}
        <div className="space-y-2.5">
          {BLOCKS.map((b) => (
            <div key={b.key} className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={`block-${b.key}`} className="text-sm font-medium text-slate-800">
                  {b.label}
                </Label>
                <p className="text-[11px] text-muted-foreground">{b.hint}</p>
              </div>
              <Switch
                id={`block-${b.key}`}
                checked={blocks[b.key]}
                onCheckedChange={(v) => setBlocks((s) => ({ ...s, [b.key]: v }))}
              />
            </div>
          ))}
        </div>

        {/* Portais (manual) */}
        {blocks.portals && (
          <>
            <Separator className="my-4" />
            <Label className="text-sm font-medium text-slate-800">Visualizações nos portais</Label>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Introduz os valores que vês em cada portal (deixa vazio se não aplicável).
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['idealista', 'Idealista'],
                  ['imovirtual', 'Imovirtual'],
                  ['casaSapo', 'Casa Sapo'],
                  ['website', 'Website'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-[11px] text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={portals[key]}
                    onChange={(e) => setPortals((s) => ({ ...s, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Feedback agregado — nota de privacidade (limiar fixo: 2 fichas) */}
        {blocks.feedback && (
          <>
            <Separator className="my-4" />
            <p className="text-[11px] text-muted-foreground">
              O feedback das visitas é apresentado de forma agregada (médias) e só aparece a partir
              de <span className="font-medium text-slate-700">2 fichas</span> com consentimento de
              partilha, para salvaguardar a privacidade dos visitantes.
            </p>
          </>
        )}

        {/* Nota do consultor */}
        <Separator className="my-4" />
        <Label htmlFor="agent-note" className="text-sm font-medium text-slate-800">
          Nota do consultor <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="agent-note"
          className="mt-1.5"
          rows={3}
          placeholder="Recomendações / próximos passos para o proprietário…"
          value={agentNote}
          onChange={(e) => setAgentNote(e.target.value)}
        />

        <Button onClick={generate} disabled={generating} className="mt-5 w-full">
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A gerar…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" /> Gerar relatório PDF
            </>
          )}
        </Button>
      </div>

      {/* ── Histórico ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Histórico</h3>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-[12px] text-muted-foreground">
            Ainda não há relatórios gerados.
          </p>
        ) : (
          <div className="space-y-2.5">
            {items.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">v{r.version}</span>
                  {r.status === 'ready' ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                      Pronto
                    </span>
                  ) : r.status === 'generating' ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                      A gerar…
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-700">
                      Erro
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(r.created_at)}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  {r.pdf_url && (
                    <>
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                        <a href={r.pdf_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" /> Abrir
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                        <a href={r.pdf_url} download>
                          <Download className="mr-1 h-3 w-3" /> Descarregar
                        </a>
                      </Button>
                    </>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7 px-2 text-[11px] text-red-600 hover:text-red-700"
                        disabled={deletingId === r.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar relatório</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem a certeza de que pretende eliminar a versão {r.version}? Esta acção é
                          irreversível.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => remove(r.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
