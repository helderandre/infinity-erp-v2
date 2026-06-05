import { Suspense } from 'react'
import { RecursosBrowser } from '@/components/marketing/recursos/recursos-browser'
import { Skeleton } from '@/components/ui/skeleton'

export const dynamic = 'force-dynamic'

export default function MarketingRecursosPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Suspense fallback={<RecursosFallback />}>
        <RecursosBrowser />
      </Suspense>
    </div>
  )
}

function RecursosFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-6 w-64" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  )
}
