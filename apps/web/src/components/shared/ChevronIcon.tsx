import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

/** Right-pointing chevron that turns down when expanded. */
export function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <HugeiconsIcon
      icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
      size={12}
      color="currentColor"
      strokeWidth={1.5}
    />
  )
}
