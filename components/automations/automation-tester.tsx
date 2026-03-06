"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Play,
  CheckCircle2,
  XCircle,
  Search,
  User,
  Home,
  PenLine,
  Plus,
  RotateCcw,
  MessageCircle,
  Mail,
} from "lucide-react"
import { Spinner } from "@/components/kibo-ui/spinner"
import { toast } from "sonner"
import { useFlows } from "@/hooks/use-flows"
import { useRealtimeExecution } from "@/hooks/use-realtime-execution"
import { ExecutionTimeline } from "./execution-timeline"
import { extractVariablesFromNodes } from "@/lib/template-engine"
import type { FlowDefinition } from "@/lib/types/automation-flow"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

interface AutomationTesterProps {
  flowId: string
  flowDefinition: FlowDefinition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface LeadItem {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  telemovel: string | null
  estado: string | null
  temperatura: string | null
  origem: string | null
}

interface PropertyItem {
  id: string
  title: string
  external_ref: string | null
  listing_price: number | null
  city: string | null
  property_type: string | null
  status: string | null
}

interface VarInfo {
  label: string
  color: string
}

function leadToVariables(lead: LeadItem): Record<string, string> {
  return {
    lead_nome: lead.nome || "",
    lead_email: lead.email || "",
    lead_telefone: lead.telefone || lead.telemovel || "",
    lead_telemovel: lead.telemovel || "",
    lead_origem: lead.origem || "",
    lead_estado: lead.estado || "",
    lead_temperatura: lead.temperatura || "",
  }
}

function propertyToVariables(property: PropertyItem): Record<string, string> {
  return {
    imovel_ref: property.external_ref || "",
    imovel_titulo: property.title || "",
    imovel_preco: property.listing_price ? `${property.listing_price}` : "",
    imovel_tipo: property.property_type || "",
    imovel_cidade: property.city || "",
    imovel_estado: property.status || "",
  }
}

export function AutomationTester({ flowId, flowDefinition, open, onOpenChange }: AutomationTesterProps) {
  const { testFlow } = useFlows({ autoFetch: false })
  const realtime = useRealtimeExecution()

  const [activeTab, setActiveTab] = useState("lead")
  const [starting, setStarting] = useState(false)

  // Entity search
  const [leadSearch, setLeadSearch] = useState("")
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null)

  const [propertySearch, setPropertySearch] = useState("")
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [loadingProperties, setLoadingProperties] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null)

  // Manual variables
  const [manualVars, setManualVars] = useState<Record<string, string>>({})

  // Variable metadata from API
  const [varInfo, setVarInfo] = useState<Record<string, VarInfo>>({})

  // Extract variables used by flow nodes
  const usedVariables = useMemo(() => {
    if (!flowDefinition?.nodes) return []
    return extractVariablesFromNodes(flowDefinition.nodes as SA)
  }, [flowDefinition])

  // Fetch variable labels
  useEffect(() => {
    if (!open) return
    fetch("/api/automacao/variaveis")
      .then((res) => res.json())
      .then((data: SA) => {
        const map: Record<string, VarInfo> = {}
        for (const v of Array.isArray(data) ? data : data.variables || []) {
          map[v.key] = { label: v.label, color: v.color }
        }
        setVarInfo(map)
      })
      .catch(() => {})
  }, [open])

  // Fetch leads on open
  useEffect(() => {
    if (!open) return
    setLoadingLeads(true)
    fetch("/api/leads?limit=15")
      .then((res) => res.json())
      .then((res: SA) => {
        setLeads(res.data || [])
      })
      .catch(() => {})
      .finally(() => setLoadingLeads(false))
  }, [open])

  // Fetch properties on tab switch
  useEffect(() => {
    if (!open || activeTab !== "imovel" || properties.length > 0) return
    setLoadingProperties(true)
    fetch("/api/properties?per_page=15")
      .then((res) => res.json())
      .then((res: SA) => {
        setProperties(res.data || res || [])
      })
      .catch(() => {})
      .finally(() => setLoadingProperties(false))
  }, [open, activeTab, properties.length])

  // Init manual vars from used variables
  useEffect(() => {
    if (usedVariables.length > 0 && Object.keys(manualVars).length === 0) {
      const initial: Record<string, string> = {}
      for (const key of usedVariables) {
        initial[key] = ""
      }
      setManualVars(initial)
    }
  }, [usedVariables, manualVars])

  // Compute test variables based on active tab
  const testVariables = useMemo(() => {
    if (activeTab === "lead" && selectedLead) return leadToVariables(selectedLead)
    if (activeTab === "imovel" && selectedProperty) return propertyToVariables(selectedProperty)
    if (activeTab === "manual") return manualVars
    return {}
  }, [activeTab, selectedLead, selectedProperty, manualVars])

  const entityType = activeTab === "lead" && selectedLead ? "lead" : activeTab === "imovel" && selectedProperty ? "property" : undefined
  const entityId = activeTab === "lead" ? selectedLead?.id : activeTab === "imovel" ? selectedProperty?.id : undefined

  // Filtered lists
  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads
    const q = leadSearch.toLowerCase()
    return leads.filter(
      (l) =>
        l.nome?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.telefone?.includes(q) ||
        l.telemovel?.includes(q)
    )
  }, [leads, leadSearch])

  const filteredProperties = useMemo(() => {
    if (!propertySearch.trim()) return properties
    const q = propertySearch.toLowerCase()
    return properties.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.external_ref?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q)
    )
  }, [properties, propertySearch])

  // Test summary
  const testSummary = useMemo(() => {
    if (realtime.overallStatus !== "completed" && realtime.overallStatus !== "failed") return null
    const whatsapp = realtime.steps.filter((s) => s.node_type === "whatsapp" && s.status === "completed").length
    const email = realtime.steps.filter((s) => s.node_type === "email" && s.status === "completed").length
    const totalDuration = realtime.steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0)
    return { whatsapp, email, totalDuration }
  }, [realtime.overallStatus, realtime.steps])

  const handleStart = useCallback(async () => {
    setStarting(true)

    // Filter empty vars
    const variables: Record<string, string> = {}
    for (const [k, v] of Object.entries(testVariables)) {
      if (v.trim()) variables[k] = v.trim()
    }

    const result = await testFlow(flowId, {
      entity_type: entityType,
      entity_id: entityId,
      test_variables: variables,
    })

    setStarting(false)

    if (result?.run_id) {
      if (result.status === "failed" && result.errors?.length) {
        const errorMessages = result.errors
          .map((e: { node: string; message: string }) => `${e.node}: ${e.message}`)
          .join("\n")
        toast.error("Teste falhou", {
          description: errorMessages,
          duration: 10000,
        })
      } else if (result.status === "completed") {
        const parts: string[] = []
        if (result.summary?.whatsapp_sent) parts.push(`${result.summary.whatsapp_sent} mensagem(ns) WhatsApp enviada(s)`)
        if (result.summary?.emails_sent) parts.push(`${result.summary.emails_sent} email(s) enviado(s)`)
        toast.success("Teste concluido com sucesso!", {
          description: parts.join(", ") || "Todos os passos executados.",
        })
      } else {
        toast.success("Teste iniciado")
      }
      await realtime.startMonitoring(result.run_id)
    } else {
      toast.error("Erro ao iniciar teste")
    }
  }, [flowId, entityType, entityId, testVariables, testFlow, realtime])

  const handleManualVarChange = (key: string, value: string) => {
    setManualVars((prev) => ({ ...prev, [key]: value }))
  }

  const handleAddManualVar = () => {
    const key = `custom_${Object.keys(manualVars).length + 1}`
    setManualVars((prev) => ({ ...prev, [key]: "" }))
  }

  const getVarLabel = (key: string) => varInfo[key]?.label || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  const getVarColor = (key: string) => varInfo[key]?.color || "#6b7280"

  const hasSelection = (activeTab === "lead" && selectedLead) || (activeTab === "imovel" && selectedProperty) || activeTab === "manual"
  const isExecuting = realtime.overallStatus === "running"
  const hasResults = realtime.runId != null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] p-0 flex flex-col" side="right">
        {/* HEADER FIXO */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">Testar Fluxo</SheetTitle>
          <SheetDescription className="text-sm">
            Escolhe dados de teste para simular a execucao deste fluxo.
          </SheetDescription>
        </SheetHeader>

        {/* CORPO SCROLLAVEL */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Data source tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Testar com dados de:</Label>
              <TabsList className="w-full">
                <TabsTrigger value="lead" className="flex-1 gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Lead
                </TabsTrigger>
                <TabsTrigger value="imovel" className="flex-1 gap-1.5">
                  <Home className="h-3.5 w-3.5" />
                  Imovel
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex-1 gap-1.5">
                  <PenLine className="h-3.5 w-3.5" />
                  Manual
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Lead tab */}
            <TabsContent value="lead" className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Pesquisar lead..."
                  className="pl-9 h-9"
                />
              </div>

              <ScrollArea className="h-[220px] rounded-md border">
                {loadingLeads ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Spinner variant="infinite" size={16} className="mr-2" />
                    A carregar...
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum lead encontrado
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`w-full text-left rounded-md px-3 py-2.5 transition-colors hover:bg-accent ${
                          selectedLead?.id === lead.id ? "bg-accent ring-1 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-xs font-semibold dark:bg-sky-950 dark:text-sky-400">
                            {lead.nome?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{lead.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[lead.email, lead.telefone || lead.telemovel].filter(Boolean).join(" \u00B7 ") || "Sem contacto"}
                            </p>
                          </div>
                          {selectedLead?.id === lead.id && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Property tab */}
            <TabsContent value="imovel" className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  placeholder="Pesquisar imovel..."
                  className="pl-9 h-9"
                />
              </div>

              <ScrollArea className="h-[220px] rounded-md border">
                {loadingProperties ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Spinner variant="infinite" size={16} className="mr-2" />
                    A carregar...
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum imovel encontrado
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredProperties.map((prop) => (
                      <button
                        key={prop.id}
                        onClick={() => setSelectedProperty(prop)}
                        className={`w-full text-left rounded-md px-3 py-2.5 transition-colors hover:bg-accent ${
                          selectedProperty?.id === prop.id ? "bg-accent ring-1 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold dark:bg-emerald-950 dark:text-emerald-400">
                            <Home className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {prop.external_ref && <span className="text-muted-foreground mr-1">{prop.external_ref}</span>}
                              {prop.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[
                                prop.listing_price ? `${Number(prop.listing_price).toLocaleString("pt-PT")} \u20AC` : null,
                                prop.city,
                              ].filter(Boolean).join(" \u00B7 ") || "Sem detalhes"}
                            </p>
                          </div>
                          {selectedProperty?.id === prop.id && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Manual tab */}
            <TabsContent value="manual" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Preenche as variaveis manualmente:
              </p>
              <div className="space-y-2">
                {Object.entries(manualVars).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Label className="text-xs font-medium w-32 shrink-0 truncate" title={key}>
                      {getVarLabel(key)}
                    </Label>
                    <Input
                      value={value}
                      onChange={(e) => handleManualVarChange(key, e.target.value)}
                      className="h-8 text-sm"
                      placeholder={varInfo[key]?.label || key}
                    />
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAddManualVar}>
                <Plus className="mr-1 h-3 w-3" />
                Adicionar variavel
              </Button>
            </TabsContent>
          </Tabs>

          {/* Variable preview */}
          {hasSelection && activeTab !== "manual" && usedVariables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Variaveis que serao usadas:
              </Label>
              <div className="rounded-md border p-2.5 space-y-1.5">
                {usedVariables.map((varKey) => (
                  <div key={varKey} className="flex items-center justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] shrink-0"
                      style={{ backgroundColor: `${getVarColor(varKey)}20`, color: getVarColor(varKey), borderColor: `${getVarColor(varKey)}40` }}
                    >
                      {getVarLabel(varKey)}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {testVariables[varKey] || "\u2014"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {hasResults && (
            <div className="space-y-3">
              <Separator />

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Resultado</span>
                {realtime.overallStatus === "completed" && (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Concluido
                  </Badge>
                )}
                {realtime.overallStatus === "failed" && (
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                    <XCircle className="mr-1 h-3 w-3" />
                    Falhou
                  </Badge>
                )}
                {realtime.overallStatus === "running" && (
                  <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-xs">
                    <Spinner variant="infinite" size={12} className="mr-1" />
                    A executar
                  </Badge>
                )}
              </div>

              <ExecutionTimeline
                steps={realtime.steps}
                totalSteps={realtime.totalSteps}
                completedSteps={realtime.completedSteps}
                failedSteps={realtime.failedSteps}
                overallStatus={realtime.overallStatus}
                flowDefinition={flowDefinition}
              />

              {/* Post-test summary */}
              {testSummary && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <p className="text-sm font-medium">
                    {realtime.overallStatus === "completed" ? (
                      <span className="text-emerald-600">Teste concluido com sucesso!</span>
                    ) : (
                      <span className="text-red-600">Teste concluido com falhas</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {testSummary.whatsapp > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {testSummary.whatsapp} WhatsApp
                      </span>
                    )}
                    {testSummary.email > 0 && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {testSummary.email} email{testSummary.email > 1 ? "s" : ""}
                      </span>
                    )}
                    {testSummary.totalDuration > 0 && (
                      <span>
                        Duracao: {testSummary.totalDuration < 1000
                          ? `${testSummary.totalDuration}ms`
                          : `${(testSummary.totalDuration / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER FIXO */}
        <div className="border-t px-6 py-3 shrink-0">
          {hasResults && !isExecuting ? (
            <Button onClick={handleStart} disabled={starting} className="w-full">
              {starting ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Testar Novamente
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={starting || isExecuting}
              className="w-full"
            >
              {starting ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {starting ? "A iniciar..." : "Iniciar Teste"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
