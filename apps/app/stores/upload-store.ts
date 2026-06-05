import { create } from 'zustand'

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  fileName: string
  status: UploadStatus
  progress: number // 0-100
  error?: string
  context?: string // e.g. "Imóvel T3 Lisboa"
  thumbnailUrl?: string
}

interface UploadStore {
  items: UploadItem[]
  isMinimized: boolean
  addItem: (item: Omit<UploadItem, 'status' | 'progress'>) => void
  updateItem: (id: string, updates: Partial<UploadItem>) => void
  removeItem: (id: string) => void
  clearDone: () => void
  toggleMinimized: () => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  items: [],
  isMinimized: false,

  addItem: (item) =>
    set((state) => ({
      items: [
        ...state.items,
        { ...item, status: 'pending', progress: 0 },
      ],
      isMinimized: false,
    })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),

  clearDone: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'done'),
    })),

  toggleMinimized: () =>
    set((state) => ({ isMinimized: !state.isMinimized })),
}))
