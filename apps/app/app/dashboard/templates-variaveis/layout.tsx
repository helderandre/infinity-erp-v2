import { PermissionGuard } from '@/components/shared/permission-guard'

export default function TemplatesVariaveisLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="settings">{children}</PermissionGuard>
}
