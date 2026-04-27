'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, Loader2, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface DocumentRow {
  id: string
  doc_type_id: string | null
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  label: string | null
  valid_until: string | null
  created_at: string
}

interface DocumentosTabProps {
  negocioId: string
}

export function DocumentosTab({ negocioId }: DocumentosTabProps) {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

  const refetch = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocs(Array.isArray(data) ? data : (data.data ?? []))
      }
    } catch {
      toast.error('Erro a carregar documentos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId])

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/negocios/${negocioId}/documents`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Erro a carregar documento')
        return
      }
      toast.success('Documento carregado')
      refetch()
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Eliminar este documento?')) return
    const res = await fetch(`/api/negocios/${negocioId}/documents/${docId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Erro a eliminar')
      return
    }
    toast.success('Documento eliminado')
    refetch()
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Documentos do Negócio</h3>
          {docs.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {docs.length}
            </Badge>
          )}
        </div>
        <label className={cn(
          'inline-flex items-center gap-1.5 rounded-md text-xs font-medium px-3 py-1.5 cursor-pointer transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          isUploading && 'pointer-events-none opacity-60',
        )}>
          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {isUploading ? 'A carregar…' : 'Carregar documento'}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleUpload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          A carregar…
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center space-y-2">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sem documentos ainda. Carrega comprovativos, contratos ou anexos relacionados com este negócio.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.label || d.file_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(parseISO(d.created_at), "d MMM yyyy", { locale: pt })}
                  {d.file_size ? ` · ${(d.file_size / 1024).toFixed(0)} KB` : ''}
                  {d.valid_until && ` · válido até ${format(parseISO(d.valid_until), 'd MMM yyyy', { locale: pt })}`}
                </p>
              </div>
              <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(d.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
