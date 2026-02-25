'use client'

import { useState } from 'react'
import { Editor, Frame, Element } from '@craftjs/core'
import { Layers } from '@craftjs/layers'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import { EmailContainer } from './user/email-container'
import { EmailText } from './user/email-text'
import { EmailHeading } from './user/email-heading'
import { EmailImage } from './user/email-image'
import { EmailButton } from './user/email-button'
import { EmailDivider } from './user/email-divider'
import { EmailSpacer } from './user/email-spacer'
import { EmailAttachment } from './user/email-attachment'

import { RenderNode } from './email-render-node'
import { EmailToolbox } from './email-toolbox'
import { EmailSettingsPanel } from './email-settings-panel'
import { EmailTopbar } from './email-topbar'
import { EmailLayer } from './email-layer'

const resolver = {
  EmailContainer,
  EmailText,
  EmailHeading,
  EmailImage,
  EmailButton,
  EmailDivider,
  EmailSpacer,
  EmailAttachment,
}

interface EmailEditorProps {
  initialData: string | null
  templateId: string | null
  initialName: string
  initialSubject: string
  initialDescription: string
}

function RightSidebar() {
  return (
    <Tabs defaultValue="properties" className="w-72 shrink-0 border-l flex flex-col overflow-hidden">
      <TabsList className="w-full rounded-none border-b">
        <TabsTrigger value="properties" className="flex-1">Propriedades</TabsTrigger>
        <TabsTrigger value="layers" className="flex-1">Camadas</TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="mt-0 flex-1 overflow-auto">
        <EmailSettingsPanel />
      </TabsContent>
      <TabsContent value="layers" className="mt-0 flex-1 overflow-auto">
        <Layers expandRootOnLoad renderLayer={EmailLayer} />
      </TabsContent>
    </Tabs>
  )
}

export function EmailEditorComponent({
  initialData,
  templateId,
  initialName,
  initialSubject,
  initialDescription,
}: EmailEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [subject, setSubject] = useState(initialSubject)
  const [description] = useState(initialDescription)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (editorState: string) => {
    if (!name.trim()) {
      toast.error('O nome do template é obrigatório')
      return
    }
    if (!subject.trim()) {
      toast.error('O assunto do email é obrigatório')
      return
    }

    setIsSaving(true)
    try {
      const body = {
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim() || undefined,
        body_html: `<!-- craft.js template: ${name} -->`,
        editor_state: JSON.parse(editorState),
      }

      if (templateId) {
        const res = await fetch(`/api/libraries/emails/${templateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Erro ao guardar template')
        toast.success('Template guardado com sucesso')
      } else {
        const res = await fetch('/api/libraries/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Erro ao criar template')
        const data = await res.json()
        toast.success('Template criado com sucesso')
        router.push(`/dashboard/templates-email/${data.id}`)
      }
    } catch (error) {
      console.error('Erro ao guardar template:', error)
      toast.error('Erro ao guardar template')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col -m-4 md:-m-6 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] overflow-hidden">
      <Editor resolver={resolver} onRender={RenderNode}>
        <EmailTopbar
          name={name}
          subject={subject}
          onNameChange={setName}
          onSubjectChange={setSubject}
          onSave={handleSave}
          isSaving={isSaving}
        />
        <div className="flex flex-1 overflow-hidden">
          <EmailToolbox />
          <div className="flex-1 overflow-auto bg-muted/30 p-8">
            <div className="mx-auto" style={{ maxWidth: 620 }}>
              <Frame data={initialData || undefined}>
                <Element
                  is={EmailContainer}
                  canvas
                  padding={20}
                  background="#ffffff"
                >
                  <EmailText text="Edite o seu template aqui" />
                </Element>
              </Frame>
            </div>
          </div>
          <RightSidebar />
        </div>
      </Editor>
    </div>
  )
}
