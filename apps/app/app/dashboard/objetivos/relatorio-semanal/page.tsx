'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeeklyReportSheet } from '@/components/goals/weekly-report-sheet'

/**
 * Esta rota era a página dedicada do relatório semanal. Foi convertida
 * num shell que abre o `<WeeklyReportSheet>` automaticamente — preserva
 * deep-links existentes mas a UI é a mesma do `/dashboard/objetivos`.
 * Ao fechar, redirecciona para `/dashboard/objetivos`.
 */
export default function RelatorioSemanalPage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!open) router.replace('/dashboard/objetivos')
  }, [open, router])

  return <WeeklyReportSheet open={open} onOpenChange={setOpen} />
}
