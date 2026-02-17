import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login | ERP Infinity',
  description: 'Aceda à sua conta do ERP Infinity',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
