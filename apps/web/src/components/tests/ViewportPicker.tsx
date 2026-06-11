"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ComputerIcon,
  SmartPhone01Icon,
  Tablet01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@iris/ui/components/button"
import { Input } from "@iris/ui/components/input"
import { Separator } from "@iris/ui/components/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@iris/ui/components/popover"

interface ViewportPreset {
  label: string
  width: number
  height: number
}

const PRESETS: ViewportPreset[] = [
  { label: "Desktop", width: 1280, height: 720 },
  { label: "Desktop HD", width: 1920, height: 1080 },
  { label: "Laptop", width: 1366, height: 768 },
  { label: "iPad", width: 820, height: 1180 },
  { label: "iPhone 14 Pro", width: 393, height: 852 },
  { label: "Pixel 7", width: 412, height: 915 },
]

function deviceIcon(width: number) {
  if (width < 768) return SmartPhone01Icon
  if (width < 1024) return Tablet01Icon
  return ComputerIcon
}

/** DevTools-style screen-size picker: device presets + custom dimensions. */
export function ViewportPicker({
  width,
  height,
  disabled,
  onChange,
}: {
  width: number
  height: number
  disabled?: boolean
  onChange: (width: number, height: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [customW, setCustomW] = useState(String(width))
  const [customH, setCustomH] = useState(String(height))

  function select(w: number, h: number) {
    setOpen(false)
    if (w === width && h === height) return
    onChange(w, h)
  }

  function applyCustom() {
    const w = parseInt(customW, 10)
    const h = parseInt(customH, 10)
    if (!Number.isFinite(w) || !Number.isFinite(h)) return
    select(Math.min(Math.max(w, 240), 3840), Math.min(Math.max(h, 240), 2160))
  }

  const activePreset = PRESETS.find(
    (p) => p.width === width && p.height === height
  )

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setCustomW(String(width))
          setCustomH(String(height))
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          title="Screen size"
          className="gap-1.5 text-xs text-muted-foreground"
        >
          <HugeiconsIcon
            icon={deviceIcon(width)}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
          {activePreset ? activePreset.label : "Custom"}
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {width}×{height}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="flex flex-col">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => select(p.width, p.height)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
                activePreset?.label === p.label
                  ? "text-primary"
                  : "text-foreground"
              }`}
            >
              <HugeiconsIcon
                icon={deviceIcon(p.width)}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
              <span className="flex-1">{p.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {p.width}×{p.height}
              </span>
            </button>
          ))}
        </div>
        <Separator className="my-1" />
        <div className="flex items-center gap-1.5 p-1.5">
          <Input
            value={customW}
            onChange={(e) => setCustomW(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
            inputMode="numeric"
            placeholder="W"
            className="h-7 text-xs"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            value={customH}
            onChange={(e) => setCustomH(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
            inputMode="numeric"
            placeholder="H"
            className="h-7 text-xs"
          />
          <Button size="xs" variant="outline" onClick={applyCustom}>
            Set
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
