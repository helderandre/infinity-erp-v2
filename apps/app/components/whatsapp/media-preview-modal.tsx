'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MediaPreviewModalProps {
  url: string
  type: 'image' | 'video'
  onClose: () => void
}

export function MediaPreviewModal({ url, type, onClose }: MediaPreviewModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      <div onClick={(e) => e.stopPropagation()}>
        {type === 'image' ? (
          <img
            src={url}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[90vh]"
          />
        )}
      </div>
    </div>
  )
}
