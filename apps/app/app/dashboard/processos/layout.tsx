import { PermissionGuard } from '@/components/shared/permission-guard'

export default function ProcessosLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="processes">{children}</PermissionGuard>
}
