'use client'

import { useState } from 'react'
import { type LucideIcon, ChevronDown } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface PageSidebarSubItem {
  key: string
  label: string
  badge?: string
}

export interface PageSidebarItem {
  key: string
  label: string
  icon: LucideIcon
  bg?: string
  text?: string
  disabled?: boolean
  subItems?: PageSidebarSubItem[]
}

export interface PageSidebarAction {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
}

interface PageSidebarProps {
  items: PageSidebarItem[]
  activeKey: string
  onSelect: (key: string) => void
  actions?: PageSidebarAction[]
  actionsLabel?: string
  className?: string
}

export function PageSidebar({
  items,
  activeKey,
  onSelect,
  actions,
  actionsLabel = 'Acções',
  className,
}: PageSidebarProps) {
  return (
    <>
      {/* Mobile: horizontal scrollable tabs */}
      <div className={cn("md:hidden border-b overflow-x-auto scrollbar-none", className)}>
        <div className="flex items-center gap-1 px-3 py-2 min-w-max">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeKey === item.key ||
              item.subItems?.some(sub => activeKey === sub.key)
            const isDisabled = item.disabled === true
            return (
              <button
                key={item.key}
                onClick={() => !isDisabled && onSelect(item.key)}
                disabled={isDisabled}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:bg-muted/50',
                  isDisabled && 'opacity-40 cursor-not-allowed',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
          {actions?.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                onClick={action.onClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:bg-muted/50 shrink-0"
              >
                <Icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Desktop: vertical sidebar */}
      <Sidebar
        collapsible="none"
        className={cn(
          'hidden md:flex w-52 shrink-0 border-r bg-sidebar/50 h-full rounded-bl-xl overflow-hidden',
          className
        )}
      >
        <SidebarContent className="py-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const hasSubItems = item.subItems && item.subItems.length > 0
                  if (hasSubItems) {
                    return (
                      <CollapsibleSidebarItem
                        key={item.key}
                        item={item}
                        activeKey={activeKey}
                        onSelect={onSelect}
                      />
                    )
                  }

                  const Icon = item.icon
                  const isActive = activeKey === item.key
                  const isDisabled = item.disabled === true
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => !isDisabled && onSelect(item.key)}
                        className={cn(
                          isDisabled
                            ? 'cursor-not-allowed opacity-40'
                            : 'cursor-pointer',
                          isActive && item.bg && item.text && `${item.bg} ${item.text} hover:${item.bg}`
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {actions && actions.length > 0 && (
            <>
              <SidebarSeparator className="mx-0" />

              <SidebarGroup>
                <SidebarGroupLabel>{actionsLabel}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {actions.map((action) => {
                      const Icon = action.icon
                      return (
                        <SidebarMenuItem key={action.key}>
                          <SidebarMenuButton
                            onClick={action.onClick}
                            className="cursor-pointer"
                          >
                            <Icon className="h-4 w-4" />
                            <span>{action.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>
      </Sidebar>
    </>
  )
}

function CollapsibleSidebarItem({
  item,
  activeKey,
  onSelect,
}: {
  item: PageSidebarItem
  activeKey: string
  onSelect: (key: string) => void
}) {
  const Icon = item.icon
  const isDisabled = item.disabled === true
  const isParentActive = activeKey === item.key
  const isChildActive = item.subItems?.some((sub) => activeKey === sub.key) ?? false
  const isAnyActive = isParentActive || isChildActive

  // Auto-open when a child or the parent is active
  const [open, setOpen] = useState(isAnyActive)

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isParentActive}
            onClick={() => {
              if (isDisabled) return
              onSelect(item.key)
              if (!open) setOpen(true)
            }}
            className={cn(
              isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
            <ChevronDown className={cn(
              'ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.subItems?.map((sub) => {
              const isSubActive = activeKey === sub.key
              return (
                <SidebarMenuSubItem key={sub.key}>
                  <SidebarMenuSubButton
                    isActive={isSubActive}
                    onClick={() => !isDisabled && onSelect(sub.key)}
                    className={cn(
                      isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                    )}
                  >
                    <span className="truncate">{sub.label}</span>
                    {sub.badge && (
                      <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary-foreground">
                        {sub.badge}
                      </span>
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
