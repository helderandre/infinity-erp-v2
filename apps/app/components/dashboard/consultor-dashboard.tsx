'use client'

/**
 * Consultor PC dashboard. Built on top of the same data + cards used by the
 * mobile carousel (see [components/dashboard/mobile/mobile-dashboard.tsx]),
 * but laid out for a wide viewport: a compact horizontal hero on top,
 * then the four data cards in a 2-column grid. The mobile cards are
 * rendered without `fillViewport` so they size to their own content.
 *
 * Data fetched once at this level (consultor's own AgentMobileDashboard)
 * and passed to the cards that need it — same pattern as the mobile wrapper.
 */

import { useEffect, useState } from 'react'
import type { UserWithRole } from '@/hooks/use-user'
import {
  getAgentMobileDashboard,
  type AgentMobileDashboard,
} from '@/app/dashboard/financeiro/actions'
import { DashboardHero } from './dashboard-hero'
import { ContactosCard } from './mobile/contactos-card'
import { TodayCard } from './mobile/today-card'
import { AngariacoesFaturacaoCard } from './mobile/angariacoes-faturacao-card'
import { FinanceCard } from './mobile/finance-card'

interface ConsultorDashboardProps {
  user: UserWithRole
}

export function ConsultorDashboard({ user }: ConsultorDashboardProps) {
  const [agentData, setAgentData] = useState<AgentMobileDashboard | null>(null)
  const [agentLoading, setAgentLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getAgentMobileDashboard(user.id)
      .then((res) => {
        if (cancelled) return
        if (!res.error) {
          const { error: _err, ...rest } = res
          setAgentData(rest as AgentMobileDashboard)
        }
      })
      .catch((err) => {
        console.error('getAgentMobileDashboard failed:', err)
      })
      .finally(() => {
        if (!cancelled) setAgentLoading(false)
      })
    return () => { cancelled = true }
  }, [user.id])

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <DashboardHero user={user} />

      <div className="grid gap-5 lg:grid-cols-2">
        <ContactosCard userId={user.id} className="lg:min-h-[28rem]" />
        <TodayCard userId={user.id} className="lg:min-h-[28rem]" />
      </div>

      <AngariacoesFaturacaoCard
        data={agentData}
        loading={agentLoading}
        consultantId={user.id}
      />

      <FinanceCard
        data={agentData}
        loading={agentLoading}
        consultantId={user.id}
      />
    </div>
  )
}
