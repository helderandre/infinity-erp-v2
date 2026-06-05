import { PermissionGuard } from '@/components/shared/permission-guard'

export default function CreditoLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="credit">{children}</PermissionGuard>
}
