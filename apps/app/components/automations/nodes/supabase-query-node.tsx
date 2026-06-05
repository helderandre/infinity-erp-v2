"use client"

import { memo, useState, useCallback, useMemo } from "react"
import type { NodeProps } from "@xyflow/react"
import { useReactFlow } from "@xyflow/react"
import {
  Database,
  Plus,
  Trash2,
  Settings2,
  Search,
  Pencil,
  RefreshCw,
  Zap,
  ChevronDown,
  ArrowRight,
  Users,
  Home,
  UserCheck,
  ClipboardList,
  CheckSquare,
  Briefcase,
  UserCog,
  FileText,
  Mail,
  Bell,
  MailCheck,
} from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type {
  SupabaseQueryNodeData,
  SupabaseQueryOperation,
  SupabaseQueryFilter,
  SupabaseQueryData,
  SupabaseQueryRpcParam,
} from "@/lib/types/automation-flow"
import {
  TABLE_OPTIONS,
  OPERATION_OPTIONS,
  FILTER_OPERATORS,
  RPC_PARAM_TYPES,
  getTableLabel,
  getColumnLabel,
  getOperationLabel,
  getFilterOperatorLabel,
} from "@/lib/constants-automations"
import { useTableColumns } from "@/hooks/use-table-columns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { VariablePicker } from "@/components/automations/variable-picker"
import { useWebhookVariables } from "@/hooks/use-webhook-variables"
import { cn } from "@/lib/utils"

// ── Icon map for table options ──

const TABLE_ICON_MAP: Record<string, React.ElementType> = {
  Users, Home, UserCheck, ClipboardList, CheckSquare,
  Briefcase, UserCog, FileText, Mail, Bell, MailCheck,
}

function getTableIcon(iconName: string) {
  return TABLE_ICON_MAP[iconName] || Database
}

// ── Operation icon map ──

const OP_ICON_MAP: Record<string, React.ElementType> = {
  Search, Pencil, Plus, RefreshCw, Trash2, Zap,
}

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
  const webhookVars = useWebhookVariables()
  const [operation, setOperation] = useState<SupabaseQueryOperation>(
    nodeData.operation || "select"
  )
  const [table, setTable] = useState(nodeData.table || "")
  const [columns, setColumns] = useState(nodeData.columns || "*")
  const [columnsMode, setColumnsMode] = useState<"all" | "specific">(
    nodeData.columns && nodeData.columns !== "*" ? "specific" : "all"
  )
  const [filters, setFilters] = useState<SupabaseQueryFilter[]>(
    nodeData.filters || []
  )
  const [dataFields, setDataFields] = useState<SupabaseQueryData[]>(
    nodeData.data || []
  )
  const [upsertConflict, setUpsertConflict] = useState(
    nodeData.upsertConflict || ""
  )
  const [resultMode, setResultMode] = useState<"first" | "all">(
    nodeData.single ? "first" : "all"
  )
  const [limit, setLimit] = useState<number | undefined>(nodeData.limit)
  const [rpcFunction, setRpcFunction] = useState(nodeData.rpcFunction || "")
  const [rpcParams, setRpcParams] = useState<SupabaseQueryRpcParam[]>(
    nodeData.rpcParams || []
  )
  const [outputVariable, setOutputVariable] = useState(
    nodeData.outputVariable || ""
  )
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Dynamic columns from selected table
  const { columns: tableColumns, loading: columnsLoading } = useTableColumns(
    operation !== "rpc" ? table : undefined
  )

  const handleSave = useCallback(() => {
    const single = resultMode === "first"
    const effectiveColumns = columnsMode === "all" ? "*" : columns

    onSave({
      operation,
      table: operation !== "rpc" ? table : undefined,
      columns: operation === "select" ? effectiveColumns : undefined,
      filters:
        operation === "select" || operation === "update" || operation === "delete"
          ? filters
          : undefined,
      data:
        operation === "insert" || operation === "update" || operation === "upsert"
          ? dataFields
          : undefined,
      upsertConflict: operation === "upsert" ? upsertConflict : undefined,
      limit: operation === "select" && !single ? limit : undefined,
      single: operation === "select" ? single : undefined,
      rpcFunction: operation === "rpc" ? rpcFunction : undefined,
      rpcParams: operation === "rpc" ? rpcParams : undefined,
      outputVariable,
    })
    onOpenChange(false)
  }, [
    operation, table, columns, columnsMode, filters, dataFields, upsertConflict,
    resultMode, limit, rpcFunction, rpcParams, outputVariable, onSave, onOpenChange,
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

  // Column select options (from dynamic loading)
  const columnOptions = useMemo(() => {
    if (tableColumns.length > 0) return tableColumns
    return []
  }, [tableColumns])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg min-w-[520px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">Configurar Operação</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Passo 1: O que queres fazer? ── */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              O que queres fazer?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {OPERATION_OPTIONS.map((op) => {
                const Icon = OP_ICON_MAP[op.icon] || Database
                const isSelected = operation === op.value
                return (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setOperation(op.value)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-medium", isSelected && "text-primary")}>{op.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">{op.sublabel}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* ── Passo 2: Onde? (Tabela) ── */}
          {!showRpc && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Onde?</Label>
              <Select value={table} onValueChange={setTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher entidade..." />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_OPTIONS.map((t) => {
                    const Icon = getTableIcon(t.icon)
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <span>{t.label}</span>
                            <span className="ml-2 text-[10px] text-muted-foreground">
                              {t.description}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {/* Opção avançada: outra tabela */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")} />
                  Outra tabela...
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Input
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                    placeholder="Nome da tabela (ex: custom_table)"
                    className="text-xs"
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* ── RPC Function ── */}
          {showRpc && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Escolher função
              </Label>
              <Input
                value={rpcFunction}
                onChange={(e) => setRpcFunction(e.target.value)}
                placeholder="Nome da função (ex: get_lead_stats)"
              />
            </div>
          )}

          {/* ── Passo 3: Que informação queres? (Colunas - select only) ── */}
          {operation === "select" && table && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Que informação queres?
              </Label>
              <RadioGroup
                value={columnsMode}
                onValueChange={(v) => {
                  setColumnsMode(v as "all" | "specific")
                  if (v === "all") setColumns("*")
                }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="cols-all" />
                  <Label htmlFor="cols-all" className="text-sm font-normal cursor-pointer">
                    Toda a informação disponível
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="specific" id="cols-specific" />
                  <Label htmlFor="cols-specific" className="text-sm font-normal cursor-pointer">
                    Escolher campos específicos
                  </Label>
                </div>
              </RadioGroup>

              {columnsMode === "specific" && (
                <div className="mt-3 space-y-1 max-h-[200px] overflow-y-auto rounded-md border p-2">
                  {columnsLoading ? (
                    <p className="text-xs text-muted-foreground py-2">A carregar campos...</p>
                  ) : columnOptions.length > 0 ? (
                    columnOptions.map((col) => {
                      const selectedCols = columns.split(",").map((c) => c.trim())
                      const isChecked = selectedCols.includes(col.name)
                      return (
                        <label
                          key={col.name}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newCols = columns === "*" || columns === ""
                                  ? col.name
                                  : `${columns},${col.name}`
                                setColumns(newCols)
                              } else {
                                const newCols = selectedCols
                                  .filter((c) => c !== col.name)
                                  .join(",")
                                setColumns(newCols || "*")
                              }
                            }}
                            className="rounded border-border"
                          />
                          <span className="text-sm">{col.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{col.type}</span>
                        </label>
                      )
                    })
                  ) : (
                    <div>
                      <Input
                        value={columns}
                        onChange={(e) => setColumns(e.target.value)}
                        placeholder="id, nome, email"
                        className="text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Separe os campos por vírgula
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Passo 4: Condições (Filtros) ── */}
          {showFilters && table && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Condições</Label>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="h-3 w-3 mr-1" /> Condição
                </Button>
              </div>
              <div className="space-y-2">
                {filters.map((f, i) => (
                  <div key={i} className="space-y-1">
                    {i > 0 && (
                      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase px-1">
                        E
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground shrink-0 w-12">
                        {i === 0 ? "Quando" : ""}
                      </span>
                      {/* Column select */}
                      <Select
                        value={f.column}
                        onValueChange={(v) => updateFilter(i, { column: v })}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="Campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columnOptions.length > 0 ? (
                            columnOptions.map((col) => (
                              <SelectItem key={col.name} value={col.name}>
                                {col.label}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value={f.column || "_"} disabled>
                              Seleccione uma tabela primeiro
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {/* Operator select */}
                      <Select
                        value={f.operator}
                        onValueChange={(v) =>
                          updateFilter(i, { operator: v as SupabaseQueryFilter["operator"] })
                        }
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FILTER_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Value with inline variable picker */}
                      {f.operator !== "is" && f.operator !== "not_is" && (
                        <div className="flex items-center gap-0.5 flex-1">
                          <Input
                            value={f.value}
                            onChange={(e) => updateFilter(i, { value: e.target.value })}
                            placeholder="Valor..."
                            className="flex-1 h-8 text-xs"
                          />
                          <VariablePicker
                            onSelect={(v) => updateFilter(i, { value: `{{${v.key}}}` })}
                            additionalVariables={webhookVars}
                            compact
                          />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeFilter(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filters.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sem condições — retorna todos os resultados
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Passo 5: Quantos resultados? (select only) ── */}
          {operation === "select" && table && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Quantos resultados?
              </Label>
              <RadioGroup
                value={resultMode}
                onValueChange={(v) => setResultMode(v as "first" | "all")}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="first" id="result-first" />
                  <Label htmlFor="result-first" className="text-sm font-normal cursor-pointer">
                    Apenas o primeiro
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="result-all" />
                  <Label htmlFor="result-all" className="text-sm font-normal cursor-pointer">
                    Todos
                    {resultMode === "all" && (
                      <span className="text-muted-foreground ml-1">
                        (até{" "}
                        <Input
                          type="number"
                          value={limit ?? ""}
                          onChange={(e) =>
                            setLimit(e.target.value ? Number(e.target.value) : undefined)
                          }
                          placeholder="100"
                          className="inline-block w-16 h-6 text-xs mx-1"
                          min={1}
                          onClick={(e) => e.stopPropagation()}
                        />{" "}
                        resultados)
                      </span>
                    )}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* ── Dados a gravar (insert/update/upsert) ── */}
          {showData && table && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Que dados gravar?</Label>
                <Button variant="outline" size="sm" onClick={addDataField}>
                  <Plus className="h-3 w-3 mr-1" /> Campo
                </Button>
              </div>
              <div className="space-y-2">
                {dataFields.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {/* Column select with friendly names */}
                    <Select
                      value={d.column}
                      onValueChange={(v) => updateDataField(i, { column: v })}
                    >
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue placeholder="Campo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columnOptions.length > 0 ? (
                          columnOptions.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value={d.column || "_"} disabled>
                            Seleccione uma tabela primeiro
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    {/* Value with inline variable picker */}
                    <div className="flex items-center gap-0.5 flex-1">
                      <Input
                        value={d.value}
                        onChange={(e) => updateDataField(i, { value: e.target.value })}
                        placeholder="Valor ou variável..."
                        className="flex-1 h-8 text-xs"
                      />
                      <VariablePicker
                        onSelect={(v) => updateDataField(i, { value: `{{${v.key}}}` })}
                        additionalVariables={webhookVars}
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

          {/* ── Upsert conflict ── */}
          {operation === "upsert" && table && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Campo de identificação
              </Label>
              <Select
                value={upsertConflict}
                onValueChange={setUpsertConflict}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolher campo único..." />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.length > 0 ? (
                    columnOptions.map((col) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_" disabled>
                      Seleccione uma tabela primeiro
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Campo que identifica se o registo já existe (ex: email, NIF)
              </p>
            </div>
          )}

          {/* ── RPC Params ── */}
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
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={p.name}
                      onChange={(e) => updateRpcParam(i, { name: e.target.value })}
                      placeholder="Nome"
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
                    <div className="flex items-center gap-0.5 flex-1">
                      <Input
                        value={p.value}
                        onChange={(e) => updateRpcParam(i, { value: e.target.value })}
                        placeholder="Valor ou variável..."
                        className="flex-1 h-8 text-xs"
                      />
                      <VariablePicker
                        onSelect={(v) => updateRpcParam(i, { value: `{{${v.key}}}` })}
                        additionalVariables={webhookVars}
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

          <Separator />

          {/* ── Passo 6: Nome do resultado ── */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Como queres chamar este resultado?
            </Label>
            <Input
              value={outputVariable}
              onChange={(e) => setOutputVariable(e.target.value)}
              placeholder="Ex: Dados do lead, Informação do imóvel"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Usa este nome nos passos seguintes para aceder à informação
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

// ── Descrição legível para o preview do node ──

function describeOperation(nodeData: SupabaseQueryNodeData): string {
  const tableLabel = nodeData.table ? getTableLabel(nodeData.table) : ""

  switch (nodeData.operation) {
    case "select":
      return `Buscar dados de ${tableLabel}`
    case "insert":
      return `Criar registo em ${tableLabel}`
    case "update":
      return `Actualizar dados de ${tableLabel}`
    case "upsert":
      return `Criar ou actualizar ${tableLabel}`
    case "delete":
      return `Remover registo de ${tableLabel}`
    case "rpc":
      return `Executar ${nodeData.rpcFunction || "função"}`
    default:
      return "Operação não configurada"
  }
}

// ── Operation icons for preview ──

const OP_PREVIEW_ICONS: Record<SupabaseQueryOperation, string> = {
  select: "🔍",
  insert: "➕",
  update: "✏️",
  upsert: "🔄",
  delete: "🗑️",
  rpc: "⚡",
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
        title={nodeData.label || "Consulta ao Sistema"}
        description={!isConfigured ? "Consultar ou gravar dados" : undefined}
      >
        {isConfigured ? (
          <div className="space-y-1.5">
            <div className="rounded-lg bg-muted/60 px-2.5 py-1.5 space-y-1">
              <p className="text-[10px] font-medium text-foreground">
                {OP_PREVIEW_ICONS[nodeData.operation]}{" "}
                {describeOperation(nodeData)}
              </p>
              {nodeData.filters && nodeData.filters.length > 0 && (
                <p className="text-[10px] truncate">
                  {nodeData.filters.length} condição(ões)
                </p>
              )}
              {nodeData.outputVariable && (
                <p className="text-[10px]">
                  Resultado → {nodeData.outputVariable}
                </p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSheetOpen(true)
              }}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
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
            <Settings2 className="h-3.5 w-3.5" /> Configurar operação
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
