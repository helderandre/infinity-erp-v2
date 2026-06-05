"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { EmailEditorComponent } from "@/components/email-editor/email-editor"
import { WppTemplateBuilder } from "@/components/automations/wpp-template-builder"
import { normalizeCategory, type TemplateCategory } from "@/lib/constants-template-categories"
import type {
  WhatsAppTemplateMessage,
  WhatsAppTemplateCategory,
} from "@/lib/types/whatsapp-template"

/**
 * Editor de template inline — abre em Dialog full-screen dentro do sheet
 * de automatismo. Substitui a navegação para `/dashboard/templates-email/novo`
 * e `/dashboard/automacao/templates-wpp/editor` com os mesmos query params.
 *
 * Uso:
 *   <InlineTemplateEditorDialog
 *     channel="email"
 *     category={eventType}
 *     scope="consultant"
 *     open={open}
 *     onOpenChange={setOpen}
 *     onCreated={handleRefresh}
 *   />
 */

const FULLSCREEN_CLASS =
  "max-w-none w-screen h-[100dvh] max-h-[100dvh] rounded-none p-0 top-0 left-0 translate-x-0 translate-y-0 border-0 shadow-none overflow-hidden flex flex-col"

interface BaseProps {
  scope?: "consultant" | "global"
  category?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado após criação bem-sucedida — recebe o id do template criado. */
  onCreated?: (templateId: string) => void
}

interface Props extends BaseProps {
  channel: "email" | "whatsapp"
}

export function InlineTemplateEditorDialog(props: Props) {
  if (props.channel === "email") return <InlineEmailEditorDialog {...props} />
  return <InlineWppEditorDialog {...props} />
}

// ─── Email ───────────────────────────────────────────────────────────

function InlineEmailEditorDialog({
  scope,
  category,
  open,
  onOpenChange,
  onCreated,
}: BaseProps) {
  const handleAfterSave = useCallback(
    (id: string) => {
      onCreated?.(id)
      onOpenChange(false)
    },
    [onCreated, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FULLSCREEN_CLASS} showCloseButton={false}>
        <DialogTitle className="sr-only">Novo template de email</DialogTitle>
        {open && (
          <EmailEditorComponent
            initialData={null}
            templateId={null}
            initialName=""
            initialSubject=""
            initialDescription=""
            initialCategory={normalizeCategory(category ?? null) as TemplateCategory}
            initialScope={scope}
            initialMode="standard"
            onAfterSave={handleAfterSave}
            onBack={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── WhatsApp ────────────────────────────────────────────────────────

function InlineWppEditorDialog({
  scope,
  category,
  open,
  onOpenChange,
  onCreated,
}: BaseProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [cat, setCat] = useState<WhatsAppTemplateCategory>(
    (category as WhatsAppTemplateCategory) || "outro",
  )
  const [messages, setMessages] = useState<WhatsAppTemplateMessage[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Reset local state whenever the dialog opens with a new context.
  const resetOnOpen = useCallback(() => {
    setName("")
    setDescription("")
    setCat((category as WhatsAppTemplateCategory) || "outro")
    setMessages([])
    setTags([])
  }, [category])

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("O nome do template é obrigatório")
      return
    }
    if (messages.length === 0) {
      toast.error("Adicione pelo menos uma mensagem")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/automacao/templates-wpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          messages,
          category: cat,
          tags,
          scope,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      toast.success("Template criado com sucesso")
      onCreated?.(created.id)
      onOpenChange(false)
    } catch {
      toast.error("Erro ao guardar template")
    } finally {
      setSaving(false)
    }
  }, [cat, description, messages, name, onCreated, onOpenChange, scope, tags])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) resetOnOpen()
        onOpenChange(o)
      }}
    >
      <DialogContent className={FULLSCREEN_CLASS} showCloseButton={false}>
        <DialogTitle className="sr-only">Novo template de WhatsApp</DialogTitle>
        {open && (
          <WppTemplateBuilder
            name={name}
            description={description}
            category={cat}
            messages={messages}
            tags={tags}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onCategoryChange={setCat}
            onMessagesChange={setMessages}
            onTagsChange={setTags}
            onSave={handleSave}
            saving={saving}
            isEditing={false}
            scope={scope}
            onBack={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
