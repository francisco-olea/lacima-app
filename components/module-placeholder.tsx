import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <Card className="p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <p className="mt-8 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          Muy pronto.
        </p>
      </Card>
    </div>
  )
}
