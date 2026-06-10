"use client"

import { useState } from "react"
import {
  motion,
  AnimatePresence,
  type Variants,
  type Transition,
} from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FolderTransferIcon,
  Delete02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@iris/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"
import { SlidingNumber } from "@iris/ui/components/animate-ui/primitives/texts/sliding-number"
import type { Folder } from "@/lib/types"

const EXPAND_CONFIG = {
  initial: "rest",
  whileHover: "hover",
  whileTap: "tap",
  variants: {
    rest: { maxWidth: "40px" },
    hover: {
      maxWidth: "160px",
      transition: { type: "spring", stiffness: 200, damping: 35, delay: 0.1 },
    },
    tap: { scale: 0.95 },
  },
  transition: { type: "spring", stiffness: 250, damping: 25 },
} as const

const LABEL_VARIANTS: Variants = {
  rest: { opacity: 0, x: 6 },
  hover: { opacity: 1, x: 0, visibility: "visible" },
  tap: { opacity: 1, x: 0, visibility: "visible" },
}
const LABEL_TRANSITION: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
}

interface BulkBarProps {
  count: number
  folders: Folder[]
  onMove: (folderId: string | null) => void
  onDelete: () => void
  onClear: () => void
  deleting: boolean
  moving: boolean
}

export function BulkBar({
  count,
  folders,
  onMove,
  onDelete,
  onClear,
  deleting,
  moving,
}: BulkBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border bg-background p-2 shadow-xl"
    >
      <div className="flex min-w-0 items-center gap-1.5 px-2">
        <SlidingNumber
          number={count}
          className="text-sm font-semibold text-foreground"
        />
        <span className="text-sm text-muted-foreground">selected</span>
      </div>
      <div className="h-6 w-px rounded-full bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button
            {...EXPAND_CONFIG}
            disabled={moving}
            className="flex h-10 cursor-pointer items-center gap-2 overflow-hidden rounded-xl bg-muted px-2.5 py-2 whitespace-nowrap text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Move to folder"
          >
            <HugeiconsIcon
              icon={FolderTransferIcon}
              className="size-5 shrink-0"
            />
            <motion.span
              variants={LABEL_VARIANTS}
              transition={LABEL_TRANSITION}
              className="invisible pr-1 text-sm"
            >
              {moving ? "Moving…" : "Move to"}
            </motion.span>
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="mb-2 w-48">
          <DropdownMenuItem onSelect={() => onMove(null)}>
            Unfiled
          </DropdownMenuItem>
          {folders.map((f) => (
            <DropdownMenuItem key={f.id} onSelect={() => onMove(f.id)}>
              {f.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AnimatePresence mode="wait">
        {confirmDelete ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-1.5 px-1"
          >
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              Delete {count}?
            </span>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={onDelete}
              className="h-8"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </motion.div>
        ) : (
          <motion.button
            key="delete"
            {...EXPAND_CONFIG}
            onClick={() => setConfirmDelete(true)}
            className="flex h-10 cursor-pointer items-center gap-2 overflow-hidden rounded-xl bg-destructive/10 px-2.5 py-2 whitespace-nowrap text-destructive"
            aria-label="Delete selected"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-5 shrink-0" />
            <motion.span
              variants={LABEL_VARIANTS}
              transition={LABEL_TRANSITION}
              className="invisible pr-1 text-sm"
            >
              Delete
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
      <div className="h-6 w-px rounded-full bg-border" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label="Clear selection"
        className="h-10 w-10 rounded-xl"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
      </Button>
    </motion.div>
  )
}
