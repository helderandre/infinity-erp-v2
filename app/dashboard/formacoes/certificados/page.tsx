'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Award, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { CertificateCard } from '@/components/training/certificate-card'
import type { TrainingCertificate } from '@/types/training'

export default function CertificadosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CertificadosContent />
    </Suspense>
  )
}

function CertificadosContent() {
  const [tab, setTab] = useState('all')
  const [certificates, setCertificates] = useState<TrainingCertificate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCertificates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/training/my-certificates')
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      setCertificates(data.data || [])
    } catch {
      setCertificates([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchCertificates() }, [fetchCertificates])

  const filtered = tab === 'all' ? certificates
    : tab === 'internal' ? certificates.filter(c => !c.is_external)
    : certificates.filter(c => c.is_external)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/formacoes"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Os Meus Certificados</h1>
          <p className="text-muted-foreground">Certificados obtidos em formações</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Todos ({certificates.length})</TabsTrigger>
          <TabsTrigger value="internal">Internos ({certificates.filter(c => !c.is_external).length})</TabsTrigger>
          <TabsTrigger value="external">Externos ({certificates.filter(c => c.is_external).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Award className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Ainda não tem certificados</h3>
              <p className="text-sm text-muted-foreground mt-1">Complete formações para obtê-los.</p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard/formacoes">Explorar Formações</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(cert => (
                <CertificateCard key={cert.id} certificate={cert} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
