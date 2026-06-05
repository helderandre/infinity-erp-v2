'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnnouncePropertyDialog } from './announce-property-dialog'

interface Props {
  processId: string
  /** Quando false, esconde o botão. Tipicamente passado pelo caller que
   *  já decidiu visibilidade (gestão + stage 3). */
  visible?: boolean
}

/**
 * Botão "Anunciar no Geral" no header de uma stage do processo de
 * angariação. Click → abre `<AnnouncePropertyDialog>` para preview +
 * envio. Não envia imediatamente — é necessário confirmar no dialog.
 */
export function AnnouncePropertyButton({ processId, visible = true }: Props) {
  const [open, setOpen] = useState(false)
  if (!visible) return null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          'h-7 rounded-full text-[11px] font-medium gap-1.5 px-3',
          'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10',
        )}
        title="Anunciar no canal Geral"
      >
        <Megaphone className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Anunciar no Geral</span>
      </Button>

      <AnnouncePropertyDialog
        open={open}
        onOpenChange={setOpen}
        processId={processId}
      />
    </>
  )
}
