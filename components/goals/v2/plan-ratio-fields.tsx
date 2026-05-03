'use client'

import { InlineNumberInput, ratioToPct, pctToRatio } from './inline-number-input'
import type { AgentGoalInput } from '@/types/agent-goal'

function ProseRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm px-3 py-2.5 text-[13px] leading-relaxed">
      {children}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  )
}

// ─── Vendedor ────────────────────────────────────────────────────────────────

interface VendedorProps {
  goal: AgentGoalInput
  update: <K extends keyof AgentGoalInput>(key: K, value: AgentGoalInput[K]) => void
}

export function VendedorRatioFields({ goal, update }: VendedorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <SectionHeader>Captação</SectionHeader>
        <ProseRow>
          A cada{' '}
          <InlineNumberInput
            value={goal.vend_contactos_per_pre_angariacao}
            onChange={(v) => update('vend_contactos_per_pre_angariacao', v)}
            min={1}
            step={1}
            width="w-14"
          />{' '}
          contactos, faço uma <strong>pré-angariação</strong>.
        </ProseRow>
        <ProseRow>
          Envio <strong>estudos de mercado</strong> a{' '}
          <InlineNumberInput
            value={ratioToPct(goal.vend_pre_angariacoes_per_estudo)}
            onChange={(p) => update('vend_pre_angariacoes_per_estudo', pctToRatio(p))}
            min={1}
            max={100}
            step={1}
            suffix="%"
            width="w-14"
          />{' '}
          dos meus clientes.
        </ProseRow>
        <ProseRow>
          <InlineNumberInput
            value={ratioToPct(goal.vend_estudos_per_angariacao)}
            onChange={(p) => update('vend_estudos_per_angariacao', pctToRatio(p))}
            min={1}
            max={100}
            step={1}
            suffix="%"
            width="w-14"
          />{' '}
          dos meus estudos resultam numa <strong>angariação</strong>.
        </ProseRow>
      </div>

      <div className="space-y-1.5">
        <SectionHeader>Atividade até ao fecho</SectionHeader>
        <ProseRow>
          Necessito de{' '}
          <InlineNumberInput
            value={goal.vend_visitas_per_proposta}
            onChange={(v) => update('vend_visitas_per_proposta', v)}
            min={1}
            step={0.5}
            width="w-14"
          />{' '}
          visitas até receber uma <strong>proposta</strong>.
        </ProseRow>
        <ProseRow>
          Só à{' '}
          <InlineNumberInput
            value={goal.vend_propostas_per_cpcv}
            onChange={(v) => update('vend_propostas_per_cpcv', v)}
            min={1}
            step={1}
            suffix="ª"
            width="w-14"
          />{' '}
          proposta se fecha um <strong>CPCV</strong>.
        </ProseRow>
      </div>

      <div className="space-y-1.5">
        <SectionHeader>Conexão captação → fecho</SectionHeader>
        <ProseRow>
          <InlineNumberInput
            value={ratioToPct(goal.vend_angariacoes_per_escritura)}
            onChange={(p) => update('vend_angariacoes_per_escritura', pctToRatio(p))}
            min={1}
            max={100}
            step={1}
            suffix="%"
            width="w-14"
          />{' '}
          das minhas <strong>angariações</strong> dão em fecho.
        </ProseRow>
        <p className="text-[10px] text-muted-foreground/70 px-1">
          Ponte entre captação e fecho — ratio que liga as duas chains.
        </p>
      </div>
    </div>
  )
}

// ─── Comprador ───────────────────────────────────────────────────────────────

interface CompradorProps {
  goal: AgentGoalInput
  update: <K extends keyof AgentGoalInput>(key: K, value: AgentGoalInput[K]) => void
}

export function CompradorRatioFields({ goal, update }: CompradorProps) {
  return (
    <div className="space-y-1.5">
      <ProseRow>
        A cada{' '}
        <InlineNumberInput
          value={goal.comp_contactos_per_pesquisa}
          onChange={(v) => update('comp_contactos_per_pesquisa', v)}
          min={1}
          step={1}
          width="w-14"
        />{' '}
        contactos com potenciais compradores, começo <strong>pesquisas de imóveis</strong> com 1 cliente.
      </ProseRow>
      <ProseRow>
        Destes clientes a quem envio imóveis, começo <strong>visitas</strong> com{' '}
        <InlineNumberInput
          value={ratioToPct(goal.comp_pesquisas_per_visita)}
          onChange={(p) => update('comp_pesquisas_per_visita', pctToRatio(p))}
          min={1}
          max={100}
          step={1}
          suffix="%"
          width="w-14"
        />.
      </ProseRow>
      <ProseRow>
        O cliente precisa de visitar{' '}
        <InlineNumberInput
          value={goal.comp_visitas_per_proposta}
          onChange={(v) => update('comp_visitas_per_proposta', v)}
          min={1}
          step={1}
          width="w-14"
        />{' '}
        imóveis até apresentar uma <strong>proposta</strong>.
      </ProseRow>
      <ProseRow>
        Por norma, só à{' '}
        <InlineNumberInput
          value={goal.comp_propostas_per_cpcv}
          onChange={(v) => update('comp_propostas_per_cpcv', v)}
          min={1}
          step={1}
          suffix="ª"
          width="w-14"
        />{' '}
        proposta se fecha um <strong>CPCV</strong>.
      </ProseRow>
    </div>
  )
}
