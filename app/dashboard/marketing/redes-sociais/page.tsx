'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Users, FolderOpen, Palette, Calendar, Newspaper, MessageSquareText, BarChart3 } from 'lucide-react'
import { SocialConsultoresTab } from '@/components/marketing/social/consultores-tab'
import { SocialAssetsTab } from '@/components/marketing/social/assets-tab'
import { SocialTemplatesTab } from '@/components/marketing/social/templates-tab'
import { SocialCalendarioTab } from '@/components/marketing/social/calendario-tab'
import { SocialPublicacoesTab } from '@/components/marketing/social/publicacoes-tab'
import { SocialPedidosTab } from '@/components/marketing/social/pedidos-tab'
import { SocialMetricasTab } from '@/components/marketing/social/metricas-tab'

const tabs = [
  { key: 'consultores', label: 'Consultores', icon: Users },
  { key: 'assets', label: 'Assets', icon: FolderOpen },
  { key: 'templates', label: 'Templates', icon: Palette },
  { key: 'calendario', label: 'Calendário', icon: Calendar },
  { key: 'publicacoes', label: 'Publicações', icon: Newspaper },
  { key: 'pedidos', label: 'Pedidos', icon: MessageSquareText },
  { key: 'metricas', label: 'Métricas', icon: BarChart3 },
] as const

type TabKey = (typeof tabs)[number]['key']

const tabContent: Record<TabKey, React.ReactNode> = {
  consultores: <SocialConsultoresTab />,
  assets: <SocialAssetsTab />,
  templates: <SocialTemplatesTab />,
  calendario: <SocialCalendarioTab />,
  publicacoes: <SocialPublicacoesTab />,
  pedidos: <SocialPedidosTab />,
  metricas: <SocialMetricasTab />,
}

export default function RedesSociaisPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('consultores')

  return (
    <div className="space-y-6">
      {/* Hero header card */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900 h-32 flex items-center px-8">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Redes Sociais
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Gestão de perfis, conteúdos e métricas das redes sociais dos consultores.
          </p>
        </div>
      </div>

      {/* Pill navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors shrink-0',
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content with fade transition */}
      <div
        key={activeTab}
        className="animate-in fade-in duration-300"
      >
        {tabContent[activeTab]}
      </div>
    </div>
  )
}
