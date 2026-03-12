'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShopTab } from '@/components/marketing/shop-tab'
import { OrdersTab } from '@/components/marketing/orders-tab'
import { CatalogTab } from '@/components/marketing/catalog-tab'
import { PacksTab } from '@/components/marketing/packs-tab'
import { Store, ClipboardList, ShoppingBag, PackageOpen } from 'lucide-react'

export default function MarketingLojaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loja</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de serviços, packs e encomendas de marketing.
        </p>
      </div>

      <Tabs defaultValue="shop" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="shop" className="gap-1.5">
            <Store className="h-4 w-4" />
            Loja
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Encomendas
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1.5">
            <ShoppingBag className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="packs" className="gap-1.5">
            <PackageOpen className="h-4 w-4" />
            Packs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shop">
          <ShopTab />
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>

        <TabsContent value="catalog">
          <CatalogTab />
        </TabsContent>

        <TabsContent value="packs">
          <PacksTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
