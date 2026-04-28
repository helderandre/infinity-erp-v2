import { PermissionGuard } from '@/components/shared/permission-guard'

// Integrações (Meta Ads etc.) é gestão. Antes herdava o gate do layout
// pai `definicoes/layout.tsx`, mas esse foi removido para libertar
// `/dashboard/definicoes/email` (per-consultor) — agora é per-secção.
export default function IntegracoesLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGuard module="settings">{children}</PermissionGuard>
}
