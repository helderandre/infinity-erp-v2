import type { Metadata } from 'next'
import Image from 'next/image'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Entrar | Infinity Parceiros',
  description: 'Aceda ao portal de parceiros da Infinity Group',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <Image src="/logo.png" alt="Infinity" width={30} height={30} className="rounded-md" />
          </span>
        </div>
        {children}
      </div>
      <Toaster position="top-right" richColors />
    </div>
  )
}
