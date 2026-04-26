'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { LEAD_ORIGENS } from '@/lib/constants'
import {
  Upload, FileSpreadsheet, Trash2, CheckCircle2, XCircle,
  Send, ArrowRight, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'

interface BulkImportEntriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

interface ParsedEntry {
  nome: string
  email: string
  telemovel: string
  telefone: string
  source: string
  notes: string
  property_external_ref: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  priority: string
}

interface ImportResult {
  index: number
  contact_id?: string
  entry_id?: string
  error?: string
}

type Step = 'source' | 'mapping' | 'preview' | 'result'

const ENTRY_FIELDS = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'telemovel', label: 'Telemóvel', required: false },
  { key: 'telefone', label: 'Telefone', required: false },
  { key: 'source', label: 'Origem (source)', required: false },
  { key: 'notes', label: 'Notas', required: false },
  { key: 'property_external_ref', label: 'Ref. imóvel', required: false },
  { key: 'utm_source', label: 'UTM Source', required: false },
  { key: 'utm_medium', label: 'UTM Medium', required: false },
  { key: 'utm_campaign', label: 'UTM Campaign', required: false },
  { key: 'priority', label: 'Prioridade', required: false },
] as const

export function BulkImportEntriesDialog({ open, onOpenChange, onComplete }: BulkImportEntriesDialogProps) {
  const { user } = useUser()
  const [step, setStep] = useState<Step>('source')
  const fileRef = useRef<HTMLInputElement>(null)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState<string>('')

  const [entries, setEntries] = useState<ParsedEntry[]>([])

  const [importing, setImporting] = useState(false)
  const [consultantId, setConsultantId] = useState('')
  const [defaultSource, setDefaultSource] = useState('csv_import')
  const [defaultPriority, setDefaultPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [results, setResults] = useState<ImportResult[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/users/consultants')
      .then(r => r.json())
      .then(d => setConsultants((d.data || d || []).map((c: Record<string, unknown>) => ({
        id: c.id as string, commercial_name: c.commercial_name as string,
      }))))
      .catch(() => {})
  }, [open])

  // Default the assigned consultant to the importer themselves.
  useEffect(() => {
    if (open && user?.id && !consultantId) setConsultantId(user.id)
  }, [open, user?.id, consultantId])

  useEffect(() => {
    if (!open) {
      setStep('source')
      setCsvHeaders([])
      setCsvRows([])
      setColumnMapping({})
      setEntries([])
      setConsultantId('')
      setDefaultSource('csv_import')
      setDefaultPriority('medium')
      setResults([])
      setFileName('')
    }
  }, [open])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv'
    const isTxt = file.name.endsWith('.txt')
    if (!isCsv && !isTxt) {
      toast.error('Formato não suportado. Use CSV ou TXT.')
      return
    }
    setFileName(file.name)
    Papa.parse(file, {
      delimitersToGuess: [',', ';', '\t', '|'],
      skipEmptyLines: true,
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

        // Auto-map by header similarity
        const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        const auto: Record<string, string> = {}
        for (const f of ENTRY_FIELDS) {
          const target = norm(f.label)
          const altKey = norm(f.key)
          const match = headers.findIndex(h => {
            const n = norm(h)
            if (n === target || n === altKey) return true
            if (f.key === 'nome' && (n.includes('nome') || n.includes('name'))) return true
            if (f.key === 'email' && n.includes('email')) return true
            if (f.key === 'telemovel' && (n.includes('telemovel') || n.includes('telefone') || n.includes('phone') || n.includes('mobile'))) return true
            if (f.key === 'source' && (n.includes('source') || n.includes('origem') || n.includes('canal'))) return true
            if (f.key === 'notes' && (n.includes('nota') || n.includes('note') || n.includes('observ'))) return true
            if (f.key === 'property_external_ref' && (n.includes('ref') || n.includes('imovel'))) return true
            if (f.key === 'utm_source' && n === 'utm_source') return true
            if (f.key === 'utm_medium' && n === 'utm_medium') return true
            if (f.key === 'utm_campaign' && n === 'utm_campaign') return true
            if (f.key === 'priority' && (n.includes('prioridade') || n.includes('priority'))) return true
            return false
          })
          if (match >= 0) auto[f.key] = headers[match]
        }
        setColumnMapping(auto)
        setStep('mapping')
        toast.success(`${rows.length} linha${rows.length !== 1 ? 's' : ''} encontrada${rows.length !== 1 ? 's' : ''}`)
      },
      error: () => toast.error('Erro ao ler o ficheiro'),
    })
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const applyMapping = useCallback(() => {
    if (!columnMapping.nome) {
      toast.error('O campo "Nome" é obrigatório.')
      return
    }
    const mapped: ParsedEntry[] = csvRows.map(row => {
      const getVal = (k: string) => {
        const header = columnMapping[k]
        if (!header) return ''
        const idx = csvHeaders.indexOf(header)
        return idx >= 0 ? (row[idx] || '').trim() : ''
      }
      return {
        nome: getVal('nome'),
        email: getVal('email'),
        telemovel: getVal('telemovel'),
        telefone: getVal('telefone'),
        source: getVal('source'),
        notes: getVal('notes'),
        property_external_ref: getVal('property_external_ref'),
        utm_source: getVal('utm_source'),
        utm_medium: getVal('utm_medium'),
        utm_campaign: getVal('utm_campaign'),
        priority: getVal('priority'),
      }
    }).filter(e => e.nome)
    setEntries(mapped)
    setStep('preview')
  }, [columnMapping, csvHeaders, csvRows])

  const removeEntry = useCallback((idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleImport = useCallback(async () => {
    if (entries.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/leads/entries/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries,
          assigned_consultant_id: consultantId || undefined,
          default_source: defaultSource || undefined,
          default_priority: defaultPriority,
          file_name: fileName || undefined,
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
        toast.success(`${data.success} lead${data.success !== 1 ? 's' : ''} importada${data.success !== 1 ? 's' : ''}`)
      }
      if (data.errors > 0) {
        toast.error(`${data.errors} erro${data.errors !== 1 ? 's' : ''}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na importação')
    } finally {
      setImporting(false)
    }
  }, [entries, consultantId, defaultSource, defaultPriority, fileName])

  const successCount = results.filter(r => r.entry_id).length
  const errCount = results.filter(r => r.error).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Importar Leads (entries)</DialogTitle>
              <p className="text-neutral-400 text-xs mt-0.5">
                {step === 'source' && 'Carregue um CSV com os leads (cada linha cria contacto + entry)'}
                {step === 'mapping' && 'Mapeie as colunas do ficheiro'}
                {step === 'preview' && `${entries.length} lead${entries.length !== 1 ? 's' : ''} para importar`}
                {step === 'result' && 'Resultado da importação'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {(['source', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => (
              <div key={s} className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                s === step ? 'w-8 bg-white' :
                (['source', 'mapping', 'preview', 'result'].indexOf(step) > i) ? 'w-4 bg-white/40' :
                'w-4 bg-white/15'
              )} />
            ))}
          </div>
        </div>

        {step === 'source' && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Clique para seleccionar um ficheiro CSV</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cada linha cria um leads_entries + leads (contacto). Sem dedup.
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
              <p className="text-xs font-medium mb-2">Colunas suportadas</p>
              <code className="text-[11px] text-muted-foreground block leading-relaxed">
                Nome,Email,Telemóvel,Source,UTM Source,UTM Medium,UTM Campaign,Notas,Ref. imóvel,Prioridade
              </code>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <p className="text-xs text-muted-foreground">
              Mapeie cada coluna do ficheiro ao campo correspondente. Apenas &quot;Nome&quot; é obrigatório.
            </p>
            <div className="space-y-2">
              {ENTRY_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <Label className="text-xs font-medium w-32 shrink-0">
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
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Consultor (todos)</Label>
                <Select value={consultantId} onValueChange={setConsultantId}>
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
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Source padrão</Label>
                <Input
                  value={defaultSource}
                  onChange={e => setDefaultSource(e.target.value)}
                  placeholder="csv_import"
                  className="rounded-xl text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Prioridade padrão</Label>
                <Select value={defaultPriority} onValueChange={(v) => setDefaultPriority(v as typeof defaultPriority)}>
                  <SelectTrigger className="rounded-xl text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1 rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] py-1.5 px-2 w-8">#</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Nome</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Email</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Telemóvel</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2">Source</TableHead>
                    <TableHead className="text-[10px] py-1.5 px-2 w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={i} className="group">
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 font-medium">{entry.nome}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{entry.email || '—'}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{entry.telemovel || '—'}</TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{entry.source || defaultSource}</TableCell>
                      <TableCell className="py-1.5 px-2">
                        <button
                          onClick={() => removeEntry(i)}
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

        {step === 'result' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{successCount}</p>
                <p className="text-[10px] text-emerald-600/80">Importadas</p>
              </div>
              <div className="rounded-xl border bg-red-50 dark:bg-red-950/30 p-3 text-center">
                <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-700 dark:text-red-400">{errCount}</p>
                <p className="text-[10px] text-red-600/80">Erros</p>
              </div>
            </div>

            {errCount > 0 && (
              <ScrollArea className="flex-1 rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] py-1.5 px-2">Linha</TableHead>
                      <TableHead className="text-[10px] py-1.5 px-2">Nome</TableHead>
                      <TableHead className="text-[10px] py-1.5 px-2">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.filter(r => r.error).map(r => (
                      <TableRow key={r.index}>
                        <TableCell className="text-[11px] py-1.5 px-2">{r.index + 1}</TableCell>
                        <TableCell className="text-[11px] py-1.5 px-2">{entries[r.index]?.nome}</TableCell>
                        <TableCell className="text-[11px] py-1.5 px-2 text-muted-foreground">{r.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        )}

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
              <Button variant="outline" className="rounded-full w-full sm:w-auto gap-2" onClick={() => setStep('mapping')}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button
                className="rounded-full w-full sm:w-auto gap-2"
                disabled={entries.length === 0 || importing}
                onClick={handleImport}
              >
                {importing ? (
                  <><Spinner variant="infinite" size={14} /> A importar...</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Importar {entries.length} Lead{entries.length !== 1 ? 's' : ''}</>
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
