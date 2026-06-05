'use client'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'

interface LessonPdfViewerProps {
  pdfUrl: string
  title: string
  onComplete?: () => void
}

export function LessonPdfViewer({ pdfUrl, title }: LessonPdfViewerProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <FileText className="h-5 w-5 text-red-500" />
          <h3 className="font-medium">{title}</h3>
        </div>
        <div className="h-[70vh] w-full">
          <iframe
            src={pdfUrl}
            className="h-full w-full"
            title={title}
          />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-end border-t px-4 py-3">
        <Button variant="outline" size="sm" asChild>
          <a href={pdfUrl} download target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Descarregar PDF
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}
