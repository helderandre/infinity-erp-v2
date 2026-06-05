'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CreditSimulator } from '@/components/credit/credit-simulator'
import { ArrowLeft } from 'lucide-react'

export default function SimuladorPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulador de Crédito Habitação</h1>
          <p className="text-muted-foreground">
            Calcule prestações, MTIC e taxa de esforço para crédito habitação em Portugal
          </p>
        </div>
      </div>

      <CreditSimulator />
    </div>
  )
}
