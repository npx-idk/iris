'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, type Transition } from 'motion/react'
import { useActiveRuns } from '@/hooks/useActiveRuns'
import { ROUTES } from '@/lib/routes'
import type { ActiveRun } from '@/lib/types'

const springTransition: Transition = { type: 'spring', stiffness: 300, damping: 26 }
const textTransition: Transition = { duration: 0.22, ease: 'easeInOut' }

const getCardVariants = (i: number) => ({
  collapsed: { marginTop: i === 0 ? 0 : -40, scaleX: 1 - i * 0.05 },
  expanded: { marginTop: i === 0 ? 0 : 4, scaleX: 1 },
})

const labelVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' as const },
  expanded: { opacity: 0, y: -12, pointerEvents: 'none' as const },
}

const linkVariants = {
  collapsed: { opacity: 0, y: 12, pointerEvents: 'none' as const },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' as const },
}

function RunCard({ run, i }: { run: ActiveRun; i: number }) {
  const isRunning = run.status === 'RUNNING'
  return (
    <motion.div
      className="bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow duration-200 relative"
      variants={getCardVariants(i)}
      transition={springTransition}
      style={{ zIndex: 4 - i }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-card-foreground truncate">{run.test.name}</p>
        {isRunning && (
          <span className="shrink-0 size-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">{run.test.project.name}</p>
    </motion.div>
  )
}

export function ActiveRunsNotification() {
  const pathname = usePathname()
  const runs = useActiveRuns()

  if (pathname === ROUTES.runs || runs.length === 0) return null

  const visible = runs.slice(0, 4)
  const runningCount = runs.filter((r) => r.status === 'RUNNING').length
  const queuedCount = runs.filter((r) => r.status === 'QUEUED').length

  const label = [
    runningCount > 0 && `${runningCount} running`,
    queuedCount > 0 && `${queuedCount} queued`,
  ].filter(Boolean).join(', ')

  return (
    <motion.div
      className="fixed bottom-5 right-5 z-50 w-64 space-y-2"
      initial="collapsed"
      whileHover="expanded"
    >
      <div>
        {visible.map((run, i) => (
          <RunCard key={run.id} run={run} i={i} />
        ))}
      </div>

      <div className="flex items-center gap-2 px-1">
        <div className="size-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium shrink-0">
          {runs.length}
        </div>
        <span className="grid text-xs">
          <motion.span
            className="text-muted-foreground row-start-1 col-start-1"
            variants={labelVariants}
            transition={textTransition}
          >
            {label}
          </motion.span>
          <motion.span
            className="row-start-1 col-start-1"
            variants={linkVariants}
            transition={textTransition}
          >
            <Link href={ROUTES.runs} className="text-foreground font-medium hover:underline">
              View all runs →
            </Link>
          </motion.span>
        </span>
      </div>
    </motion.div>
  )
}
