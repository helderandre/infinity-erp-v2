import { MessageCircle } from 'lucide-react'

export function EmptyChatState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
      <div className="rounded-full bg-muted p-6 mb-4">
        <MessageCircle className="h-12 w-12" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">WhatsApp Web</h2>
      <p className="mt-1 text-sm">Seleccione uma conversa para começar</p>
    </div>
  )
}
