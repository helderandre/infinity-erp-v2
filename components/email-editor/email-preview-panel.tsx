'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  User,
  Users,
  ChevronsUpDown,
  Check,
  Loader2,
  RefreshCw,
  Pencil,
  Cog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTemplateVariables, type TemplateVariable } from '@/hooks/use-template-variables'
import { renderEmailToHtml, extractVariablesFromState } from '@/lib/email-renderer'

interface EmailPreviewPanelProps {
  editorState: string | null
  subject: string
}

interface PropertyOption {
  id: string
  title: string
  external_ref: string | null
  city: string | null
}

interface OwnerOption {
  id: string
  name: string
  nif: string | null
  email: string | null
}

interface ConsultantOption {
  id: string
  commercial_name: string
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof User }> = {
  proprietario: { label: 'Proprietário', icon: User },
  imovel: { label: 'Imóvel', icon: Building2 },
  consultor: { label: 'Consultor', icon: Users },
  processo: { label: 'Processo', icon: Cog },
  sistema: { label: 'Sistema', icon: Pencil },
}

function buildVariableGroups(variables: TemplateVariable[]) {
  const grouped = new Map<string, TemplateVariable[]>()

  for (const v of variables) {
    const cat = v.category
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(v)
  }

  return Array.from(grouped.entries()).map(([cat, vars]) => {
    const config = CATEGORY_CONFIG[cat] || { label: cat, icon: Pencil }
    return {
      key: cat,
      label: config.label,
      icon: config.icon,
      variables: vars,
    }
  })
}

export function EmailPreviewPanel({
  editorState,
  subject,
}: EmailPreviewPanelProps) {
  const { variables: templateVariables } = useTemplateVariables()
  // Entity selections
  const [selectedProperty, setSelectedProperty] = useState<PropertyOption | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<OwnerOption | null>(null)
  const [selectedConsultant, setSelectedConsultant] = useState<ConsultantOption | null>(null)

  // Manual overrides
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({})

  // Fetched variable values from entities
  const [entityVariables, setEntityVariables] = useState<Record<string, string>>({})

  // Loading state
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Options for selectors
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [consultantsLoading, setConsultantsLoading] = useState(false)

  // Search state
  const [propertySearch, setPropertySearch] = useState('')
  const [ownerSearch, setOwnerSearch] = useState('')

  // Popover open state
  const [propertyOpen, setPropertyOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [consultantOpen, setConsultantOpen] = useState(false)

  // Manual edit mode
  const [showManualFields, setShowManualFields] = useState(false)

  // Debounce timers
  const propertyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ownerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Variables used in the template
  const usedVariables = editorState ? extractVariablesFromState(editorState) : []

  // Load consultants once
  useEffect(() => {
    const fetchConsultants = async () => {
      setConsultantsLoading(true)
      try {
        const res = await fetch('/api/users/consultants')
        if (res.ok) {
          const data = await res.json()
          setConsultants(data)
        }
      } catch {
        // ignore
      } finally {
        setConsultantsLoading(false)
      }
    }
    fetchConsultants()
  }, [])

  // Search properties with debounce
  useEffect(() => {
    if (!propertyOpen) return
    if (propertyTimerRef.current) clearTimeout(propertyTimerRef.current)
    propertyTimerRef.current = setTimeout(async () => {
      setPropertiesLoading(true)
      try {
        const params = new URLSearchParams({ per_page: '20' })
        if (propertySearch) params.set('search', propertySearch)
        const res = await fetch(`/api/properties?${params}`)
        if (res.ok) {
          const json = await res.json()
          setProperties(
            (json.data || []).map((p: Record<string, unknown>) => ({
              id: p.id,
              title: p.title,
              external_ref: p.external_ref,
              city: p.city,
            }))
          )
        }
      } catch {
        // ignore
      } finally {
        setPropertiesLoading(false)
      }
    }, 300)
    return () => {
      if (propertyTimerRef.current) clearTimeout(propertyTimerRef.current)
    }
  }, [propertySearch, propertyOpen])

  // Search owners with debounce
  useEffect(() => {
    if (!ownerOpen) return
    if (ownerTimerRef.current) clearTimeout(ownerTimerRef.current)
    ownerTimerRef.current = setTimeout(async () => {
      setOwnersLoading(true)
      try {
        const params = new URLSearchParams()
        if (ownerSearch) params.set('search', ownerSearch)
        const res = await fetch(`/api/owners?${params}`)
        if (res.ok) {
          const data = await res.json()
          setOwners(
            data.map((o: Record<string, unknown>) => ({
              id: o.id,
              name: o.name,
              nif: o.nif,
              email: o.email,
            }))
          )
        }
      } catch {
        // ignore
      } finally {
        setOwnersLoading(false)
      }
    }, 300)
    return () => {
      if (ownerTimerRef.current) clearTimeout(ownerTimerRef.current)
    }
  }, [ownerSearch, ownerOpen])

  // Fetch entity data whenever selections change
  const fetchEntityData = useCallback(async () => {
    if (!selectedProperty && !selectedOwner && !selectedConsultant) {
      setEntityVariables({})
      return
    }

    setIsLoadingData(true)
    try {
      const res = await fetch('/api/libraries/emails/preview-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: selectedProperty?.id,
          owner_id: selectedOwner?.id,
          consultant_id: selectedConsultant?.id,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setEntityVariables(data.variables || {})
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingData(false)
    }
  }, [selectedProperty, selectedOwner, selectedConsultant])

  useEffect(() => {
    fetchEntityData()
  }, [fetchEntityData])

  // Merge entity variables with manual overrides (manual takes precedence)
  const mergedVariables: Record<string, string> = {
    ...entityVariables,
    ...Object.fromEntries(
      Object.entries(manualOverrides).filter(([, v]) => v.trim() !== '')
    ),
  }

  // Render the preview HTML
  const previewHtml = editorState
    ? renderEmailToHtml(editorState, mergedVariables)
    : '<p style="color: #6b7280; text-align: center; padding: 40px;">Nenhum conteúdo no template</p>'

  // Render subject with variables
  const previewSubject = subject.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const trimmed = key.trim()
    return mergedVariables[trimmed] ?? match
  })

  const handleManualChange = (variableKey: string, value: string) => {
    setManualOverrides((prev) => ({ ...prev, [variableKey]: value }))
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar - Entity selectors & manual fields */}
      <div className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5 min-w-0">
            {/* Entity selectors */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Dados de Entidades</h3>
              <p className="text-xs text-muted-foreground">
                Seleccione entidades para preencher as variáveis
              </p>

              {/* Property selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Imóvel
                </Label>
                <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal h-9"
                    >
                      <span className="truncate">
                        {selectedProperty
                          ? `${selectedProperty.external_ref || ''} - ${selectedProperty.title}`.trim().replace(/^- /, '')
                          : 'Seleccionar imóvel...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Pesquisar imóvel..."
                        value={propertySearch}
                        onValueChange={setPropertySearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {propertiesLoading ? 'A pesquisar...' : 'Nenhum imóvel encontrado.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {properties.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setSelectedProperty(
                                  selectedProperty?.id === p.id ? null : p
                                )
                                setPropertyOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedProperty?.id === p.id
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{p.title}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {[p.external_ref, p.city].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Owner selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Proprietário
                </Label>
                <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal h-9"
                    >
                      <span className="truncate">
                        {selectedOwner
                          ? selectedOwner.name
                          : 'Seleccionar proprietário...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Pesquisar proprietário..."
                        value={ownerSearch}
                        onValueChange={setOwnerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {ownersLoading ? 'A pesquisar...' : 'Nenhum proprietário encontrado.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {owners.map((o) => (
                            <CommandItem
                              key={o.id}
                              value={o.id}
                              onSelect={() => {
                                setSelectedOwner(
                                  selectedOwner?.id === o.id ? null : o
                                )
                                setOwnerOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedOwner?.id === o.id
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{o.name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {[o.nif, o.email].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Consultant selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Consultor
                </Label>
                <Popover open={consultantOpen} onOpenChange={setConsultantOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal h-9"
                    >
                      <span className="truncate">
                        {selectedConsultant
                          ? selectedConsultant.commercial_name
                          : 'Seleccionar consultor...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar consultor..." />
                      <CommandList>
                        <CommandEmpty>
                          {consultantsLoading ? 'A carregar...' : 'Nenhum consultor encontrado.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {consultants.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.commercial_name}
                              onSelect={() => {
                                setSelectedConsultant(
                                  selectedConsultant?.id === c.id ? null : c
                                )
                                setConsultantOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedConsultant?.id === c.id
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              {c.commercial_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Manual fields toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Valores Manuais</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowManualFields(!showManualFields)}
                >
                  <Pencil className="mr-1.5 h-3 w-3" />
                  {showManualFields ? 'Ocultar' : 'Editar'}
                </Button>
              </div>

              {!showManualFields && (
                <p className="text-xs text-muted-foreground">
                  Clique em &ldquo;Editar&rdquo; para preencher ou sobrescrever valores manualmente
                </p>
              )}

              {showManualFields && (
                <div className="space-y-4">
                  {buildVariableGroups(templateVariables).map((group) => {
                    const groupVars = group.variables.filter((v) =>
                      usedVariables.includes(v.key)
                    )
                    if (groupVars.length === 0) return null

                    const GroupIcon = group.icon
                    return (
                      <div key={group.key} className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <GroupIcon className="h-3.5 w-3.5" />
                          {group.label}
                        </Label>
                        {groupVars.map((v) => {
                          const entityValue = entityVariables[v.key] || ''
                          const manualValue = manualOverrides[v.key] ?? ''
                          return (
                            <div key={v.key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs">{v.label}</span>
                                {entityValue && !manualValue && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                    auto
                                  </Badge>
                                )}
                              </div>
                              <Input
                                className="h-8 text-xs"
                                placeholder={entityValue || `{{${v.key}}}`}
                                value={manualValue}
                                onChange={(e) => handleManualChange(v.key, e.target.value)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {/* Fields for variables not in any known definition */}
                  {usedVariables
                    .filter(
                      (v) =>
                        !templateVariables.some((tv) => tv.key === v)
                    )
                    .map((key) => (
                      <div key={key} className="space-y-1">
                        <span className="text-xs font-mono">{`{{${key}}}`}</span>
                        <Input
                          className="h-8 text-xs"
                          placeholder={`Valor para ${key}...`}
                          value={manualOverrides[key] ?? ''}
                          onChange={(e) => handleManualChange(key, e.target.value)}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Summary of resolved variables */}
            {usedVariables.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Variáveis no Template</h3>
                  <div className="space-y-1">
                    {usedVariables.map((key) => {
                      const resolved = mergedVariables[key]
                      const varDef = templateVariables.find(
                        (v) => v.key === key
                      )
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full shrink-0',
                              resolved ? 'bg-emerald-500' : 'bg-amber-500'
                            )}
                          />
                          <span className="text-muted-foreground truncate">
                            {varDef?.label || key}
                          </span>
                          <span className="ml-auto font-medium truncate max-w-[140px]">
                            {resolved || (
                              <span className="text-amber-600 font-normal">
                                {`{{${key}}}`}
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Refresh button */}
        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={fetchEntityData}
            disabled={isLoadingData}
          >
            {isLoadingData ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Actualizar dados
          </Button>
        </div>
      </div>

      {/* Center - Email preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
        {/* Subject bar */}
        <div className="px-6 py-3 border-b bg-background shrink-0">
          <div className="text-xs text-muted-foreground mb-0.5">Assunto:</div>
          <div className="text-sm font-medium">{previewSubject || '(sem assunto)'}</div>
        </div>

        {/* Email body preview */}
        <div className="flex-1 overflow-auto p-8">
          <div
            className="mx-auto bg-white rounded-lg shadow-sm"
            style={{ maxWidth: 620 }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
