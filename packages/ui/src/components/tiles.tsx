"use client"

import React from "react"
import { motion } from "motion/react"
import { cn } from "@iris/ui/lib/utils"

interface TilesProps {
  className?: string
  rows?: number
  cols?: number
  tileClassName?: string
  tileSize?: "sm" | "md" | "lg"
}

const tileSizes = {
  sm: "w-8 h-8",
  md: "w-9 h-9 md:w-12 md:h-12",
  lg: "w-12 h-12 md:w-16 md:h-16",
}

/**
 * Decorative grid of tiles that highlight (via the `--tile` token) on hover.
 * Adapted from https://21st.dev/r/lukacho/tiles to use `motion/react` and
 * the design-token borders instead of hardcoded neutrals.
 */
export function Tiles({
  className,
  rows = 100,
  cols = 10,
  tileClassName,
  tileSize = "md",
}: TilesProps) {
  const rowsArray = new Array(rows).fill(1)
  const colsArray = new Array(cols).fill(1)

  return (
    <div
      className={cn(
        "relative z-0 flex h-full w-full justify-center",
        className
      )}
    >
      {rowsArray.map((_, i) => (
        <motion.div
          key={`row-${i}`}
          className={cn(
            tileSizes[tileSize],
            "relative border-l border-foreground/15",
            tileClassName
          )}
        >
          {colsArray.map((_, j) => (
            <motion.div
              whileHover={{
                backgroundColor: `var(--tile)`,
                transition: { duration: 0 },
              }}
              animate={{
                transition: { duration: 2 },
              }}
              key={`col-${j}`}
              className={cn(
                tileSizes[tileSize],
                "relative border-t border-r border-foreground/15",
                tileClassName
              )}
            />
          ))}
        </motion.div>
      ))}
    </div>
  )
}
