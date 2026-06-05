'use client'

import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FinanceiroSheet } from './financeiro-sheet'
import { ConsultorResumo } from '@/components/financial/consultor/consultor-resumo'

interface ConsultantSummary {
  id: string
  commercial_name: string
  profile_photo_url: string | null
  comissoes_ytd: number
  loja_ytd: number
  saldo_cc: number
  credit_limit: number | null
  a_receber: number
}

interface ConsultorDetailSheetProps {
  consultant: ConsultantSummary | null
  onClose: () => void
}

// Sheet com a vista completa (Resumo / P&L pessoal) do consultor.
// Renderiza o mesmo `<ConsultorResumo>` que o consultor vê na própria home,
// mas em modo drill-down dentro de uma sheet com o styling do calendário.
export function ConsultorDetailSheet({ consultant, onClose }: ConsultorDetailSheetProps) {
  if (!consultant) {
    return <FinanceiroSheet open={false} onOpenChange={() => {}} title=""><div /></FinanceiroSheet>
  }

  const initials =
    consultant.commercial_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '—'

  return (
    <FinanceiroSheet
      open={consultant !== null}
      onOpenChange={(v) => !v && onClose()}
      title={consultant.commercial_name}
      accent={<User className="h-3.5 w-3.5" />}
      subtitle={`Vista financeira · ${new Date().getFullYear()}`}
      size="wide"
      footer={
        <Button variant="ghost" onClick={onClose} className="rounded-full">
          Fechar
        </Button>
      }
    >
      {/* Avatar header */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={consultant.profile_photo_url ?? undefined} />
          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight truncate">{consultant.commercial_name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Consultor · somente leitura</p>
        </div>
      </div>

      {/* Vista completa: KPIs + 12-meses + pie loja + próximas entradas + últimas mov. */}
      <ConsultorResumo agentId={consultant.id} />
    </FinanceiroSheet>
  )
}
