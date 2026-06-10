"use client"

import { useState } from "react"

/** Copies text to the clipboard and exposes a `copied` flag that resets after `resetMs`. */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false)

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), resetMs)
    })
  }

  return { copied, copy }
}
