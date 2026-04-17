'use client'

import { FileStack, ExternalLink, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ProcessChatHeaderProps {
  processId: string
  externalRef: string
  propertyTitle?: string | null
  onBack?: () => void
}

export function ProcessChatHeader({
  processId,
  externalRef,
  propertyTitle,
  onBack,
}: ProcessChatHeaderProps) {
  return (
    <div className="border-b px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
          <FileStack className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{externalRef}</h3>
          {propertyTitle && (
            <p className="text-[11px] text-muted-foreground truncate">{propertyTitle}</p>
          )}
        </div>
      </div>

      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 shrink-0" asChild>
        <Link href={`/dashboard/processos/${processId}`}>
          Ver processo
          <ExternalLink className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  )
}
