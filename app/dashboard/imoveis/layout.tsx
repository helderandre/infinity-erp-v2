import { PermissionGuard } from '@/components/shared/permission-guard'

export default function ImoveisLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="properties">{children}</PermissionGuard>
}
