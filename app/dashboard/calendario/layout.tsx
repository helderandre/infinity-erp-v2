import { PermissionGuard } from '@/components/shared/permission-guard'

export default function CalendarioLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="calendar">{children}</PermissionGuard>
}
