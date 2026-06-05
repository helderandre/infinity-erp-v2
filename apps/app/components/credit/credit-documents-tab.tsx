'use client'

import { useState, useRef } from 'react'
import {
  FileText,
  Upload,
  Eye,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Send,
  CircleDashed,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  CREDIT_DOC_CATEGORY_LABELS,
  CREDIT_DOC_STATUS_COLORS,
} from '@/lib/constants'
import type { CreditDocument, CreditBank, CreditDocCategory } from '@/types/credit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const DOC_STATUS_ICONS: Record<string, React.ElementType> = {
  pendente: CircleDashed,
  solicitado: Send,
  recebido: Clock,
  validado: CheckCircle2,
  rejeitado: XCircle,
  expirado: AlertCircle,
}

const TITULAR_LABELS: Record<string, string> = {
  titular_1: '1.o Titular',
  titular_2: '2.o Titular',
  ambos: 'Ambos',
}

interface CreditDocumentsTabProps {
  creditId: string
  documents: CreditDocument[]
  progress: { total: number; completed: number; percentage: number }
  onRefresh: () => void
  banks: CreditBank[]
  onPopulateFromBank?: (bankId: string) => Promise<void>
  onUpdateDocument?: (docId: string, data: Record<string, unknown>) => Promise<void>
}

export function CreditDocumentsTab({
  creditId,
  documents,
  progress,
  onRefresh,
  banks,
  onPopulateFromBank,
  onUpdateDocument,
}: CreditDocumentsTabProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)

  // Group documents by category
  const grouped = documents.reduce<Record<string, CreditDocument[]>>((acc, doc) => {
    const cat = doc.categoria || 'geral'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {})

  // Sort categories
  const categoryOrder: CreditDocCategory[] = [
    'identificacao',
    'rendimentos',
    'patrimonio',
    'imovel',
    'fiscal',
    'empresa',
    'geral',
  ]
  const sortedCategories = categoryOrder.filter((cat) => grouped[cat])

  const handlePopulate = async (bankId: string) => {
    if (!onPopulateFromBank) return
    try {
      await onPopulateFromBank(bankId)
      toast.success('Documentos populados com sucesso')
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao popular documentos')
    }
  }

  const handleUploadClick = (docId: string) => {
    setActiveDocId(docId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeDocId || !onUpdateDocument) return

    setUploading(activeDocId)
    try {
      // Read file as base64 for the API
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          await onUpdateDocument(activeDocId, {
            status: 'recebido',
            file_name: file.name,
            file_size: file.size,
            file_mimetype: file.type,
            file_data: reader.result,
            data_recebido: new Date().toISOString(),
          })
          toast.success('Documento enviado com sucesso')
          onRefresh()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao enviar documento')
        } finally {
          setUploading(null)
          setActiveDocId(null)
        }
      }
      reader.readAsDataURL(file)
    } catch {
      setUploading(null)
      setActiveDocId(null)
    }

    // Reset file input
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleFileChange}
      />

      {/* Progress + Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Progresso: {progress.completed}/{progress.total} documentos
            </span>
            <span className="font-semibold">{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>

        {banks.length > 0 && onPopulateFromBank && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Popular
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {banks
                .filter((b) => b.is_active)
                .map((bank) => (
                  <DropdownMenuItem key={bank.id} onClick={() => handlePopulate(bank.id)}>
                    {bank.nome}
                    {bank.documentos_exigidos && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {bank.documentos_exigidos.length} docs
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Document groups */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum documento na checklist</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Utilize o botao &quot;Popular&quot; para adicionar documentos de um banco.
            </p>
          </CardContent>
        </Card>
      ) : (
        sortedCategories.map((category) => (
          <Card key={category}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold">
                {CREDIT_DOC_CATEGORY_LABELS[category] || category}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({grouped[category].length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {grouped[category]
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((doc) => {
                    const StatusIcon = DOC_STATUS_ICONS[doc.status] || CircleDashed
                    const statusConfig = CREDIT_DOC_STATUS_COLORS[doc.status]
                    const isUploading = uploading === doc.id

                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        {/* Status icon */}
                        <StatusIcon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            statusConfig ? statusConfig.text : 'text-muted-foreground'
                          )}
                        />

                        {/* Name + info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm truncate">{doc.nome}</span>
                            {doc.obrigatorio && (
                              <span className="text-[10px] text-red-500 font-medium">*</span>
                            )}
                          </div>
                          {doc.notas && (
                            <p className="text-xs text-muted-foreground truncate">{doc.notas}</p>
                          )}
                        </div>

                        {/* Titular badge */}
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {TITULAR_LABELS[doc.titular] || doc.titular}
                        </Badge>

                        {/* Status badge */}
                        {statusConfig && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0',
                              statusConfig.bg,
                              statusConfig.text
                            )}
                          >
                            {statusConfig.label}
                          </span>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.file_url ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              asChild
                            >
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-3.5 w-3.5" />
                                <span className="sr-only">Ver documento</span>
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isUploading}
                            onClick={() => handleUploadClick(doc.id)}
                          >
                            <Upload className={cn('h-3.5 w-3.5', isUploading && 'animate-pulse')} />
                            <span className="sr-only">Enviar ficheiro</span>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
