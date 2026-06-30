"use client";

import { DarkModeProvider } from "@/app/context/DarkModeContext";
import { Toaster } from "@/app/components/ui/sonner";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <DarkModeProvider>
      {children}
      <Toaster />
    </DarkModeProvider>
  );
}
