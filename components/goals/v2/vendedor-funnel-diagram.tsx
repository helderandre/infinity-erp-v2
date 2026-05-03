'use client'

import type { AgentGoalInput, ComputedTargets } from '@/types/agent-goal'
import { FunnelStageBox } from './funnel-stage-box'
import { FunnelConnector } from './funnel-connector'
import { InlineNumberInput, ratioToPct, pctToRatio } from './inline-number-input'
import { Phone, Search, FileText, Tag, Eye, FileSignature, Handshake, KeyRound } from 'lucide-react'

interface VendedorFunnelDiagramProps {
  goal: AgentGoalInput
  targets: ComputedTargets
  update: <K extends keyof AgentGoalInput>(key: K, value: AgentGoalInput[K]) => void
}

// Two parallel chains converging on a SINGLE Fechos terminal:
//
//   ┌─ Captação ─────┐    ┌─ Atividade ────┐
//   │ Contactos       │    │ Visitas         │
//   │ ↓ ratio         │    │ ↓ ratio         │
//   │ Pré-angariações │    │ Propostas       │
//   │ ↓ %             │    │ ↓ Nª            │
//   │ Estudos         │    │ CPCVs           │
//   │ ↓ %             │    │                 │
//   │ Angariações     │    │                 │
//   └─────────────────┘    └─────────────────┘
//          ↓ "71% dão em fecho"  ↓ "95%"
//             └───────┬───────────┘   T-junction
//                     ↓
//               ┌─ FECHOS ─┐
//               │  X / ano │
//               └──────────┘
export function VendedorFunnelDiagram({ goal, targets, update }: VendedorFunnelDiagramProps) {
  const weeks = goal.working_weeks_per_year || 1

  return (
    <div className="space-y-0">
      {/* ── Two parallel chains ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
        {/* Captação */}
        <div className="flex flex-col items-center">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Captação
          </h3>

          <FunnelStageBox
            label="Contactos"
            icon={Phone}
            annual={targets.vend_target_contactos}
            weekly={targets.vend_target_contactos / weeks}
          />

          <FunnelConnector>
            A cada{' '}
            <InlineNumberInput
              value={goal.vend_contactos_per_pre_angariacao}
              onChange={(v) => update('vend_contactos_per_pre_angariacao', v)}
              min={1}
              step={1}
              width="w-14"
            />{' '}
            contactos, faço uma pré-angariação.
          </FunnelConnector>

          <FunnelStageBox
            label="Pré-angariações"
            icon={Search}
            annual={targets.vend_target_pre_angariacoes}
            weekly={targets.vend_target_pre_angariacoes / weeks}
          />

          <FunnelConnector>
            Envio estudos de mercado a{' '}
            <InlineNumberInput
              value={ratioToPct(goal.vend_pre_angariacoes_per_estudo)}
              onChange={(pct) => update('vend_pre_angariacoes_per_estudo', pctToRatio(pct))}
              min={1}
              max={100}
              step={1}
              suffix="%"
              width="w-14"
            />{' '}
            dos meus clientes.
          </FunnelConnector>

          <FunnelStageBox
            label="Estudos de Mercado"
            icon={FileText}
            annual={targets.vend_target_estudos}
            weekly={targets.vend_target_estudos / weeks}
          />

          <FunnelConnector>
            <InlineNumberInput
              value={ratioToPct(goal.vend_estudos_per_angariacao)}
              onChange={(pct) => update('vend_estudos_per_angariacao', pctToRatio(pct))}
              min={1}
              max={100}
              step={1}
              suffix="%"
              width="w-14"
            />{' '}
            dos meus estudos resultam numa angariação.
          </FunnelConnector>

          <FunnelStageBox
            label="Angariações"
            icon={Tag}
            annual={targets.vend_target_angariacoes}
            weekly={targets.vend_target_angariacoes / weeks}
          />
        </div>

        {/* Atividade */}
        <div className="flex flex-col items-center">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Atividade até ao fecho
          </h3>

          <FunnelStageBox
            label="Visitas"
            icon={Eye}
            annual={targets.vend_target_visitas}
            weekly={targets.vend_target_visitas / weeks}
          />

          <FunnelConnector>
            Necessito de{' '}
            <InlineNumberInput
              value={goal.vend_visitas_per_proposta}
              onChange={(v) => update('vend_visitas_per_proposta', v)}
              min={1}
              step={0.5}
              width="w-14"
            />{' '}
            visitas até receber uma proposta.
          </FunnelConnector>

          <FunnelStageBox
            label="Propostas"
            icon={FileSignature}
            annual={targets.vend_target_propostas}
            weekly={targets.vend_target_propostas / weeks}
          />

          <FunnelConnector>
            Só à{' '}
            <InlineNumberInput
              value={goal.vend_propostas_per_cpcv}
              onChange={(v) => update('vend_propostas_per_cpcv', v)}
              min={1}
              step={1}
              suffix="ª"
              width="w-14"
            />{' '}
            proposta se fecha um CPCV.
          </FunnelConnector>

          <FunnelStageBox
            label="CPCVs"
            icon={Handshake}
            annual={targets.vend_target_cpcvs}
            weekly={targets.vend_target_cpcvs / weeks}
          />
        </div>
      </div>

      {/* ── Bridge connector (only on the captação chain) ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4 pt-1">
        <div className="flex flex-col items-center">
          <FunnelConnector variant="bridge">
            <InlineNumberInput
              value={ratioToPct(goal.vend_angariacoes_per_escritura)}
              onChange={(pct) => update('vend_angariacoes_per_escritura', pctToRatio(pct))}
              min={1}
              max={100}
              step={1}
              suffix="%"
              width="w-14"
            />{' '}
            das minhas angariações dão em fecho.
          </FunnelConnector>
        </div>
        {/* right column has no extra connector — CPCVs == Fechos 1:1 */}
        <div />
      </div>

      {/* ── T-junction merge ───────────────────────────────────── */}
      <div className="relative h-6 mx-auto" aria-hidden>
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-border" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-px bg-border" />
      </div>

      {/* ── Single Fechos terminal (= CPCVs, 1:1) ──────────────── */}
      <div className="flex justify-center">
        <div className="w-full max-w-[260px]">
          <FunnelStageBox
            label="Fechos"
            icon={KeyRound}
            annual={targets.vend_target_escrituras}
            emphasis="terminal"
            hint="se um cair, planeia mais 1 negócio"
          />
        </div>
      </div>
    </div>
  )
}
