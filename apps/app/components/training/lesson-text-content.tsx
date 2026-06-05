'use client'

import { Card, CardContent } from '@/components/ui/card'
import { FileText } from 'lucide-react'

interface LessonTextContentProps {
  content: string
  title: string
  onComplete?: () => void
}

export function LessonTextContent({ content, title }: LessonTextContentProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <FileText className="h-5 w-5 text-blue-500" />
          <h3 className="font-medium">{title}</h3>
        </div>
        <div className="px-6 py-5">
          <div
            className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-img:rounded-lg"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
