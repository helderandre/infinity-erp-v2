"use client"

import { useCallback } from "react"
import type { AutomationNode, AutomationEdge } from "@/lib/types/automation-flow"
import { isTriggerType } from "@/lib/types/automation-flow"

const NODE_WIDTH = 280
const NODE_HEIGHT = 120
const GAP_X = 80
const GAP_Y = 100

export function useAutoLayout() {
  const layoutNodes = useCallback(
    (nodes: AutomationNode[], edges: AutomationEdge[]): AutomationNode[] => {
      if (nodes.length === 0) return nodes

      // Build adjacency list
      const children = new Map<string, string[]>()
      const parents = new Map<string, string[]>()

      for (const edge of edges) {
        children.set(edge.source, [
          ...(children.get(edge.source) || []),
          edge.target,
        ])
        parents.set(edge.target, [
          ...(parents.get(edge.target) || []),
          edge.source,
        ])
      }

      // Find root nodes (triggers or nodes without parents)
      const roots = nodes.filter(
        (n) => isTriggerType(n.type) || !parents.has(n.id)
      )

      if (roots.length === 0) return nodes

      // BFS to assign levels
      const levels = new Map<string, number>()
      const queue: string[] = []

      for (const root of roots) {
        levels.set(root.id, 0)
        queue.push(root.id)
      }

      while (queue.length > 0) {
        const current = queue.shift()!
        const currentLevel = levels.get(current) || 0

        for (const child of children.get(current) || []) {
          const existingLevel = levels.get(child)
          if (existingLevel === undefined || existingLevel < currentLevel + 1) {
            levels.set(child, currentLevel + 1)
            queue.push(child)
          }
        }
      }

      // Handle disconnected nodes
      let maxLevel = 0
      for (const level of levels.values()) {
        if (level > maxLevel) maxLevel = level
      }
      for (const node of nodes) {
        if (!levels.has(node.id)) {
          levels.set(node.id, ++maxLevel)
        }
      }

      // Group nodes by level
      const levelGroups = new Map<number, string[]>()
      for (const [nodeId, level] of levels) {
        levelGroups.set(level, [...(levelGroups.get(level) || []), nodeId])
      }

      // Calculate positions
      const nodeMap = new Map(nodes.map((n) => [n.id, n]))
      const positioned = new Map<string, { x: number; y: number }>()

      for (const [level, nodeIds] of levelGroups) {
        const totalWidth = nodeIds.length * NODE_WIDTH + (nodeIds.length - 1) * GAP_X
        const startX = -totalWidth / 2

        nodeIds.forEach((nodeId, index) => {
          positioned.set(nodeId, {
            x: startX + index * (NODE_WIDTH + GAP_X),
            y: level * (NODE_HEIGHT + GAP_Y),
          })
        })
      }

      return nodes.map((node) => {
        const pos = positioned.get(node.id)
        if (!pos) return node
        return { ...node, position: pos }
      })
    },
    []
  )

  return { layoutNodes }
}
