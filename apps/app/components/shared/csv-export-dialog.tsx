'use client'

import { useState, useEffect } from 'react'
import { Download, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface CsvExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The API endpoint to call, e.g. '/api/export/contacts' */
  endpoint: string
  /** Title shown in the dialog */
  title: string
  /** Whether to show the consultant filter */
  showConsultantFilter?: boolean
  /** Extra query-string params merged into the export request — used by
   *  the kanban bulk export to pass `negocio_ids=…` so only the selected
   *  cards end up in the CSV. */
  extraParams?: Record<string, string>
  /** Optional summary line shown below the title (e.g. "12 negócios
   *  selecionados"). Helpful when the export is scoped by something
   *  the consultant did outside this dialog. */
  scopeLabel?: string
}

export function CsvExportDialog({
  open, onOpenChange, endpoint, title, showConsultantFilter = true,
  extraParams, scopeLabel,
}: CsvExportDialogProps) {
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [selectedConsultant, setSelectedConsultant] = useState('all')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (open && showConsultantFilter) {
      fetch('/api/users/consultants')
        .then(r => r.json())
        .then(d => setConsultants((d.data || d || []).map((c: Record<string, unknown>) => ({
          id: c.id as string, commercial_name: c.commercial_name as string,
        }))))
        .catch(() => {})
    }
  }, [open, showConsultantFilter])

  useEffect(() => {
    if (!open) setSelectedConsultant('all')
  }, [open])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (selectedConsultant !== 'all') params.set('consultant_id', selectedConsultant)
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          if (v) params.set(k, v)
        }
      }

      const res = await fetch(`${endpoint}?${params}`)
      if (!res.ok) throw new Error()

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Exportação concluída')
      onOpenChange(false)
    } catch {
      toast.error('Erro ao exportar')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm rounded-2xl">
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 dark:bg-neutral-800 rounded-t-2xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-white text-lg">Exportar {title}</DialogTitle>
          </div>
          {scopeLabel && (
            <p className="text-white/70 text-[11px] mt-2">{scopeLabel}</p>
          )}
        </div>

        <div className="space-y-4">
          {showConsultantFilter && (
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Consultor</Label>
              <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Todos os consultores
                    </span>
                  </SelectItem>
                  {consultants.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            O ficheiro CSV será exportado com codificação UTF-8 e separado por ponto e vírgula (compatível com Excel PT).
          </p>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-2">
          <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full w-full sm:w-auto" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            Exportar CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
