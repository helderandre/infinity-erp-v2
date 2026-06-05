'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Award, Download, Calendar, Building2, Hash } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { TrainingCertificate } from '@/types/training'

interface CertificateCardProps {
  certificate: TrainingCertificate
  onClick?: () => void
}

export function CertificateCard({
  certificate,
  onClick,
}: CertificateCardProps) {
  const isExpired =
    !certificate.is_valid ||
    (certificate.expires_at && new Date(certificate.expires_at) < new Date())

  const title = certificate.is_external
    ? certificate.external_title || certificate.title
    : certificate.title

  const subtitle = certificate.is_external
    ? certificate.external_provider
    : certificate.course?.title

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isExpired ? 'opacity-75' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="flex gap-4 p-4">
        {/* Icon */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
            isExpired
              ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-600'
          }`}
        >
          <Award className="h-6 w-6" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold leading-tight">{title}</h3>
              {subtitle && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {certificate.is_external ? (
                    <Building2 className="h-3 w-3" />
                  ) : null}
                  {subtitle}
                </p>
              )}
            </div>
            <Badge variant={isExpired ? 'destructive' : 'default'}>
              {isExpired ? 'Expirado' : 'Valido'}
            </Badge>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Emitido:{' '}
              {format(new Date(certificate.issued_at), "d 'de' MMM yyyy", {
                locale: pt,
              })}
            </span>
            {certificate.expires_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Expira:{' '}
                {format(
                  new Date(certificate.expires_at),
                  "d 'de' MMM yyyy",
                  { locale: pt }
                )}
              </span>
            )}
          </div>

          {/* Certificate code + download */}
          <div className="flex items-center justify-between pt-1">
            {certificate.certificate_code && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                {certificate.certificate_code}
              </span>
            )}
            {certificate.pdf_url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(certificate.pdf_url!, '_blank')
                }}
              >
                <Download className="h-3 w-3" />
                Descarregar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
