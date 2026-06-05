"use client"

import { useEffect, useState } from "react"

export interface TableColumn {
  name: string
  label: string
  type: string
}

export function useTableColumns(table: string | undefined) {
  const [columns, setColumns] = useState<TableColumn[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!table) {
      setColumns([])
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/automacao/schema/${encodeURIComponent(table)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.columns) {
          setColumns(data.columns)
        }
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [table])

  return { columns, loading }
}
