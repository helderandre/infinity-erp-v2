'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, FileText } from 'lucide-react'

interface LessonTextContentProps {
  content: string
  title: string
  onComplete?: () => void
}

export function LessonTextContent({ content, title, onComplete }: LessonTextContentProps) {
  const [isMarkedRead, setIsMarkedRead] = useState(false)

  function handleMarkAsRead() {
    setIsMarkedRead(true)
    onComplete?.()
  }

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
      <CardFooter className="flex items-center justify-end border-t px-4 py-3">
        <Button
          size="sm"
          onClick={handleMarkAsRead}
          disabled={isMarkedRead}
          variant={isMarkedRead ? 'outline' : 'default'}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {isMarkedRead ? 'Marcado como Lido' : 'Marcar como Lido'}
        </Button>
      </CardFooter>
    </Card>
  )
}
