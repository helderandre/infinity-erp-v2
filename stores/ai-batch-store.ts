import { create } from 'zustand'

export interface AiBatchJob {
  id: string
  propertyId: string
  type: 'stage' | 'enhance' | 'lighting'
  style?: string
  done: number
  total: number
  succeeded: number
  failed: number
  completedUrls: string[]
  finished: boolean
}

interface AiBatchStore {
  job: AiBatchJob | null
  showPreview: boolean

  startJob: (propertyId: string, type: AiBatchJob['type'], total: number, style?: string) => string
  updateJob: (updates: Partial<Pick<AiBatchJob, 'done' | 'succeeded' | 'failed' | 'completedUrls'>>) => void
  finishJob: () => void
  dismiss: () => void
  setShowPreview: (show: boolean) => void
}

let jobCounter = 0

export const useAiBatchStore = create<AiBatchStore>((set) => ({
  job: null,
  showPreview: false,

  startJob: (propertyId, type, total, style) => {
    const id = `ai-batch-${++jobCounter}`
    set({
      job: {
        id,
        propertyId,
        type,
        style,
        done: 0,
        total,
        succeeded: 0,
        failed: 0,
        completedUrls: [],
        finished: false,
      },
      showPreview: false,
    })
    return id
  },

  updateJob: (updates) =>
    set((state) => {
      if (!state.job) return state
      return {
        job: {
          ...state.job,
          ...updates,
          completedUrls: updates.completedUrls ?? state.job.completedUrls,
        },
      }
    }),

  finishJob: () =>
    set((state) => {
      if (!state.job) return state
      return { job: { ...state.job, finished: true } }
    }),

  dismiss: () => set({ job: null, showPreview: false }),

  setShowPreview: (show) => set({ showPreview: show }),
}))
