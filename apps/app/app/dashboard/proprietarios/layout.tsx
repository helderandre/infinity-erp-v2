import { PermissionGuard } from '@/components/shared/permission-guard'

export default function ProprietariosLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="owners">{children}</PermissionGuard>
}
