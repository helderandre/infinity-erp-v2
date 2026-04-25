'use client'

import { use } from 'react'
import { ConsultantGoalDashboard } from '@/components/goals/consultant-goal-dashboard'

export default function ObjetivoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ConsultantGoalDashboard goalId={id} mode="self" showBackLink />
}
