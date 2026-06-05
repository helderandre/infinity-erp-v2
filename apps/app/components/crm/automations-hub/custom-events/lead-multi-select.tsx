"use client"

import { useMemo, useState } from "react"
import { Search, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { MultiSelectFilter, type MultiSelectOption } from "@/components/shared/multi-select-filter"
import { useEligibleLeads } from "@/hooks/use-eligible-leads"
import { usePipelineStages } from "@/hooks/use-pipeline-stages"
import { LEAD_ESTADOS } from "@/lib/constants"
import { PIPELINE_TYPE_LABELS } from "@/lib/constants-leads-crm"

interface LeadMultiSelectProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  selectAll: boolean
  onSelectAllChange: (all: boolean) => void
}

export function LeadMultiSelect({
  selectedIds,
  onSelectionChange,
  selectAll,
  onSelectAllChange,
}: LeadMultiSelectProps) {
  const [search, setSearch] = useState("")
  const [pipelineStageIds, setPipelineStageIds] = useState<string[]>([])
  const [contactEstados, setContactEstados] = useState<string[]>([])
  const [page, setPage] = useState(1)

  const { stages, isLoading: stagesLoading } = usePipelineStages()

  const pipelineOptions = useMemo<MultiSelectOption[]>(() => {
    const sorted = [...stages].sort((a, b) => {
      if (a.pipeline_type !== b.pipeline_type) {
        return a.pipeline_type.localeCompare(b.pipeline_type)
      }
      return a.order_index - b.order_index
    })
    return sorted.map((s) => ({
      value: s.id,
      label: s.name,
      group: PIPELINE_TYPE_LABELS[s.pipeline_type] ?? s.pipeline_type,
    }))
  }, [stages])

  const estadoOptions = useMemo<MultiSelectOption[]>(
    () =>
      LEAD_ESTADOS.filter((e) => e !== "Lead").map((e) => ({
        value: e,
        label: e,
      })),
    [],
  )

  const { leads, total, isLoading } = useEligibleLeads({
    search,
    pipelineStageIds,
    contactEstados,
    page,
    limit: 30,
  })

  function handlePipelineChange(values: string[]) {
    setPipelineStageIds(values)
    setPage(1)
  }

  function handleEstadosChange(values: string[]) {
    setContactEstados(values)
    setPage(1)
  }

  function toggleLead(leadId: string) {
    if (selectAll) {
      onSelectAllChange(false)
      const allIds = leads.map((l) => l.id).filter((id) => id !== leadId)
      onSelectionChange(allIds)
      return
    }
    if (selectedIds.includes(leadId)) {
      onSelectionChange(selectedIds.filter((id) => id !== leadId))
    } else {
      onSelectionChange([...selectedIds, leadId])
    }
  }

  function handleSelectAll(checked: boolean) {
    onSelectAllChange(checked)
    if (checked) {
      onSelectionChange([])
    }
  }

  const totalPages = Math.ceil(total / 30)
  const selectedCount = selectAll ? total : selectedIds.length

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {selectedCount} contacto{selectedCount !== 1 ? "s" : ""} seleccionado{selectedCount !== 1 ? "s" : ""}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
          <span className="text-sm">Seleccionar todos ({total})</span>
        </label>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, email ou telemóvel..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <MultiSelectFilter
          title="Fase do pipeline"
          options={pipelineOptions}
          selected={pipelineStageIds}
          onSelectedChange={handlePipelineChange}
          searchable
          maxBadges={1}
        />
        <MultiSelectFilter
          title="Estado do contacto"
          options={estadoOptions}
          selected={contactEstados}
          onSelectedChange={handleEstadosChange}
          maxBadges={1}
        />
      </div>

      {stagesLoading && pipelineOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">A carregar fases do pipeline…</p>
      )}

      {/* Leads list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Nenhum contacto encontrado</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
          {leads.map((lead) => {
            const isChecked = selectAll || selectedIds.includes(lead.id)
            return (
              <label
                key={lead.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleLead(lead.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lead.name ?? "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[lead.email, lead.telemovel].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {lead.status && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {lead.status}
                  </Badge>
                )}
              </label>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {page} de {totalPages} ({total} contactos)</span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              Seguinte
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
