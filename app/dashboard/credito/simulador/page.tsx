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
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
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
