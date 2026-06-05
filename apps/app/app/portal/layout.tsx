'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Building2, FileStack, MessageCircle, User, Bell } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/portal', label: 'Inicio', icon: Home },
  { href: '/portal/imoveis', label: 'Imoveis', icon: Building2 },
  { href: '/portal/processo', label: 'Processo', icon: FileStack },
  { href: '/portal/mensagens', label: 'Mensagens', icon: MessageCircle },
  { href: '/portal/perfil', label: 'Perfil', icon: User },
] as const

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Don't show chrome on login page
  if (pathname === '/portal/login') {
    return <>{children}</>
  }

  function isActive(href: string) {
    if (href === '/portal') return pathname === '/portal'
    return pathname?.startsWith(href)
  }

  return (
    <div className="min-h-svh flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between h-14 border-b bg-background px-4">
        <span className="font-semibold text-sm tracking-tight">Infinity Group</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-4 w-4" />
          </Button>
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">CL</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex items-center justify-around h-16 safe-area-pb">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
