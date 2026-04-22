import type { Database } from './database'

export type AcessosCustomSite =
  Database['public']['Tables']['acessos_custom_sites']['Row']

export type HydratedAcessosCustomSite = AcessosCustomSite & {
  can_edit: boolean
  can_delete: boolean
}
