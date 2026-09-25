'use client'

interface CategoryBadgeProps {
  category: string
  size?: 'sm' | 'md'
}

const STYLES: Record<string, { cls: string; label: string }> = {
  urgent:           { cls: 'bg-red/20 text-red border-red/30',          label: 'URGENT' },
  emergency:        { cls: 'bg-red/20 text-red border-red/30',          label: 'EMERGENCY' },
  action_required:  { cls: 'bg-blue/20 text-blue border-blue/30',       label: 'ACTION REQ' },
  standard:         { cls: 'bg-blue/20 text-blue border-blue/30',       label: 'STANDARD' },
  routine:          { cls: 'bg-surface2 text-muted border-border',      label: 'ROUTINE' },
  cosmetic:         { cls: 'bg-surface2 text-muted border-border',      label: 'COSMETIC' },
  defer:            { cls: 'bg-surface2 text-muted border-border',      label: 'DEFER' },
  info_request:     { cls: 'bg-surface2 text-muted border-border',      label: 'INFO REQ' },
  escalate:         { cls: 'bg-accent/20 text-accent border-accent/30', label: 'ESCALATE' },
  ambiguous:        { cls: 'bg-accent/10 text-accent border-accent/20', label: 'AMBIGUOUS' },
}

export default function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const key = category.toLowerCase()
  const { cls, label } = STYLES[key] ?? { cls: 'bg-surface2 text-muted border-border', label: category.toUpperCase() }
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'

  return (
    <span className={`inline-flex items-center font-mono font-semibold tracking-wider rounded border ${pad} ${cls}`}>
      {label}
    </span>
  )
}
