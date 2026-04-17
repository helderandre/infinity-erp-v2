import { PermissionGuard } from '@/components/shared/permission-guard'

export default function ComunicacaoLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="dashboard">{children}</PermissionGuard>
}
