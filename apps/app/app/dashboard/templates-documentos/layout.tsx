import { PermissionGuard } from '@/components/shared/permission-guard'

export default function TemplatesDocumentosLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="settings">{children}</PermissionGuard>
}
