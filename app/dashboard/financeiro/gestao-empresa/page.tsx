import { EmpresaTabsNav } from '@/components/financial/empresa-tabs-nav'
import { CompanyManagementTab } from '@/components/financial/company-management-tab'

export default function GestaoEmpresaPage() {
  return (
    <div className="space-y-4">
      <EmpresaTabsNav active="despesas" />
      <CompanyManagementTab />
    </div>
  )
}
