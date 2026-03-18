'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  AlertTriangle,
  Folder,
  ChevronRight,
} from 'lucide-react'

const FOLDER_ICONS: Record<string, React.ElementType> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  trash: Trash2,
  archive: Archive,
  junk: AlertTriangle,
}

const FOLDER_LABELS: Record<string, string> = {
  inbox: 'Caixa de Entrada',
  sent: 'Enviados',
  drafts: 'Rascunhos',
  trash: 'Lixo',
  archive: 'Arquivo',
  junk: 'Spam',
}

interface FolderItem {
  name: string
  path: string
  special?: string
  delimiter?: string
}

interface FolderNode {
  name: string
  path: string
  special?: string
  children: FolderNode[]
}

interface FolderSidebarProps {
  folders: FolderItem[]
  activeFolder: string
  onFolderChange: (path: string) => void
  isLoading?: boolean
}

/**
 * Build a tree from flat IMAP folder list using path + delimiter
 */
function buildFolderTree(folders: FolderItem[]): FolderNode[] {
  // Detect delimiter from folders (usually '.' or '/')
  const delimiter = folders.find((f) => f.delimiter)?.delimiter || '.'

  // Sort: special folders first, then alphabetically
  const specialOrder = ['inbox', 'sent', 'drafts', 'trash', 'junk', 'archive']
  const sorted = [...folders].sort((a, b) => {
    const aIdx = a.special ? specialOrder.indexOf(a.special) : 99
    const bIdx = b.special ? specialOrder.indexOf(b.special) : 99
    if (aIdx !== bIdx) return aIdx - bIdx
    return a.name.localeCompare(b.name, 'pt')
  })

  // Build tree: group children under parents based on path segments
  const rootNodes: FolderNode[] = []
  const nodeMap = new Map<string, FolderNode>()

  // First pass: create nodes
  for (const folder of sorted) {
    const node: FolderNode = {
      name: folder.name,
      path: folder.path,
      special: folder.special,
      children: [],
    }
    nodeMap.set(folder.path, node)
  }

  // Second pass: link parents
  for (const folder of sorted) {
    const node = nodeMap.get(folder.path)!
    const parts = folder.path.split(delimiter)

    if (parts.length > 1) {
      // Try to find parent
      const parentPath = parts.slice(0, -1).join(delimiter)
      const parent = nodeMap.get(parentPath)
      if (parent) {
        parent.children.push(node)
        continue
      }
    }

    rootNodes.push(node)
  }

  // Sort children alphabetically
  function sortChildren(nodes: FolderNode[]) {
    for (const node of nodes) {
      node.children.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      sortChildren(node.children)
    }
  }
  sortChildren(rootNodes)

  return rootNodes
}

export function FolderSidebar({
  folders,
  activeFolder,
  onFolderChange,
  isLoading,
}: FolderSidebarProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  const tree = useMemo(() => buildFolderTree(folders), [folders])

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="space-y-0.5 p-2">
        {tree.map((node) => (
          <FolderTreeItem
            key={node.path}
            node={node}
            activeFolder={activeFolder}
            onFolderChange={onFolderChange}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Recursive tree item ──────────────────────────────────────────────

function FolderTreeItem({
  node,
  activeFolder,
  onFolderChange,
  depth,
}: {
  node: FolderNode
  activeFolder: string
  onFolderChange: (path: string) => void
  depth: number
}) {
  const hasChildren = node.children.length > 0
  // Auto-expand if active folder is this node or a descendant
  const isActiveOrDescendant =
    activeFolder === node.path || activeFolder.startsWith(node.path + '.')
  const [expanded, setExpanded] = useState(isActiveOrDescendant || !!node.special)

  const Icon = (node.special && FOLDER_ICONS[node.special]) || Folder
  const label = (node.special && FOLDER_LABELS[node.special]) || node.name
  const isActive = node.path === activeFolder

  return (
    <div>
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="sm"
        className={cn(
          'w-full justify-start gap-1.5 text-sm h-8 min-w-0',
          isActive && 'font-medium'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => {
          onFolderChange(node.path)
          if (hasChildren) setExpanded((e) => !e)
        }}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              expanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Button>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.path}
              node={child}
              activeFolder={activeFolder}
              onFolderChange={onFolderChange}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
