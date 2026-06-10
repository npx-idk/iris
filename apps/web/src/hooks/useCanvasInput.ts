'use client'

import { useRef, useEffect, RefObject } from 'react'
import { api } from '@/lib/api'
import { SessionState } from './useAuthorSession'

export function useCanvasInput(
  sessionIdRef: RefObject<string | null>,
  sessionState: SessionState,
  interactiveMode: boolean,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const isDraggingRef = useRef(false)
  const lastMoveRef   = useRef(0)
  const lastScrollRef = useRef(0)

  async function sendInput(body: Record<string, unknown>) {
    const sid = sessionIdRef.current
    if (!sid) return
    await api.post(`/author/${sid}/input`, body).catch(() => {})
  }

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    return {
      x: Math.round((e.clientX - rect.left) * (canvas.width  / rect.width)),
      y: Math.round((e.clientY - rect.top)  * (canvas.height / rect.height)),
    }
  }

  function modifiers(e: React.MouseEvent | React.KeyboardEvent) {
    return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0)
  }

  // Wheel must be a non-passive native listener to call preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      if (sessionState !== 'ready' || !interactiveMode) return
      e.preventDefault()
      const now = Date.now()
      if (now - lastScrollRef.current < 50) return
      lastScrollRef.current = now
      const rect = canvas.getBoundingClientRect()
      const x = Math.round((e.clientX - rect.left) * (canvas.width  / rect.width))
      const y = Math.round((e.clientY - rect.top)  * (canvas.height / rect.height))
      const factor = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1
      sendInput({ type: 'mouseWheel', x, y, deltaX: e.deltaX * factor, deltaY: e.deltaY * factor })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [sessionState, interactiveMode]) // eslint-disable-line react-hooks/exhaustive-deps

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (sessionState !== 'ready' || !interactiveMode) return
    e.preventDefault()
    canvasRef.current?.focus()
    isDraggingRef.current = true
    const { x, y } = canvasCoords(e)
    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
    sendInput({ type: 'mousePressed', x, y, button, clickCount: 1, modifiers: modifiers(e) })
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current || !interactiveMode) return
    isDraggingRef.current = false
    const { x, y } = canvasCoords(e)
    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
    sendInput({ type: 'mouseReleased', x, y, button, clickCount: 1, modifiers: modifiers(e) })
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (sessionState !== 'ready' || !interactiveMode) return
    const now = Date.now()
    const interval = isDraggingRef.current ? 16 : 50
    if (now - lastMoveRef.current < interval) return
    lastMoveRef.current = now
    const { x, y } = canvasCoords(e)
    sendInput({ type: 'mouseMoved', x, y, button: isDraggingRef.current ? 'left' : 'none', modifiers: modifiers(e) })
  }

  function onMouseLeave() {
    isDraggingRef.current = false
  }

  function onContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (sessionState !== 'ready' || !interactiveMode) return
    e.preventDefault()
    const mods = modifiers(e)
    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey
    sendInput({ type: 'keyDown', key: e.key, code: e.code, text: '', modifiers: mods, windowsVirtualKeyCode: e.keyCode })
    if (isPrintable) {
      sendInput({ type: 'char', key: e.key, code: e.code, text: e.key, modifiers: mods, windowsVirtualKeyCode: e.keyCode })
    }
  }

  function onKeyUp(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (sessionState !== 'ready' || !interactiveMode) return
    e.preventDefault()
    sendInput({ type: 'keyUp', key: e.key, code: e.code, text: '', modifiers: modifiers(e), windowsVirtualKeyCode: e.keyCode })
  }

  return { onMouseDown, onMouseUp, onMouseMove, onMouseLeave, onContextMenu, onKeyDown, onKeyUp, isDraggingRef }
}
