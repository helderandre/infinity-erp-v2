'use client'

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { DocumentFolder } from '@/types/process'

interface DocumentBreadcrumbNavProps {
  currentFolder: DocumentFolder | null
  onNavigateRoot: () => void
}

export function DocumentBreadcrumbNav({ currentFolder, onNavigateRoot }: DocumentBreadcrumbNavProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {currentFolder === null ? (
          <BreadcrumbItem>
            <BreadcrumbPage>Documentos</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={onNavigateRoot}
              >
                Documentos
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentFolder.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
