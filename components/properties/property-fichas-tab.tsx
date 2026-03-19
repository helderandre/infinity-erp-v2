// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Star, Upload, Loader2, FileText, Sparkles, Link2, Check, Download,
  ChevronDown, ChevronUp, Trash2, Eye, EyeOff, Globe, BarChart3,
  ScanLine, PenLine, TrendingUp, TrendingDown, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { RATING_FIELDS, DISCOVERY_OPTIONS } from '@/types/visit-ficha'
import type { VisitFicha, FichaDashboardStats } from '@/types/visit-ficha'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface PropertyFichasTabProps {
  propertyId: string
  propertySlug: string | null
  listingPrice: number | null
}

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Globe }> = {
  digital: { label: 'Digital', icon: Globe },
  scan: { label: 'Digitalizado', icon: ScanLine },
  manual: { label: 'Manual', icon: PenLine },
}

export function PropertyFichasTab({ propertyId, propertySlug, listingPrice }: PropertyFichasTabProps) {
  const [fichas, setFichas] = useState<VisitFicha[]>([])
  const [stats, setStats] = useState<FichaDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [isLoadingAi, setIsLoadingAi] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedFicha, setExpandedFicha] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'dashboard' | 'fichas' | 'recomendacoes'>('dashboard')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [fichasRes, statsRes] = await Promise.all([
        fetch(`/api/fichas?property_id=${propertyId}`),
        fetch(`/api/fichas/stats?property_id=${propertyId}`),
      ])
      if (fichasRes.ok) { const j = await fichasRes.json(); setFichas(j.data || []) }
      if (statsRes.ok) { const j = await statsRes.json(); setStats(j.data || null) }
    } catch {}
    finally { setIsLoading(false) }
  }, [propertyId])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchAiAdvice = useCallback(async () => {
    setIsLoadingAi(true)
    try {
      const res = await fetch(`/api/fichas/ai-advisor?property_id=${propertyId}`)
      if (res.ok) { const j = await res.json(); setAiAdvice(j.data?.advice || null) }
    } catch {}
    finally { setIsLoadingAi(false) }
  }, [propertyId])

  const handleScanUpload = async () => {
    if (!scanFiles.length) return
    setIsScanning(true)
    try {
      const formData = new FormData()
      formData.append('property_id', propertyId)
      scanFiles.forEach((f) => formData.append('files', f))
      const res = await fetch('/api/fichas/scan', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erro ao processar')
      const json = await res.json()
      toast.success(`${json.saved_count} ficha${json.saved_count !== 1 ? 's' : ''} extraída${json.saved_count !== 1 ? 's' : ''} com sucesso`)
      setShowScanDialog(false)
      setScanFiles([])
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao processar fichas')
    } finally { setIsScanning(false) }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/fichas/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Ficha eliminada'); fetchData() }
    else toast.error('Erro ao eliminar')
  }

  const copyLink = () => {
    const url = `${window.location.origin}/fichas/${propertySlug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  const totalFichas = stats?.totalFichas || 0

  return (
    <div className="space-y-5">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <a href={`/api/fichas/pdf?property_id=${propertyId}`} download>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Descarregar PDF
          </a>
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowScanDialog(true)}>
          <ScanLine className="mr-1.5 h-3.5 w-3.5" />
          Digitalizar Fichas
        </Button>
        {propertySlug && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={copyLink}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? 'Copiado!' : 'Link Digital'}
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{totalFichas} ficha{totalFichas !== 1 ? 's' : ''}</span>
      </div>

      {totalFichas === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <h3 className="text-base font-medium">Sem fichas de visita</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Digitalize fichas preenchidas ou partilhe o link digital com os visitantes.
          </p>
        </div>
      ) : (
        <>
          {/* Sub-tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
            {([
              { key: 'dashboard' as const, label: 'Dashboard', icon: BarChart3, badge: null },
              { key: 'fichas' as const, label: 'Fichas', icon: FileText, badge: totalFichas },
              { key: 'recomendacoes' as const, label: 'Recomendações', icon: Sparkles, badge: null },
            ]).map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setSubTab(tab.key)}
                  className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 flex items-center gap-1.5',
                    subTab === tab.key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.badge !== null && <Badge variant="secondary" className="text-[9px] rounded-full px-1.5 ml-0.5">{tab.badge}</Badge>}
                </button>
              )
            })}
          </div>

          {/* ─── Dashboard Sub-tab ─── */}
          {subTab === 'dashboard' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avaliação Geral</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold tabular-nums">{stats?.avgRatings?.rating_overall?.toFixed(1) || '—'}</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn('h-3 w-3', s <= Math.round(stats?.avgRatings?.rating_overall || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20')} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Compraria</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{stats?.wouldBuyPct || 0}%</p>
                </div>
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Percebido</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {stats?.avgPerceivedValue ? `${(stats.avgPerceivedValue / 1000).toFixed(0)}k€` : '—'}
                  </p>
                  {listingPrice && stats?.avgPerceivedValue && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {stats.avgPerceivedValue >= listingPrice ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                      <span className={cn('text-[10px] font-medium', stats.avgPerceivedValue >= listingPrice ? 'text-emerald-600' : 'text-red-600')}>
                        {Math.round(((stats.avgPerceivedValue - listingPrice) / listingPrice) * 100)}% vs pedido
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tem Imóvel p/ Vender</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{stats?.hasPropertyToSellPct || 0}%</p>
                </div>
              </div>

              {/* Ratings Chart */}
              {stats?.avgRatings && Object.keys(stats.avgRatings).length > 0 && (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Avaliações Médias</h4>
                  <div className="space-y-3">
                    {RATING_FIELDS.map((field) => {
                      const val = stats.avgRatings[field.key] || 0
                      const pct = (val / 5) * 100
                      return (
                        <div key={field.key} className="flex items-center gap-3">
                          <span className="text-xs font-medium w-36 shrink-0 truncate">{field.label}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                pct >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                                pct >= 60 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                                'bg-gradient-to-r from-red-400 to-red-500'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold tabular-nums w-8 text-right">{val.toFixed(1)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Discovery Source */}
              {stats?.discoveryBreakdown && Object.keys(stats.discoveryBreakdown).length > 0 && (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Como Conheceram o Imóvel</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.discoveryBreakdown).map(([key, count]) => {
                      const label = DISCOVERY_OPTIONS.find((o) => o.value === key)?.label || key
                      return (
                        <div key={key} className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1.5">
                          <span className="text-xs font-medium">{label}</span>
                          <Badge variant="secondary" className="rounded-full text-[10px] px-1.5">{count}</Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ─── Fichas Individuais Sub-tab ─── */}
          {subTab === 'fichas' && (
            <div className="space-y-3 animate-in fade-in duration-300">
              {fichas.map((ficha, idx) => {
                const isExpanded = expandedFicha === ficha.id
                const sourceInfo = SOURCE_LABELS[ficha.source] || SOURCE_LABELS.manual
                const SourceIcon = sourceInfo.icon

                return (
                  <div
                    key={ficha.id}
                    className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
                  >
                    {/* Header row */}
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setExpandedFicha(isExpanded ? null : ficha.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{ficha.client_name || 'Anónimo'}</p>
                          <Badge variant="secondary" className="rounded-full text-[9px] px-1.5 gap-1 shrink-0">
                            <SourceIcon className="h-2.5 w-2.5" />
                            {sourceInfo.label}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ficha.visit_date ? format(new Date(ficha.visit_date), "d 'de' MMMM yyyy", { locale: pt }) : 'Sem data'}
                          {ficha.visit_time && ` às ${ficha.visit_time.slice(0, 5)}`}
                        </p>
                      </div>
                      {ficha.rating_overall && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-bold tabular-nums">{ficha.rating_overall}</span>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t px-4 py-4 space-y-4 animate-in fade-in duration-200">
                        {/* Ratings */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {RATING_FIELDS.map((field) => {
                            const val = ficha[field.key as keyof VisitFicha] as number | null
                            if (!val) return null
                            return (
                              <div key={field.key} className="rounded-lg bg-muted/30 p-2 text-center">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{field.label}</p>
                                <div className="flex justify-center mt-1">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star key={s} className={cn('h-3 w-3', s <= val ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/15')} />
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Text responses */}
                        {ficha.liked_most && (
                          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">O que mais gostou</p><p className="text-sm">{ficha.liked_most}</p></div>
                        )}
                        {ficha.liked_least && (
                          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">O que menos gostou</p><p className="text-sm">{ficha.liked_least}</p></div>
                        )}

                        <div className="flex flex-wrap gap-3 text-xs">
                          {ficha.would_buy !== null && (
                            <span className={cn('px-2 py-1 rounded-full', ficha.would_buy ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600')}>
                              {ficha.would_buy ? 'Compraria' : 'Não compraria'}
                            </span>
                          )}
                          {ficha.perceived_value && (
                            <span className="px-2 py-1 rounded-full bg-muted/50">Valor: {(ficha.perceived_value / 1000).toFixed(0)}k€</span>
                          )}
                          {ficha.has_property_to_sell && (
                            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">Tem imóvel p/ vender</span>
                          )}
                        </div>

                        {ficha.would_buy_reason && (
                          <p className="text-xs text-muted-foreground italic">"{ficha.would_buy_reason}"</p>
                        )}

                        {/* Consent + delete */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            {ficha.consent_share_with_owner ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {ficha.consent_share_with_owner ? 'Autoriza partilha' : 'Não autoriza partilha'}
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive rounded-full" onClick={() => handleDelete(ficha.id)}>
                            <Trash2 className="mr-1 h-3 w-3" /> Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ─── Recomendações Sub-tab ─── */}
          {subTab === 'recomendacoes' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {totalFichas < 2 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                    <Sparkles className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="text-base font-medium">Dados insuficientes</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    São necessárias pelo menos 2 fichas de visita para gerar recomendações.
                  </p>
                </div>
              ) : !aiAdvice && !isLoadingAi ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                    <Sparkles className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="text-base font-medium">Análise IA</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Gera recomendações baseadas nas {totalFichas} fichas de visita recolhidas.
                  </p>
                  <Button className="mt-4 rounded-full px-6" onClick={fetchAiAdvice}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Gerar Recomendações
                  </Button>
                </div>
              ) : isLoadingAi ? (
                <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 p-8 text-center">
                  <Loader2 className="h-6 w-6 text-violet-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">A analisar {totalFichas} fichas de visita...</p>
                </div>
              ) : (
                <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-violet-500/15 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold">Recomendações IA</h4>
                        <p className="text-[10px] text-muted-foreground">Baseado em {totalFichas} fichas de visita</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={fetchAiAdvice} disabled={isLoadingAi}>
                      <RefreshCw className={cn('mr-1 h-3 w-3', isLoadingAi && 'animate-spin')} />
                      Actualizar
                    </Button>
                  </div>
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed [&_strong]:font-semibold [&_ul]:space-y-1 [&_ul]:pl-4 [&_li]:text-muted-foreground [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:text-muted-foreground" dangerouslySetInnerHTML={{ __html: aiAdvice!.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Scan Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm"><ScanLine className="h-4 w-4" /></div>
                Digitalizar Fichas
              </DialogTitle>
              <DialogDescription className="text-neutral-400 mt-1">
                Envie fotos ou PDFs de fichas preenchidas. A IA extrai os dados automaticamente.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4">
            <div
              className="rounded-xl border-2 border-dashed border-neutral-200 p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => document.getElementById('scan-input')?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Clique para seleccionar ficheiros</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Pode enviar várias fichas de uma vez</p>
              <input
                id="scan-input"
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setScanFiles(Array.from(e.target.files || []))}
              />
            </div>
            {scanFiles.length > 0 && (
              <div className="space-y-1">
                {scanFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setShowScanDialog(false); setScanFiles([]) }}>Cancelar</Button>
            <Button className="rounded-full px-6" disabled={!scanFiles.length || isScanning} onClick={handleScanUpload}>
              {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isScanning ? 'A processar...' : `Extrair Dados (${scanFiles.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
