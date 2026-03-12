'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarketingRequestsTab } from '@/components/marketing/marketing-requests-tab'
import { MyProductsTab } from '@/components/marketing/my-products-tab'
import { ContaCorrenteTab } from '@/components/marketing/conta-corrente-tab'
import { CalendarDays, Box, Wallet } from 'lucide-react'

export default function MarketingGestaoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão</h1>
        <p className="text-sm text-muted-foreground">
          Pedidos de serviços, produtos comprados e conta corrente.
        </p>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="requests" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="my-products" className="gap-1.5">
            <Box className="h-4 w-4" />
            Os Meus Produtos
          </TabsTrigger>
          <TabsTrigger value="conta-corrente" className="gap-1.5">
            <Wallet className="h-4 w-4" />
            Conta Corrente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <MarketingRequestsTab />
        </TabsContent>

        <TabsContent value="my-products">
          <MyProductsTab />
        </TabsContent>

        <TabsContent value="conta-corrente">
          <ContaCorrenteTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
