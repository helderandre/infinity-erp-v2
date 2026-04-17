"use client"

import { useState } from "react"
import { Search, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useEligibleLeads } from "@/hooks/use-eligible-leads"

const STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  contacted: "Contactado",
  qualified: "Qualificado",
  archived: "Arquivado",
  expired: "Expirado",
}

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
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)

  const { leads, total, isLoading } = useEligibleLeads({
    search,
    status: statusFilter,
    page,
    limit: 30,
  })

  function toggleLead(leadId: string) {
    if (selectAll) {
      onSelectAllChange(false)
      // When unchecking "select all", switch to individual selection minus this one
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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, email ou telemóvel..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                    {STATUS_LABELS[lead.status] ?? lead.status}
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
