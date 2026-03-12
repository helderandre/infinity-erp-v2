"use client"

import { useState } from "react"
import {
  FileText,
  Settings2,
  Eye,
  ExternalLink,
} from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { SubmissionsTab } from "@/components/recrutamento/submissions-tab"
import { FormEditorTab } from "@/components/recrutamento/form-editor-tab"

export default function FormularioPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Formulário de Entrada
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestão de submissões e configuração do formulário de novos consultores
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <a href="/entryform" target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" />
            Ver Formulário
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList>
          <TabsTrigger value="submissions" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Submissões
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            Editor de Campos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-4">
          <SubmissionsTab />
        </TabsContent>

        <TabsContent value="editor" className="mt-4">
          <FormEditorTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
