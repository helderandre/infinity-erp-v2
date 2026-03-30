'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { LEAD_ORIGENS } from '@/lib/constants'
import {
  Upload, FileSpreadsheet, Sparkles, Trash2, AlertCircle,
  CheckCircle2, XCircle, Users, ArrowRight, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

interface ParsedLead {
  nome: string
  email: string
  telemovel: string
  telefone: string
  origem: string
  observacoes: string
}

interface ImportResult {
  index: number
  id?: string
  error?: string
  duplicate?: boolean
}

type Step = 'source' | 'mapping' | 'preview' | 'result'

const LEAD_FIELDS = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'telemovel', label: 'Telemóvel', required: false },
  { key: 'telefone', label: 'Telefone', required: false },
  { key: 'origem', label: 'Origem', required: false },
  { key: 'observacoes', label: 'Observações', required: false },
] as const

export function BulkImportDialog({ open, onOpenChange, onComplete }: BulkImportDialogProps) {
  const [step, setStep] = useState<Step>('source')
  const [tab, setTab] = useState<'csv' | 'ai'>('csv')
  const fileRef = useRef<HTMLInputElement>(null)

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})

  // Parsed leads
  const [leads, setLeads] = useState<ParsedLead[]>([])

  // AI state
  const [aiText, setAiText] = useState('')
  const [aiProcessing, setAiProcessing] = useState(false)

  // Import state
  const [importing, setImporting] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [defaultOrigem, setDefaultOrigem] = useState('')
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [results, setResults] = useState<ImportResult[]>([])

  useEffect(() => {
    if (open) {
      fetch('/api/users/consultants')
        .then(r => r.json())
        .then(d => setConsultants((d.data || d || []).map((c: Record<string, unknown>) => ({
          id: c.id as string, commercial_name: c.commercial_name as string,
        }))))
        .catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setStep('source')
      setTab('csv')
      setCsvHeaders([])
      setCsvRows([])
      setColumnMapping({})
      setLeads([])
      setAiText('')
      setAgentId('')
      setDefaultOrigem('')
      setResults([])
    }
  }, [open])

  // ---- CSV Parsing ----
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv'
    const isTxt = file.name.endsWith('.txt')
    if (!isCsv && !isTxt) {
      toast.error('Formato não suportado. Use CSV ou TXT.')
      return
    }

    Papa.parse(file, {
      complete: (result) => {
        const data = result.data as string[][]
        if (data.length < 2) {
          toast.error('Ficheiro vazio ou sem dados suficientes')
          return
        }

        const headers = data[0].map(h => h.trim())
        const rows = data.slice(1).filter(row => row.some(cell => cell.trim()))

        setCsvHeaders(headers)
        setCsvRows(rows)

        // Auto-map columns by name similarity
        const autoMap: Record<string, string> = {}
        for (const field of LEAD_FIELDS) {
          const match = headers.findIndex(h => {
            const lower = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            const fieldLower = field.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            return lower === fieldLower
              || lower === field.key
              || (field.key === 'nome' && (lower.includes('nome') || lower.includes('name')))
              || (field.key === 'email' && lower.includes('email'))
              || (field.key === 'telemovel' && (lower.includes('telemovel') || lower.includes('telefone') || lower.includes('phone') || lower.includes('mobile')))
              || (field.key === 'observacoes' && (lower.includes('observ') || lower.includes('nota') || lower.includes('note')))
              || (field.key === 'origem' && (lower.includes('origem') || lower.includes('source')))
          })
          if (match >= 0) {
            autoMap[field.key] = headers[match]
          }
        }
        setColumnMapping(autoMap)
        setStep('mapping')
        toast.success(`${rows.length} linhas encontradas`)
      },
      error: () => toast.error('Erro ao ler o ficheiro'),
    })

    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const applyMapping = useCallback(() => {
    if (!columnMapping.nome) {
      toast.error('O campo "Nome" é obrigatório. Mapeie uma coluna.')
      return
    }

    const mapped: ParsedLead[] = csvRows.map(row => {
      const getVal = (field: string) => {
        const header = columnMapping[field]
        if (!header) return ''
        const idx = csvHeaders.indexOf(header)
        return idx >= 0 ? (row[idx] || '').trim() : ''
      }
      return {
        nome: getVal('nome'),
        email: getVal('email'),
        telemovel: getVal('telemovel'),
        telefone: getVal('telefone'),
        origem: getVal('origem'),
        observacoes: getVal('observacoes'),
      }
    }).filter(l => l.nome)

    setLeads(mapped)
    setStep('preview')
  }, [columnMapping, csvHeaders, csvRows])

  // ---- AI Extraction ----
  const handleAiExtract = useCallback(async () => {
    if (!aiText.trim()) return
    setAiProcessing(true)
    try {
      const res = await fetch('/api/leads/extract-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      })
      if (!res.ok) throw new Error()
      const { leads: extracted } = await res.json()
      if (!extracted?.length) {
        toast.error('Nenhum contacto encontrado no texto')
        return
      }
      const mapped: ParsedLead[] = extracted.map((l: Record<string, string>) => ({
        nome: l.nome || '',
        email: l.email || '',
        telemovel: l.telemovel || '',
        telefone: l.telefone || '',
        origem: l.origem || '',
        observacoes: l.observacoes || '',
      })).filter((l: ParsedLead) => l.nome)

      setLeads(mapped)
      setStep('preview')
      toast.success(`${mapped.length} contacto${mapped.length !== 1 ? 's' : ''} extraído${mapped.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Erro ao extrair contactos')
    } finally {
      setAiProcessing(false)
    }
  }, [aiText])

  // ---- Remove lead from preview ----
  const removeLead = useCallback((idx: number) => {
    setLeads(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ---- Import ----
  const handleImport = useCallback(async () => {
    if (leads.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads,
          agent_id: agentId || undefined,
          default_origem: defaultOrigem || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro na importação')
      }
      const data = await res.json()
      setResults(data.results)
      setStep('result')

      if (data.success > 0) {
        toast.success(`${data.success} lead${data.success !== 1 ? 's' : ''} importada${data.success !== 1 ? 's' : ''} com sucesso`)
      }
      if (data.duplicates > 0) {
        toast.warning(`${data.duplicates} duplicado${data.duplicates !== 1 ? 's' : ''} ignorado${data.duplicates !== 1 ? 's' : ''}`)
      }
      if (data.errors > 0) {
        toast.error(`${data.errors} erro${data.errors !== 1 ? 's' : ''}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na importação')
    } finally {
      setImporting(false)
    }
  }, [leads, agentId, defaultOrigem])

  const successCount = results.filter(r => r.id && !r.duplicate).length
  const dupCount = results.filter(r => r.duplicate).length
  const errCount = results.filter(r => r.error && !r.duplicate).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Upload className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Importar Leads</DialogTitle>
              <p className="text-neutral-400 text-xs mt-0.5">
                {step === 'source' && 'Escolha a fonte dos dados'}
                {step === 'mapping' && 'Mapeie as colunas do ficheiro'}
                {step === 'preview' && `${leads.length} contacto${leads.length !== 1 ? 's' : ''} para importar`}
                {step === 'result' && 'Resultado da importação'}
              </p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(['source', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  s === step ? 'w-8 bg-white' :
                  (['source', 'mapping', 'preview', 'result'].indexOf(step) > i) ? 'w-4 bg-white/40' :
                  'w-4 bg-white/15'
                )} />
              </div>
            ))}
          </div>
        </div>

        {/* Step: Source */}
        {step === 'source' && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <Tabs value={tab} onValueChange={v => setTab(v as 'csv' | 'ai')}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="csv" className="rounded-lg gap-2 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Ficheiro CSV
                </TabsTrigger>
                <TabsTrigger value="ai" className="rounded-lg gap-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5" /> Colar Texto (IA)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="csv" className="space-y-4 mt-4">
                <div
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
                  onClick={() => fileRef.current?.click()}
                >
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium">Clique para seleccionar um ficheiro CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O ficheiro deve ter uma linha de cabeçalho com os nomes das colunas
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-medium mb-2">Formato esperado</p>
                  <code className="text-[11px] text-muted-foreground block leading-relaxed">
                    Nome,Email,Telemóvel,Observações{'\n'}
                    João Silva,joao@email.com,912345678,Interessado em T2{'\n'}
                    Maria Santos,maria@email.com,923456789,Cascais
                  </code>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Cole aqui o texto com os contactos
                  </Label>
                  <Textarea
                    value={aiText}
                    onChange={e => setAiText(e.target.value)}
                    placeholder={'João Silva - 912 345 678 - joao@email.com\nMaria Santos, 923456789, interessada em T3 Lisboa\n\nOu cole uma tabela, lista de emails, notas de reunião...'}
                    rows={8}
                    className="rounded-xl text-xs resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    A IA irá extrair automaticamente nomes, emails, telefones e notas do texto.
                  </p>
                </div>
                <Button
                  onClick={handleAiExtract}
                  disabled={!aiText.trim() || aiProcessing}
                  className="rounded-full gap-2"
                >
                  {aiProcessing ? (
                    <><Spinner variant="infinite" size={14} /> A extrair...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Extrair Contactos</>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <p className="text-xs text-muted-foreground">
              Mapeie cada coluna do ficheiro ao campo correspondente. Apenas &quot;Nome&quot; é obrigatório.
            </p>
            <div className="space-y-3">
              {LEAD_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <Label className="text-xs font-medium w-24 shrink-0">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={columnMapping[field.key] || '_none_'}
                    onValueChange={v => setColumnMapping(prev => ({
                      ...prev,
                      [field.key]: v === '_none_' ? '' : v,
                    }))}
                  >
                    <SelectTrigger className="rounded-xl text-xs">
                      <SelectValue placeholder="Seleccionar coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">— Não mapear —</SelectItem>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview of first 3 rows */}
            {csvRows.length > 0 && (
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">
                  Pré-visualização ({Math.min(3, csvRows.length)} de {csvRows.length} linhas)
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map(h => (
                          <TableHead key={h} className="text-[10px] py-1 px-2">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvRows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className="text-[11px] py-1 px-2 truncate max-w-[150px]">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Options */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs font-medium mb-1.5 block">Consultor (todos)</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="rounded-xl text-xs h-8">
                    <SelectValue placeholder="Sem atribuição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Sem atribuição</SelectItem>
                    {consultants.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs font-medium mb-1.5 block">Origem padrão</Label>
                <Select value={defaultOrigem} onValueChange={setDefaultOrigem}>
                  <SelectTrigger className="rounded-xl text-xs h-8">
                    <SelectValue placeholder="Manter do ficheiro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Manter do ficheiro</SelectItem>
                    {LEAD_ORIGENS.map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <ScrollArea className="flex-1 rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] py-1.5 px-2 w-8">#</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Nome</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Email</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Telemóvel</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Observações</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2 w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead, i) => (
                    <TableRow key={i} className="group">
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 font-medium">{lead.nome}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{lead.email || '—'}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{lead.telemovel || '—'}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground truncate max-w-[150px]">
                        {lead.observacoes || '—'}
                      </TableCell>
                      <TableCell className="py-1.5 px-2">
                        <button
                          onClick={() => removeLead(i)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{successCount}</p>
                <p className="text-[10px] text-emerald-600/80">Importadas</p>
              </div>
              <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                <AlertCircle className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{dupCount}</p>
                <p className="text-[10px] text-amber-600/80">Duplicados</p>
              </div>
              <div className="rounded-xl border bg-red-50 dark:bg-red-950/30 p-3 text-center">
                <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-700 dark:text-red-400">{errCount}</p>
                <p className="text-[10px] text-red-600/80">Erros</p>
              </div>
            </div>

            {/* Detailed results */}
            {(dupCount > 0 || errCount > 0) && (
              <ScrollArea className="flex-1 rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] py-1.5 px-2">Linha</TableHead>
                      <TableHead className="text-[10px] py-1.5 px-2">Nome</TableHead>
                      <TableHead className="text-[10px] py-1.5 px-2">Estado</TableHead>
                      <TableHead className="text-[10px] py-1.5 px-2">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.filter(r => r.error).map(r => (
                      <TableRow key={r.index}>
                        <TableCell className="text-[11px] py-1.5 px-2">{r.index + 1}</TableCell>
                        <TableCell className="text-[11px] py-1.5 px-2">{leads[r.index]?.nome}</TableCell>
                        <TableCell className="py-1.5 px-2">
                          <Badge variant="outline" className={cn(
                            'text-[9px] rounded-full',
                            r.duplicate ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'
                          )}>
                            {r.duplicate ? 'Duplicado' : 'Erro'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{r.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 border-t mt-2">
          {step === 'source' && (
            <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" className="rounded-full w-full sm:w-auto gap-2" onClick={() => setStep('source')}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button className="rounded-full w-full sm:w-auto gap-2" onClick={applyMapping}>
                Continuar <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" className="rounded-full w-full sm:w-auto gap-2" onClick={() => {
                if (tab === 'ai') setStep('source')
                else setStep('mapping')
              }}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button
                className="rounded-full w-full sm:w-auto gap-2"
                disabled={leads.length === 0 || importing}
                onClick={handleImport}
              >
                {importing ? (
                  <><Spinner variant="infinite" size={14} /> A importar...</>
                ) : (
                  <><Users className="h-3.5 w-3.5" /> Importar {leads.length} Lead{leads.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button className="rounded-full w-full sm:w-auto" onClick={() => {
              onOpenChange(false)
              onComplete?.()
            }}>
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
