"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getFormFields,
  updateFormField,
  reorderFormFields,
  type FormFieldConfig,
} from "@/app/dashboard/recrutamento/actions"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const SECTION_LABELS: Record<string, string> = {
  documento: "Documento de Identificacao",
  dados_pessoais: "Dados Pessoais",
  contactos: "Contactos",
  email_profissional: "Email Profissional",
  experiencia: "Experiencia",
  redes_sociais: "Redes Sociais",
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  email: "Email",
  tel: "Telefone",
  date: "Data",
  select: "Seleccao",
  toggle: "Toggle",
  file: "Ficheiro",
}

export function FormEditorTab() {
  const [fields, setFields] = useState<FormFieldConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingField, setEditingField] = useState<FormFieldConfig | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editPlaceholder, setEditPlaceholder] = useState("")
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const fetchFields = useCallback(async () => {
    setLoading(true)
    const { fields: data, error } = await getFormFields()
    if (error) toast.error("Erro ao carregar campos do formulario")
    else setFields(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  // Group fields by section
  const sections = fields.reduce<Record<string, FormFieldConfig[]>>(
    (acc, field) => {
      if (!acc[field.section]) acc[field.section] = []
      acc[field.section].push(field)
      return acc
    },
    {}
  )

  const handleToggleVisible = useCallback(
    async (field: FormFieldConfig) => {
      const newVal = !field.is_visible
      setFields((prev) =>
        prev.map((f) =>
          f.id === field.id ? { ...f, is_visible: newVal } : f
        )
      )
      const { error } = await updateFormField(field.id, {
        is_visible: newVal,
      })
      if (error) {
        toast.error("Erro ao actualizar campo")
        setFields((prev) =>
          prev.map((f) =>
            f.id === field.id ? { ...f, is_visible: !newVal } : f
          )
        )
      }
    },
    []
  )

  const handleToggleRequired = useCallback(
    async (field: FormFieldConfig) => {
      const newVal = !field.is_required
      setFields((prev) =>
        prev.map((f) =>
          f.id === field.id ? { ...f, is_required: newVal } : f
        )
      )
      const { error } = await updateFormField(field.id, {
        is_required: newVal,
      })
      if (error) {
        toast.error("Erro ao actualizar campo")
        setFields((prev) =>
          prev.map((f) =>
            f.id === field.id ? { ...f, is_required: !newVal } : f
          )
        )
      }
    },
    []
  )

  const handleSaveEdit = useCallback(async () => {
    if (!editingField) return
    setSaving(true)
    const { error } = await updateFormField(editingField.id, {
      label: editLabel,
      placeholder: editPlaceholder || null,
    })
    setSaving(false)

    if (error) {
      toast.error("Erro ao guardar alteracoes")
    } else {
      toast.success("Campo actualizado")
      setFields((prev) =>
        prev.map((f) =>
          f.id === editingField.id
            ? { ...f, label: editLabel, placeholder: editPlaceholder || null }
            : f
        )
      )
      setEditingField(null)
    }
  }, [editingField, editLabel, editPlaceholder])

  // Simple drag reorder within section
  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault()
      if (id !== draggedId) setDragOverId(id)
    },
    [draggedId]
  )

  const handleDrop = useCallback(
    async (targetId: string) => {
      if (!draggedId || draggedId === targetId) {
        setDraggedId(null)
        setDragOverId(null)
        return
      }

      const draggedField = fields.find((f) => f.id === draggedId)
      const targetField = fields.find((f) => f.id === targetId)
      if (!draggedField || !targetField) return
      if (draggedField.section !== targetField.section) return

      const sectionFields = fields
        .filter((f) => f.section === draggedField.section)
        .sort((a, b) => a.order_index - b.order_index)

      const dragIdx = sectionFields.findIndex((f) => f.id === draggedId)
      const targetIdx = sectionFields.findIndex((f) => f.id === targetId)

      const reordered = [...sectionFields]
      const [removed] = reordered.splice(dragIdx, 1)
      reordered.splice(targetIdx, 0, removed)

      const updates = reordered.map((f, i) => ({
        id: f.id,
        order_index: i,
      }))

      // Optimistic update
      setFields((prev) => {
        const updated = [...prev]
        updates.forEach((u) => {
          const idx = updated.findIndex((f) => f.id === u.id)
          if (idx >= 0) updated[idx] = { ...updated[idx], order_index: u.order_index }
        })
        return updated.sort((a, b) => a.order_index - b.order_index)
      })

      setDraggedId(null)
      setDragOverId(null)

      const { error } = await reorderFormFields(updates)
      if (error) {
        toast.error("Erro ao reordenar campos")
        fetchFields()
      }
    },
    [draggedId, fields, fetchFields]
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Configure os campos do formulario de entrada. Pode activar/desactivar campos,
        torná-los obrigatorios, editar labels e reordenar dentro de cada seccao.
      </p>

      {Object.entries(sections).map(([section, sectionFields]) => (
        <Card key={section}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {SECTION_LABELS[section] || section}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              {sectionFields
                .sort((a, b) => a.order_index - b.order_index)
                .map((field) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => handleDragStart(field.id)}
                    onDragOver={(e) => handleDragOver(e, field.id)}
                    onDrop={() => handleDrop(field.id)}
                    onDragEnd={() => {
                      setDraggedId(null)
                      setDragOverId(null)
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      draggedId === field.id && "opacity-50",
                      dragOverId === field.id &&
                        "border-primary bg-primary/5",
                      !field.is_visible && "opacity-60 bg-muted/50"
                    )}
                  >
                    <GripVertical className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {field.label}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {FIELD_TYPE_LABELS[field.field_type] ||
                            field.field_type}
                        </Badge>
                        {field.is_ai_extractable && (
                          <Sparkles className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {field.field_key}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Required toggle */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-xs">
                          Obrigatorio
                        </span>
                        <Switch
                          checked={field.is_required}
                          onCheckedChange={() => handleToggleRequired(field)}
                          className="scale-75"
                        />
                      </div>

                      {/* Visible toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleVisible(field)}
                      >
                        {field.is_visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="text-muted-foreground h-4 w-4" />
                        )}
                      </Button>

                      {/* Edit button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingField(field)
                          setEditLabel(field.label)
                          setEditPlaceholder(field.placeholder || "")
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Edit Field Dialog */}
      <Dialog
        open={!!editingField}
        onOpenChange={(o) => {
          if (!o) setEditingField(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Campo</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Chave do Campo</Label>
              <Input value={editingField?.field_key || ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-label">Label</Label>
              <Input
                id="edit-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-placeholder">Placeholder</Label>
              <Input
                id="edit-placeholder"
                value={editPlaceholder}
                onChange={(e) => setEditPlaceholder(e.target.value)}
                placeholder="Texto de placeholder..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingField(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
