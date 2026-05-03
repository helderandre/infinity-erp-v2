'use client'

import type { ComputedTargets } from '@/types/agent-goal'
import { FunnelStageBox } from './funnel-stage-box'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Phone, Search, FileText, Tag, Eye, FileSignature, KeyRound,
} from 'lucide-react'

// Compact arrow with optional inline annotation between two stage boxes.
function MiniArrow({ label, variant = 'normal' }: { label?: string; variant?: 'normal' | 'bridge' | 'fixed' }) {
  return (
    <div className="relative flex flex-col items-center my-0.5">
      <div className={cn('h-1.5 w-px', variant === 'bridge' ? 'bg-primary/40' : 'bg-border/60')} />
      {label && (
        <div className={cn(
          'text-[9px] px-2 py-0.5 rounded-md text-center',
          variant === 'bridge' && 'border border-dashed border-primary/40 bg-primary/5 text-primary/80',
          variant === 'fixed' && 'border border-emerald-500/30 bg-emerald-50/50 text-emerald-800',
          variant === 'normal' && 'text-muted-foreground/70',
        )}>
          {label}
        </div>
      )}
      <div className={cn('h-1.5 w-px', variant === 'bridge' ? 'bg-primary/40' : 'bg-border/60')} />
      <ChevronDown className={cn(
        'h-2.5 w-2.5 -mt-1',
        variant === 'bridge' ? 'text-primary/60' : 'text-muted-foreground/40',
      )} />
    </div>
  )
}

// Compact, read-only preview of the Vendedor funnel: two parallel chains
// converging on a single Fechos terminal.
export function MiniFunnelVendedor({ targets, weeks }: { targets: ComputedTargets; weeks: number }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {/* Captação chain */}
        <div className="flex flex-col items-center">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Captação
          </div>
          <FunnelStageBox label="Contactos" icon={Phone} annual={targets.vend_target_contactos} weekly={targets.vend_target_contactos / weeks} size="compact" />
          <MiniArrow />
          <FunnelStageBox label="Pré-angariações" icon={Search} annual={targets.vend_target_pre_angariacoes} weekly={targets.vend_target_pre_angariacoes / weeks} size="compact" />
          <MiniArrow />
          <FunnelStageBox label="Estudos" icon={FileText} annual={targets.vend_target_estudos} weekly={targets.vend_target_estudos / weeks} size="compact" />
          <MiniArrow />
          <FunnelStageBox label="Angariações" icon={Tag} annual={targets.vend_target_angariacoes} weekly={targets.vend_target_angariacoes / weeks} size="compact" />
        </div>

        {/* Atividade chain */}
        <div className="flex flex-col items-center">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Atividade
          </div>
          <FunnelStageBox label="Visitas" icon={Eye} annual={targets.vend_target_visitas} weekly={targets.vend_target_visitas / weeks} size="compact" />
          <MiniArrow />
          <FunnelStageBox label="Propostas" icon={FileSignature} annual={targets.vend_target_propostas} weekly={targets.vend_target_propostas / weeks} size="compact" />
          <MiniArrow />
          <FunnelStageBox label="CPCVs" icon={KeyRound} annual={targets.vend_target_cpcvs} weekly={targets.vend_target_cpcvs / weeks} size="compact" />
        </div>
      </div>

      {/* Convergence: single Fechos box centered */}
      <div className="relative h-3 mx-auto" aria-hidden>
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-border" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-px bg-border" />
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-[200px]">
          <FunnelStageBox
            label="Fechos"
            icon={KeyRound}
            annual={targets.vend_target_escrituras}
            emphasis="terminal"
            size="compact"
          />
        </div>
      </div>
    </div>
  )
}

// Compact preview of the Comprador funnel: single linear chain.
export function MiniFunnelComprador({ targets, weeks }: { targets: ComputedTargets; weeks: number }) {
  return (
    <div className="mx-auto flex w-full max-w-[280px] flex-col items-center">
      <FunnelStageBox label="Contactos" icon={Phone} annual={targets.comp_target_contactos} weekly={targets.comp_target_contactos / weeks} size="compact" />
      <MiniArrow />
      <FunnelStageBox label="Pesquisas" icon={Search} annual={targets.comp_target_pesquisas} weekly={targets.comp_target_pesquisas / weeks} size="compact" />
      <MiniArrow />
      <FunnelStageBox label="Visitas" icon={Eye} annual={targets.comp_target_visitas} weekly={targets.comp_target_visitas / weeks} size="compact" />
      <MiniArrow />
      <FunnelStageBox label="Propostas" icon={FileSignature} annual={targets.comp_target_propostas} weekly={targets.comp_target_propostas / weeks} size="compact" />
      <MiniArrow />
      <FunnelStageBox
        label="Fechos"
        icon={KeyRound}
        annual={targets.comp_target_cpcvs}
        emphasis="terminal"
        size="compact"
      />
    </div>
  )
}
