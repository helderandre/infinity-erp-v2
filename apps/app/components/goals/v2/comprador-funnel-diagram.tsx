'use client'

import type { AgentGoalInput, ComputedTargets } from '@/types/agent-goal'
import { FunnelStageBox } from './funnel-stage-box'
import { FunnelConnector } from './funnel-connector'
import { InlineNumberInput, ratioToPct, pctToRatio } from './inline-number-input'
import { Phone, Search, Eye, FileSignature, KeyRound } from 'lucide-react'

interface CompradorFunnelDiagramProps {
  goal: AgentGoalInput
  targets: ComputedTargets
  update: <K extends keyof AgentGoalInput>(key: K, value: AgentGoalInput[K]) => void
}

// Single linear chain:
//   Contactos → Pesquisas → Visitas → Propostas → CPCVs → Fechos (95%)
export function CompradorFunnelDiagram({ goal, targets, update }: CompradorFunnelDiagramProps) {
  const weeks = goal.working_weeks_per_year || 1

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <FunnelStageBox
        label="Contactos"
        icon={Phone}
        annual={targets.comp_target_contactos}
        weekly={targets.comp_target_contactos / weeks}
      />

      <FunnelConnector>
        A cada{' '}
        <InlineNumberInput
          value={goal.comp_contactos_per_pesquisa}
          onChange={(v) => update('comp_contactos_per_pesquisa', v)}
          min={1}
          step={1}
          width="w-14"
        />{' '}
        contactos com potenciais compradores, começo pesquisas com 1 cliente.
      </FunnelConnector>

      <FunnelStageBox
        label="Pesquisas (clientes activos)"
        icon={Search}
        annual={targets.comp_target_pesquisas}
        weekly={targets.comp_target_pesquisas / weeks}
      />

      <FunnelConnector>
        Destes clientes a quem envio imóveis, começo visitas com{' '}
        <InlineNumberInput
          value={ratioToPct(goal.comp_pesquisas_per_visita)}
          onChange={(pct) => update('comp_pesquisas_per_visita', pctToRatio(pct))}
          min={1}
          max={100}
          step={1}
          suffix="%"
          width="w-14"
        />.
      </FunnelConnector>

      <FunnelStageBox
        label="Visitas"
        icon={Eye}
        annual={targets.comp_target_visitas}
        weekly={targets.comp_target_visitas / weeks}
      />

      <FunnelConnector>
        O cliente precisa de visitar{' '}
        <InlineNumberInput
          value={goal.comp_visitas_per_proposta}
          onChange={(v) => update('comp_visitas_per_proposta', v)}
          min={1}
          step={1}
          width="w-14"
        />{' '}
        imóveis até apresentar uma proposta.
      </FunnelConnector>

      <FunnelStageBox
        label="Propostas"
        icon={FileSignature}
        annual={targets.comp_target_propostas}
        weekly={targets.comp_target_propostas / weeks}
      />

      <FunnelConnector>
        Por norma, só à{' '}
        <InlineNumberInput
          value={goal.comp_propostas_per_cpcv}
          onChange={(v) => update('comp_propostas_per_cpcv', v)}
          min={1}
          step={1}
          suffix="ª"
          width="w-14"
        />{' '}
        proposta se fecha um CPCV.
      </FunnelConnector>

      <FunnelStageBox
        label="Fechos"
        icon={KeyRound}
        annual={targets.comp_target_cpcvs}
        weekly={targets.comp_target_cpcvs / weeks}
        emphasis="terminal"
        hint="cada CPCV = 1 escritura · se um cair, planeia mais 1 negócio"
      />
    </div>
  )
}
