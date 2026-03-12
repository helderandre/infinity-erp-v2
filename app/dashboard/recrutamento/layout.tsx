import { PermissionGuard } from '@/components/shared/permission-guard'

export default function RecrutamentoLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="recruitment">{children}</PermissionGuard>
}
