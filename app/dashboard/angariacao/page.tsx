'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { DraftsList } from '@/components/acquisitions/drafts-list'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'

export default function AngariacaoPage() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | undefined>()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleResume = (draftId: string) => {
    setResumeDraftId(draftId)
    setDialogOpen(true)
  }

  const handleNew = () => {
    setResumeDraftId(undefined)
    setDialogOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setResumeDraftId(undefined)
      setRefreshKey((k) => k + 1)
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Angariação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submeta novos imóveis para angariação
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Angariação
        </Button>
      </div>

      <DraftsList key={refreshKey} onResume={handleResume} />

      <AcquisitionDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        draftId={resumeDraftId}
        onComplete={(procInstanceId) => {
          router.push(`/dashboard/processos/${procInstanceId}`)
        }}
      />
    </div>
  )
}
