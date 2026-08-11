import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  features,
}: {
  icon: LucideIcon
  title: string
  description: string
  features: string[]
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

        <div className="mt-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Funciones planeadas
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                <span className="size-1.5 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          Muy pronto.
        </p>
      </Card>
    </div>
  )
}
