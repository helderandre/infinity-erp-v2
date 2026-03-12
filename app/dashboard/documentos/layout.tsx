import { PermissionGuard } from '@/components/shared/permission-guard'

export default function DocumentosLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="documents">{children}</PermissionGuard>
}
