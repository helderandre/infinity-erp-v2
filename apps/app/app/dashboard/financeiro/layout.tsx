import { PermissionGuard } from '@/components/shared/permission-guard'

export default function ComissoesLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="commissions">{children}</PermissionGuard>
}
