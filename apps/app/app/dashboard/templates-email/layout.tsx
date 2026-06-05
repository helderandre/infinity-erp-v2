import { PermissionGuard } from '@/components/shared/permission-guard'

export default function TemplatesEmailLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module={['settings', 'leads']}>{children}</PermissionGuard>
}
