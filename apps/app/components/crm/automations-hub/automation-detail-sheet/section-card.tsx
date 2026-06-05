"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Props {
  title: string
  action?: ReactNode
  className?: string
  titleClassName?: string
  children: ReactNode
}

export function SectionCard({ title, action, className, titleClassName, children }: Props) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card/60 shadow-sm px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className={cn("text-sm font-semibold tracking-tight", titleClassName)}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
