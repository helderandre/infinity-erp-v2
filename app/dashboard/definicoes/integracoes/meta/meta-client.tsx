"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Copy,
  CheckCircle2,
  AlertTriangle,
  Link as LinkIcon,
  Webhook,
  TrendingUp,
  ExternalLink,
  Users,
  RefreshCw,
  Loader2,
  Upload,
  Zap,
  Plug,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CustomAudience } from "./actions"
import { syncCustomAudience, testCAPIConnection } from "./actions"

interface MetaIntegrationsClientProps {
  webhookUrl: string
  appId: string
  hasAppSecret: boolean
  hasAccessToken: boolean
  hasPixelId: boolean
  pixelId: string
  audiences: CustomAudience[]
  audiencesError: string | null
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      )}
      <span className={cn("text-sm", ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
        {label}
      </span>
    </div>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success("Copiado!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border bg-background px-4 py-2.5 text-sm font-mono truncate text-foreground">
          {value}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={copy}
          className="shrink-0 h-10 w-10"
        >
          {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

// --- Custom Audiences Section ------------------------------------------------

function CustomAudiencesSection({
  audiences,
  audiencesError,
}: {
  audiences: CustomAudience[]
  audiencesError: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [audienceName, setAudienceName] = useState("")
  const [result, setResult] = useState<{ count: number; audienceId: string } | null>(null)

  function handleSync() {
    setResult(null)
    startTransition(async () => {
      const res = await syncCustomAudience(audienceName)
      if (res.success) {
        toast.success(`Audiencia criada com ${res.count} emails`)
        setResult({ count: res.count, audienceId: res.audienceId! })
        setAudienceName("")
      } else {
        toast.error(res.error ?? "Erro ao sincronizar")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Custom Audiences</CardTitle>
            <CardDescription>
              Sincroniza emails de clientes para retargeting ou Lookalike
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing audiences */}
        {audiences.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
              Audiencias existentes
            </h3>
            <div className="space-y-1.5">
              {audiences.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted">
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.subtype}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ~{new Intl.NumberFormat("pt-PT").format(a.approximate_count)} utilizadores
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {audiencesError && (
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            {audiencesError}
          </div>
        )}

        {/* Create new */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Criar nova audiencia
          </h3>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={audienceName}
              onChange={(e) => setAudienceName(e.target.value)}
              placeholder="Nome da audiencia (opcional)"
              disabled={isPending}
              className="flex-1"
            />
            <Button
              onClick={handleSync}
              disabled={isPending}
              className="shrink-0 bg-purple-500 hover:bg-purple-600 text-white"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isPending ? "A sincronizar..." : "Sincronizar clientes"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Os emails dos clientes sao convertidos em hash (SHA-256) antes de serem enviados ao Meta. Nenhum email e transmitido em texto.
          </p>

          {result && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Audiencia criada com {result.count} emails (ID: {result.audienceId})
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// --- Offline Conversions Section ---------------------------------------------

function OfflineConversionsSection({ hasPixelId }: { hasPixelId: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Offline Conversions</CardTitle>
            <CardDescription>
              Envia conversoes quando um lead passa a cliente
            </CardDescription>
          </div>
          {hasPixelId ? (
            <Badge variant="outline" className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              Ativo
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              Pixel em falta
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline stages table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Estado do Lead</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Evento Meta</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Objetivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { status: "Qualificado", event: "Lead", purpose: "Sinal de qualidade -- encontrar leads semelhantes", color: "text-amber-500" },
                { status: "Proposta enviada", event: "InitiateCheckout", purpose: "Interesse avancado -- otimizar para conversao", color: "text-orange-500" },
                { status: "Negociacao", event: "AddToCart", purpose: "Intencao de compra forte", color: "text-pink-500" },
                { status: "Ganho", event: "Purchase", purpose: "Conversao final -- atribuicao ROAS completa", color: "text-emerald-500" },
              ].map((row) => (
                <TableRow key={row.event}>
                  <TableCell>
                    <span className={cn("text-xs font-semibold", row.color)}>{row.status}</span>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{row.event}</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.purpose}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Como funciona</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
              <span>
                Ao mudar o estado de um lead, o CRM envia automaticamente o evento correspondente ao Meta -- desde <strong>Qualificado</strong> (sinal de qualidade) ate <strong>Ganho</strong> (conversao final).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
              <span>
                Os dados do lead (email, telefone) sao convertidos em <strong>hash SHA-256</strong> antes de serem enviados -- nenhum dado pessoal e transmitido em texto.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <RefreshCw className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
              <span>
                Os sinais intermedios (Lead, InitiateCheckout) permitem ao Meta <strong>otimizar para leads de qualidade</strong>, nao apenas volume. O evento Purchase fecha o ciclo completo do ROAS.
              </span>
            </li>
          </ul>

          {!hasPixelId && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              Configura o META_PIXEL_ID no .env.local para ativar as conversoes offline.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// --- CAPI Section ------------------------------------------------------------

function CAPISection({ hasPixelId, pixelId }: { hasPixelId: boolean; pixelId: string }) {
  const [isPending, startTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ success: boolean; error: string | null } | null>(null)

  function handleTest() {
    setTestResult(null)
    startTransition(async () => {
      const result = await testCAPIConnection()
      setTestResult(result)
      if (result.success) {
        toast.success("Evento de teste enviado com sucesso!")
      } else {
        toast.error(result.error ?? "Falha no envio")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Plug className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Conversions API (CAPI)</CardTitle>
            <CardDescription>
              Tracking server-side para melhor atribuicao
            </CardDescription>
          </div>
          {hasPixelId ? (
            <Badge variant="outline" className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              Pixel em falta
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPixelId && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted">
            <span className="text-xs text-muted-foreground">Pixel ID:</span>
            <span className="text-xs font-mono font-medium text-foreground">{pixelId}</span>
          </div>
        )}

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Como funciona</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Plug className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
              <span>
                A CAPI envia eventos <strong>server-side</strong> diretamente ao Meta, complementando o Pixel (browser-side).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
              <span>
                Nao e afetada por ad blockers ou restricoes de cookies -- <strong>melhora significativamente a atribuicao</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
              <span>
                Eventos enviados automaticamente: <strong>Lead</strong> (submissao de formulario), <strong>Purchase</strong> (lead ganho), <strong>PageView</strong> (visitas).
              </span>
            </li>
          </ul>
        </div>

        {/* Test connection */}
        {hasPixelId && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTest}
              disabled={isPending}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {isPending ? "A enviar..." : "Enviar evento de teste"}
            </Button>

            {testResult && (
              <div className={cn(
                "flex items-center gap-2 text-xs",
                testResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {testResult.success ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Evento recebido pelo Meta</>
                ) : (
                  <><AlertTriangle className="h-3.5 w-3.5" /> {testResult.error}</>
                )}
              </div>
            )}
          </div>
        )}

        {!hasPixelId && (
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Configura o META_PIXEL_ID no .env.local para ativar a CAPI.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main --------------------------------------------------------------------

export function MetaIntegrationsClient({
  webhookUrl,
  appId,
  hasAppSecret,
  hasAccessToken,
  hasPixelId,
  pixelId,
  audiences,
  audiencesError,
}: MetaIntegrationsClientProps) {
  const allConfigured = !!appId && hasAppSecret && hasAccessToken

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Integrações Meta
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lead Ads, Pixel, Custom Audiences, Conversoes e CAPI.
        </p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Estado da conexao</CardTitle>
              <CardDescription>
                Credenciais configuradas no servidor
              </CardDescription>
            </div>
            <div className="ml-auto">
              {allConfigured ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
                  Incompleto
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            <StatusBadge ok={!!appId} label={appId ? `App ID: ${appId}` : "META_APP_ID em falta"} />
            <StatusBadge ok={hasAppSecret} label={hasAppSecret ? "App Secret configurado" : "META_APP_SECRET em falta"} />
            <StatusBadge ok={hasAccessToken} label={hasAccessToken ? "Access Token configurado" : "META_ACCESS_TOKEN em falta"} />
            <StatusBadge ok={hasPixelId} label={hasPixelId ? `Pixel ID: ${pixelId}` : "META_PIXEL_ID em falta (opcional)"} />
          </div>
        </CardContent>
      </Card>

      {/* Lead Ads Webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Lead Ads Webhook</CardTitle>
              <CardDescription>
                Recebe leads automaticamente das campanhas Meta
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField label="Webhook URL" value={webhookUrl} />

          <div className="bg-muted rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Como configurar
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {[
                <>Vai ao <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline inline-flex items-center gap-0.5">Meta for Developers <ExternalLink className="h-3 w-3 inline" /></a></>,
                <>Seleciona a tua app e vai a <strong>Webhooks</strong></>,
                <>Adiciona o objeto <strong>Page</strong> e subscreve <strong>leadgen</strong></>,
                <>Cola a <strong>Webhook URL</strong> acima e usa o teu <strong>Verify Token</strong></>,
                <>Na tua Page, vai a <strong>Settings &gt; Webhooks</strong> e subscreve a page a app</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Meta Pixel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Meta Pixel</CardTitle>
              <CardDescription>
                Tracking de conversoes nos formularios publicos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Como funciona
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <LinkIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <span>
                  Em cada formulario, preenche o <strong>Meta Pixel ID</strong> nas definicoes do formulario.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <LinkIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <span>
                  O Pixel carrega automaticamente na pagina publica do formulario (<code className="text-xs bg-muted-foreground/10 px-1.5 py-0.5 rounded">/forms/[slug]</code>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <LinkIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <span>
                  Ao submeter, e disparado o evento <strong>Lead</strong> (ou o evento personalizado configurado).
                </span>
              </li>
            </ul>

            <div className="pt-2">
              <Button asChild>
                <Link href="/forms">
                  Ir para Formularios
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Audiences */}
      <CustomAudiencesSection audiences={audiences} audiencesError={audiencesError} />

      {/* Offline Conversions */}
      <OfflineConversionsSection hasPixelId={hasPixelId} />

      {/* CAPI */}
      <CAPISection hasPixelId={hasPixelId} pixelId={pixelId} />
    </div>
  )
}
