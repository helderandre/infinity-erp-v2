'use client'

import { type LucideIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export interface PageSidebarItem {
  key: string
  label: string
  icon: LucideIcon
  bg?: string
  text?: string
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
    <Sidebar
      collapsible="none"
      className={cn(
        'w-52 shrink-0 border-r bg-sidebar/50 h-full rounded-bl-xl overflow-hidden',
        className
      )}
    >
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon
                const isActive = activeKey === item.key
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSelect(item.key)}
                      className={cn(
                        'cursor-pointer',
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
  )
}
