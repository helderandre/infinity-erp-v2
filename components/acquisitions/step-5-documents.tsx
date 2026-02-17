'use client'

import { UseFormReturn } from 'react-hook-form'
import { Card, CardContent } from '@/components/ui/card'
import { FileText } from 'lucide-react'

interface StepDocumentsProps {
  form: UseFormReturn<any>
}

export function StepDocuments({ form }: StepDocumentsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Documentos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O upload de documentos é opcional nesta fase. Pode adicionar documentos
          depois da criação do processo.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground text-center">
            Upload de documentos será implementado numa versão futura
          </p>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Por agora, pode carregar documentos na página do processo após a criação
          </p>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="text-sm font-medium mb-2">Documentos sugeridos:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Caderneta Predial</li>
          <li>• Certificado Energético</li>
          <li>• Documento de Identificação do Proprietário</li>
          <li>• CMI (Contrato de Mediação Imobiliária)</li>
          <li>• Certidão Permanente (se pessoa colectiva)</li>
        </ul>
      </div>
    </div>
  )
}
