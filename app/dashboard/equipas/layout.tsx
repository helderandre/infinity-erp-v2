import { PermissionGuard } from '@/components/shared/permission-guard'

export default function EquipasLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="teams">{children}</PermissionGuard>
}
