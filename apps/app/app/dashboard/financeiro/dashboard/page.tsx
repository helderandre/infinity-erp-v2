import { EmpresaTabsNav } from '@/components/financial/empresa-tabs-nav'
import { FinancialDashboardTab } from '@/components/financial/financial-dashboard-tab'

export default function FinancialDashboardPage() {
  return (
    <div className="space-y-4">
      <EmpresaTabsNav active="resumo" />
      <FinancialDashboardTab />
    </div>
  )
}
