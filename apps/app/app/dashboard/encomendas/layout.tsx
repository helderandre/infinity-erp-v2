import { EncomendasTabsNav } from '@/components/encomendas/encomendas-tabs-nav'

export default function EncomendasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <EncomendasTabsNav />
      {children}
    </div>
  )
}
