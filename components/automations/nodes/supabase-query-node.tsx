"use client"

import { memo, useState, useCallback } from "react"
import type { NodeProps } from "@xyflow/react"
import { useReactFlow } from "@xyflow/react"
import { Database, Plus, Trash2, Settings2 } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type {
  SupabaseQueryNodeData,
  SupabaseQueryOperation,
  SupabaseQueryFilter,
  SupabaseQueryData,
  SupabaseQueryRpcParam,
} from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { VariablePicker } from "@/components/automations/variable-picker"

const OPERATION_LABELS: Record<SupabaseQueryOperation, string> = {
  select: "Consultar",
  insert: "Inserir",
  update: "Actualizar",
  upsert: "Inserir/Actualizar",
  delete: "Remover",
  rpc: "Função",
}

const FILTER_OPERATOR_LABELS: Record<string, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  like: "contém",
  is: "é nulo",
  in: "em",
}

const RPC_PARAM_TYPES = [
  { value: "text", label: "Texto" },
  { value: "uuid", label: "UUID" },
  { value: "int", label: "Inteiro" },
  { value: "jsonb", label: "JSONB" },
  { value: "boolean", label: "Booleano" },
] as const

// ── Sheet de Configuração ──

function SupabaseQuerySheet({
  open,
  onOpenChange,
  nodeData,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeData: SupabaseQueryNodeData
  onSave: (data: Partial<SupabaseQueryNodeData>) => void
}) {
  const [operation, setOperation] = useState<SupabaseQueryOperation>(
    nodeData.operation || "select"
  )
  const [table, setTable] = useState(nodeData.table || "")
  const [columns, setColumns] = useState(nodeData.columns || "*")
  const [filters, setFilters] = useState<SupabaseQueryFilter[]>(
    nodeData.filters || []
  )
  const [dataFields, setDataFields] = useState<SupabaseQueryData[]>(
    nodeData.data || []
  )
  const [upsertConflict, setUpsertConflict] = useState(
    nodeData.upsertConflict || ""
  )
  const [limit, setLimit] = useState<number | undefined>(nodeData.limit)
  const [single, setSingle] = useState(nodeData.single || false)
  const [rpcFunction, setRpcFunction] = useState(nodeData.rpcFunction || "")
  const [rpcParams, setRpcParams] = useState<SupabaseQueryRpcParam[]>(
    nodeData.rpcParams || []
  )
  const [outputVariable, setOutputVariable] = useState(
    nodeData.outputVariable || ""
  )

  const handleSave = useCallback(() => {
    onSave({
      operation,
      table: operation !== "rpc" ? table : undefined,
      columns: operation === "select" ? columns : undefined,
      filters:
        operation === "select" || operation === "update" || operation === "delete"
          ? filters
          : undefined,
      data:
        operation === "insert" || operation === "update" || operation === "upsert"
          ? dataFields
          : undefined,
      upsertConflict: operation === "upsert" ? upsertConflict : undefined,
      limit: operation === "select" ? limit : undefined,
      single: operation === "select" ? single : undefined,
      rpcFunction: operation === "rpc" ? rpcFunction : undefined,
      rpcParams: operation === "rpc" ? rpcParams : undefined,
      outputVariable,
    })
    onOpenChange(false)
  }, [
    operation, table, columns, filters, dataFields, upsertConflict,
    limit, single, rpcFunction, rpcParams, outputVariable, onSave, onOpenChange,
  ])

  const addFilter = () =>
    setFilters((prev) => [...prev, { column: "", operator: "eq", value: "" }])
  const updateFilter = (idx: number, patch: Partial<SupabaseQueryFilter>) =>
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  const removeFilter = (idx: number) =>
    setFilters((prev) => prev.filter((_, i) => i !== idx))

  const addDataField = () =>
    setDataFields((prev) => [...prev, { column: "", value: "" }])
  const updateDataField = (idx: number, patch: Partial<SupabaseQueryData>) =>
    setDataFields((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  const removeDataField = (idx: number) =>
    setDataFields((prev) => prev.filter((_, i) => i !== idx))

  const addRpcParam = () =>
    setRpcParams((prev) => [...prev, { name: "", value: "", type: "text" }])
  const updateRpcParam = (idx: number, patch: Partial<SupabaseQueryRpcParam>) =>
    setRpcParams((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  const removeRpcParam = (idx: number) =>
    setRpcParams((prev) => prev.filter((_, i) => i !== idx))

  const showFilters = operation === "select" || operation === "update" || operation === "delete"
  const showData = operation === "insert" || operation === "update" || operation === "upsert"
  const showRpc = operation === "rpc"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg min-w-[520px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">Configurar Consulta</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Operation */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Operação</Label>
            <Select
              value={operation}
              onValueChange={(v) => setOperation(v as SupabaseQueryOperation)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OPERATION_LABELS).map(([val, lbl]) => (
                  <SelectItem key={val} value={val}>
                    {lbl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Table (for non-rpc) */}
          {!showRpc && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Tabela</Label>
              <Input
                value={table}
                onChange={(e) => setTable(e.target.value)}
                placeholder="Ex: leads, dev_properties"
              />
            </div>
          )}

          {/* RPC Function */}
          {showRpc && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Nome da Função
              </Label>
              <Input
                value={rpcFunction}
                onChange={(e) => setRpcFunction(e.target.value)}
                placeholder="Ex: get_lead_stats"
              />
            </div>
          )}

          {/* Columns (select only) */}
          {operation === "select" && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Colunas</Label>
              <Input
                value={columns}
                onChange={(e) => setColumns(e.target.value)}
                placeholder="* ou id, nome, email"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use * para todas ou separe por vírgula
              </p>
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Filtros</Label>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="h-3 w-3 mr-1" /> Filtro
                </Button>
              </div>
              <div className="space-y-2">
                {filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={f.column}
                      onChange={(e) => updateFilter(i, { column: e.target.value })}
                      placeholder="coluna"
                      className="flex-1 h-8 text-xs"
                    />
                    <Select
                      value={f.operator}
                      onValueChange={(v) =>
                        updateFilter(i, { operator: v as SupabaseQueryFilter["operator"] })
                      }
                    >
                      <SelectTrigger className="w-20 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FILTER_OPERATOR_LABELS).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={f.value}
                        onChange={(e) => updateFilter(i, { value: e.target.value })}
                        placeholder="valor ou {{var}}"
                        className="flex-1 h-8 text-xs"
                        disabled={f.operator === "is"}
                      />
                      <VariablePicker
                        onSelect={(v) => updateFilter(i, { value: `{{${v.key}}}` })}
                        compact
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeFilter(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {filters.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum filtro definido
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Data fields (insert/update/upsert) */}
          {showData && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Dados</Label>
                <Button variant="outline" size="sm" onClick={addDataField}>
                  <Plus className="h-3 w-3 mr-1" /> Campo
                </Button>
              </div>
              <div className="space-y-2">
                {dataFields.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={d.column}
                      onChange={(e) => updateDataField(i, { column: e.target.value })}
                      placeholder="coluna"
                      className="flex-1 h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">=</span>
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={d.value}
                        onChange={(e) => updateDataField(i, { value: e.target.value })}
                        placeholder="valor ou {{var}}"
                        className="flex-1 h-8 text-xs"
                      />
                      <VariablePicker
                        onSelect={(v) => updateDataField(i, { value: `{{${v.key}}}` })}
                        compact
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeDataField(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {dataFields.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum campo definido
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Upsert conflict */}
          {operation === "upsert" && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Colunas de Conflito
              </Label>
              <Input
                value={upsertConflict}
                onChange={(e) => setUpsertConflict(e.target.value)}
                placeholder="Ex: task_id,list_id"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Colunas unique para detectar conflito (separadas por vírgula)
              </p>
            </div>
          )}

          {/* RPC Params */}
          {showRpc && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Parâmetros</Label>
                <Button variant="outline" size="sm" onClick={addRpcParam}>
                  <Plus className="h-3 w-3 mr-1" /> Parâmetro
                </Button>
              </div>
              <div className="space-y-2">
                {rpcParams.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={p.name}
                      onChange={(e) => updateRpcParam(i, { name: e.target.value })}
                      placeholder="nome"
                      className="w-28 h-8 text-xs"
                    />
                    <Select
                      value={p.type || "text"}
                      onValueChange={(v) =>
                        updateRpcParam(i, { type: v as SupabaseQueryRpcParam["type"] })
                      }
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RPC_PARAM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={p.value}
                        onChange={(e) => updateRpcParam(i, { value: e.target.value })}
                        placeholder="valor ou {{var}}"
                        className="flex-1 h-8 text-xs"
                      />
                      <VariablePicker
                        onSelect={(v) => updateRpcParam(i, { value: `{{${v.key}}}` })}
                        compact
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeRpcParam(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {rpcParams.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum parâmetro definido
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Select-specific options */}
          {operation === "select" && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center gap-3">
                <Checkbox
                  id="single"
                  checked={single}
                  onCheckedChange={(c) => setSingle(c === true)}
                />
                <Label htmlFor="single" className="text-sm">
                  Resultado único (.single())
                </Label>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Limite</Label>
                <Input
                  type="number"
                  value={limit ?? ""}
                  onChange={(e) =>
                    setLimit(e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="Sem limite"
                  className="w-32"
                  min={1}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Output Variable */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Guardar resultado em
            </Label>
            <Input
              value={outputVariable}
              onChange={(e) => setOutputVariable(e.target.value)}
              placeholder="Ex: query_result"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Nome da variável onde o resultado ficará disponível
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0">
          <Button onClick={handleSave} className="w-full">
            Guardar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Node Component ──

function SupabaseQueryNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SupabaseQueryNodeData
  const { updateNodeData } = useReactFlow()
  const [sheetOpen, setSheetOpen] = useState(false)

  const isConfigured = nodeData.operation && (nodeData.table || nodeData.rpcFunction)

  const handleSave = useCallback(
    (patch: Partial<SupabaseQueryNodeData>) => {
      updateNodeData(id, { ...nodeData, ...patch })
    },
    [id, nodeData, updateNodeData]
  )

  return (
    <>
      <NodeWrapper
        id={id}
        nodeType="supabase_query"
        selected={selected}
        icon={<Database />}
        title={nodeData.label || "Consulta Banco"}
      >
        {isConfigured ? (
          <div className="space-y-1">
            <Badge variant="secondary" className="text-[10px]">
              {OPERATION_LABELS[nodeData.operation]}
            </Badge>
            <p className="truncate font-mono text-[10px]">
              {nodeData.operation === "rpc"
                ? nodeData.rpcFunction
                : nodeData.table}
            </p>
            {nodeData.outputVariable && (
              <p className="text-[10px]">
                Resultado → {nodeData.outputVariable}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSheetOpen(true)
              }}
              className="flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline"
            >
              <Settings2 className="h-3 w-3" /> Configurar
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSheetOpen(true)
            }}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <Settings2 className="h-3.5 w-3.5" /> Configurar consulta
          </button>
        )}
      </NodeWrapper>

      <SupabaseQuerySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        nodeData={nodeData}
        onSave={handleSave}
      />
    </>
  )
}

export const SupabaseQueryNode = memo(SupabaseQueryNodeInner)
