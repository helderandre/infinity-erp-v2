'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, FolderOpen, Palette, Calendar, Newspaper, MessageSquareText, BarChart3 } from 'lucide-react'
import { SocialConsultoresTab } from '@/components/marketing/social/consultores-tab'
import { SocialAssetsTab } from '@/components/marketing/social/assets-tab'
import { SocialTemplatesTab } from '@/components/marketing/social/templates-tab'
import { SocialCalendarioTab } from '@/components/marketing/social/calendario-tab'
import { SocialPublicacoesTab } from '@/components/marketing/social/publicacoes-tab'
import { SocialPedidosTab } from '@/components/marketing/social/pedidos-tab'
import { SocialMetricasTab } from '@/components/marketing/social/metricas-tab'

export default function RedesSociaisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Redes Sociais</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de perfis, conteúdos e métricas das redes sociais dos consultores.
        </p>
      </div>

      <Tabs defaultValue="consultores" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="consultores" className="gap-1.5">
            <Users className="h-4 w-4" />
            Consultores
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <FolderOpen className="h-4 w-4" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Palette className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="publicacoes" className="gap-1.5">
            <Newspaper className="h-4 w-4" />
            Publicações
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="gap-1.5">
            <MessageSquareText className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="metricas" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consultores">
          <SocialConsultoresTab />
        </TabsContent>

        <TabsContent value="assets">
          <SocialAssetsTab />
        </TabsContent>

        <TabsContent value="templates">
          <SocialTemplatesTab />
        </TabsContent>

        <TabsContent value="calendario">
          <SocialCalendarioTab />
        </TabsContent>

        <TabsContent value="publicacoes">
          <SocialPublicacoesTab />
        </TabsContent>

        <TabsContent value="pedidos">
          <SocialPedidosTab />
        </TabsContent>

        <TabsContent value="metricas">
          <SocialMetricasTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
