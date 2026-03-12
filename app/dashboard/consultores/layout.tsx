import { PermissionGuard } from '@/components/shared/permission-guard'

export default function ConsultoresLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="consultants">{children}</PermissionGuard>
}
