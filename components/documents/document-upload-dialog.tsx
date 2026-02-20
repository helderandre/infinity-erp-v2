'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DocumentUploader } from './document-uploader'
import type { DocType, UploadResult } from '@/types/document'

interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId?: string
  ownerId?: string
  onUploaded: (result: UploadResult) => void
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  propertyId,
  ownerId,
  onUploaded,
}: DocumentUploadDialogProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null)
  const [validUntil, setValidUntil] = useState('')

  useEffect(() => {
    if (open && docTypes.length === 0) {
      fetch('/api/libraries/doc-types')
        .then((res) => res.json())
        .then((data) => setDocTypes(data))
        .catch(() => setDocTypes([]))
    }
  }, [open, docTypes.length])

  useEffect(() => {
    if (!open) {
      setSelectedDocType(null)
      setValidUntil('')
    }
  }, [open])

  // Agrupar por categoria
  const byCategory = docTypes.reduce<Record<string, DocType[]>>((acc, dt) => {
    const cat = dt.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  const handleUploaded = (result: UploadResult) => {
    onUploaded(result)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carregar Documento</DialogTitle>
          <DialogDescription>
            Seleccione o tipo de documento e carregue o ficheiro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de documento */}
          <div className="space-y-2">
            <Label>Tipo de Documento *</Label>
            <Select
              value={selectedDocType?.id || ''}
              onValueChange={(id) => {
                const dt = docTypes.find((d) => d.id === id)
                setSelectedDocType(dt || null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(byCategory).map(([category, types]) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {types.map((dt) => (
                      <SelectItem key={dt.id} value={dt.id}>
                        {dt.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Validade */}
          <div className="space-y-2">
            <Label>Valido ate (opcional)</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          {/* Upload — visivel apenas apos seleccionar tipo */}
          {selectedDocType && (
            <DocumentUploader
              docTypeId={selectedDocType.id}
              allowedExtensions={selectedDocType.allowed_extensions}
              propertyId={propertyId}
              ownerId={ownerId}
              validUntil={validUntil || undefined}
              onUploaded={handleUploaded}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
