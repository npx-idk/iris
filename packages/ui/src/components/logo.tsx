import { cn } from "@iris/ui/lib/utils"

const PETAL = "M12 1.5 C16.2 4.8 16.2 8.2 12 10 C7.8 8.2 7.8 4.8 12 1.5 Z"

/**
 * The Iris mark: a six-petal iris bloom around a pupil — the flower and the
 * eye in one. Renders at any size via className; adapts via currentColor.
 */
export function IrisMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <g fill="currentColor">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path key={deg} d={PETAL} transform={`rotate(${deg} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="1.7" />
      </g>
    </svg>
  )
}

/** Brand lockup: the mark alone, or mark + "Iris" wordmark. */
export function Logo({
  variant = "full",
  className,
  markClassName,
}: {
  variant?: "mark" | "full"
  className?: string
  markClassName?: string
}) {
  if (variant === "mark")
    return <IrisMark className={cn(markClassName, className)} />
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <IrisMark className={markClassName} />
      <span className="text-base font-semibold tracking-tight text-foreground">
        Iris
      </span>
    </span>
  )
}
