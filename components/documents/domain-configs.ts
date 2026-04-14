import {
  FileCheck,
  FileText,
  FolderOpen,
  Home,
  IdCard,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react'
import type { DocumentDomain, DomainConfig } from './types'

export const DOMAIN_CONFIGS: Record<DocumentDomain, DomainConfig> = {
  properties: {
    domain: 'properties',
    entityLabel: 'imóvel',
    categories: [
      { id: 'imovel', label: 'Imóvel', icon: Home },
      { id: 'contratual', label: 'Contratual', icon: FileText },
      { id: 'proprietario', label: 'Proprietário', icon: Users },
      { id: 'outros', label: 'Outros', icon: FolderOpen },
    ],
    fallbackCategoryId: 'outros',
  },
  leads: {
    domain: 'leads',
    entityLabel: 'lead',
    categories: [
      { id: 'identificacao', label: 'Identificação', icon: IdCard },
      { id: 'fiscal', label: 'Fiscal', icon: Receipt },
      { id: 'comprovativos', label: 'Comprovativos', icon: FileCheck },
      { id: 'outros', label: 'Outros', icon: FolderOpen },
    ],
    fallbackCategoryId: 'outros',
  },
  negocios: {
    domain: 'negocios',
    entityLabel: 'negócio',
    categories: [
      { id: 'identificacao', label: 'Identificação', icon: IdCard },
      { id: 'fiscal', label: 'Fiscal', icon: Receipt },
      { id: 'comprovativos', label: 'Comprovativos', icon: FileCheck },
      { id: 'contratos', label: 'Contratos', icon: FileText },
      { id: 'outros', label: 'Outros', icon: FolderOpen },
    ],
    fallbackCategoryId: 'outros',
  },
  processes: {
    domain: 'processes',
    entityLabel: 'processo',
    categories: [
      { id: 'imovel', label: 'Documentos do Imóvel', icon: Home },
      { id: 'proprietarios', label: 'Documentos de Proprietários', icon: Users },
      { id: 'tarefas', label: 'Documentos de Tarefas', icon: Wrench },
      { id: 'outros', label: 'Outros', icon: FolderOpen },
    ],
    fallbackCategoryId: 'outros',
  },
}

export function getCategoryConfig(domain: DocumentDomain, categoryId: string) {
  const config = DOMAIN_CONFIGS[domain]
  return (
    config.categories.find((c) => c.id === categoryId) ??
    config.categories.find((c) => c.id === config.fallbackCategoryId) ??
    config.categories[0]
  )
}
