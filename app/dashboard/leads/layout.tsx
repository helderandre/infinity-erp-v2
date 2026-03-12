import { PermissionGuard } from '@/components/shared/permission-guard'

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="leads">{children}</PermissionGuard>
}
