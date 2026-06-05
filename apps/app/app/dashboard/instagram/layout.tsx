import { PermissionGuard } from '@/components/shared/permission-guard'

export default function InstagramLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="marketing">{children}</PermissionGuard>
}
