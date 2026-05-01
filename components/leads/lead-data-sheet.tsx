'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { IdCard } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { LeadDataCard } from './lead-data-card'
import type { LeadWithAgent, LeadAttachment } from '@/types/lead'

interface LeadDataSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadWithAgent
  form: Record<string, unknown>
  onFieldChange: (field: string, value: unknown) => void
  onSave: (fields: string[]) => Promise<void>
  isSaving: boolean
  attachments: LeadAttachment[]
  onDeleteAttachment: (id: string) => void
  onDocumentAnalysisApply: (fields: Record<string, unknown>) => void
  cpLoading: boolean
  onPostalCodeLookup: () => void
  nipcLoading: boolean
  onNipcLookup: () => void
}

export function LeadDataSheet({
  open,
  onOpenChange,
  lead,
  form,
  onFieldChange,
  onSave,
  isSaving,
  attachments,
  onDeleteAttachment,
  onDocumentAnalysisApply,
  cpLoading,
  onPostalCodeLookup,
  nipcLoading,
  onNipcLookup,
}: LeadDataSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[640px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <IdCard className="h-5 w-5" />
            Dados do contacto
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Identificação, morada, empresa e identificação do consultor
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <LeadDataCard
            lead={lead}
            form={form}
            onFieldChange={onFieldChange}
            onSave={onSave}
            isSaving={isSaving}
            attachments={attachments}
            onDeleteAttachment={onDeleteAttachment}
            onDocumentAnalysisApply={onDocumentAnalysisApply}
            cpLoading={cpLoading}
            onPostalCodeLookup={onPostalCodeLookup}
            nipcLoading={nipcLoading}
            onNipcLookup={onNipcLookup}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
