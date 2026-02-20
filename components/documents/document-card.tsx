'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import type { Document } from '@/types/document'

interface DocumentCardProps {
  document: Document
  onPreview?: () => void
  compact?: boolean
}

export function DocumentCard({ document, onPreview, compact = false }: DocumentCardProps) {
  const statusConfig = STATUS_COLORS[document.status as keyof typeof STATUS_COLORS]
  const isExpired = document.valid_until && new Date(document.valid_until) < new Date()

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{document.file_name}</p>
              {isExpired ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : document.status === 'active' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {document.doc_type?.name && <span>{document.doc_type.name}</span>}
              {document.valid_until && (
                <span className={isExpired ? 'text-red-600' : ''}>
                  Valido ate {formatDate(document.valid_until)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {statusConfig && (
              <Badge
                variant="outline"
                className={`${statusConfig.bg} ${statusConfig.text} border-0 text-xs`}
              >
                {statusConfig.label}
              </Badge>
            )}
            {onPreview && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPreview}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
