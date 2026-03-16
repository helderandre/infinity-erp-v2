'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarketingRequestsTab } from '@/components/marketing/marketing-requests-tab'
import { MyProductsTab } from '@/components/marketing/my-products-tab'
import { CalendarDays, Box } from 'lucide-react'

export default function MarketingGestaoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Os Meus Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Pedidos de serviços e produtos comprados.
        </p>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="requests" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="my-products" className="gap-1.5">
            <Box className="h-4 w-4" />
            Materiais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <MarketingRequestsTab />
        </TabsContent>

        <TabsContent value="my-products">
          <MyProductsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
