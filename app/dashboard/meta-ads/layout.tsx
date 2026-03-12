import { PermissionGuard } from '@/components/shared/permission-guard'

export default function MetaAdsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="marketing">{children}</PermissionGuard>
}
