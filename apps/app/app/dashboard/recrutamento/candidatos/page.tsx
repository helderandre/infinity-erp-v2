import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { RecruitmentBoard } from '@/components/recrutamento/recruitment-board'

// Quadro único de recrutamento (design quintino): kanban + sheets.
// O detalhe do candidato abre em sheet lateral via ?candidato=<id>.
export default function CandidatosPage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RecruitmentBoard />
    </Suspense>
  )
}
