import { PermissionGuard } from '@/components/shared/permission-guard'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="marketing">{children}</PermissionGuard>
}
