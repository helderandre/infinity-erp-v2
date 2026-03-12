import { PermissionGuard } from '@/components/shared/permission-guard'

export default function AutomacaoLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="settings">{children}</PermissionGuard>
}
