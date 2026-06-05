'use client'

// Providers required by the main-app CRM components we mount in the partner app
// (imported from @/ === apps/app). Mirrors apps/app root + dashboard layouts.
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { EmailComposerProvider } from '@/hooks/use-email-composer'
import { BreadcrumbOverrideProvider } from '@/hooks/use-breadcrumb-overrides'
import { PreviousPathnameProvider } from '@/hooks/use-previous-pathname'

export function CrmProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <PreviousPathnameProvider>
          <BreadcrumbOverrideProvider>
            <EmailComposerProvider>
              {children}
              <Toaster position="top-right" richColors />
            </EmailComposerProvider>
          </BreadcrumbOverrideProvider>
        </PreviousPathnameProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
