'use client'
import { type ReactNode } from 'react'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
} from 'fumadocs-ui/components/ui/tabs'

function escapeValue(item: string) {
  return item.toLowerCase().replace(/\s+/g, '-')
}

interface DocTabsProps extends Omit<TabsProps, 'children'> {
  items: string[]
  persist?: boolean
  groupId?: string
  children: ReactNode
}

export function DocTabs({ items, children, className, ...props }: DocTabsProps) {
  return (
    <Tabs
      defaultValue={escapeValue(items[0])}
      className={`flex flex-col overflow-hidden rounded-xl border bg-fd-secondary my-4 ${className ?? ''}`}
      {...props}
    >
      <TabsList className="flex gap-3.5 text-fd-secondary-foreground overflow-x-auto px-4 not-prose border-b border-fd-border">
        {items.map((item) => (
          <TabsTrigger
            key={item}
            value={escapeValue(item)}
            className="inline-flex items-center gap-2 whitespace-nowrap text-fd-muted-foreground border-b border-transparent py-2 text-sm font-medium transition-colors hover:text-fd-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-fd-primary data-[state=active]:text-fd-primary"
          >
            {item}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}

interface DocTabProps {
  value: string
  children: ReactNode
  className?: string
}

export function DocTab({ value, children, className }: DocTabProps) {
  return (
    <TabsContent
      value={escapeValue(value)}
      className={`p-4 text-[0.9375rem] bg-fd-background rounded-b-xl outline-none prose-no-margin [&>figure:only-child]:-m-4 [&>figure:only-child]:border-none ${className ?? ''}`}
    >
      {children}
    </TabsContent>
  )
}
