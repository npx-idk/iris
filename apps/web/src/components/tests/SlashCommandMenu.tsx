'use client'

import { useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import type { WorkspaceVariable } from '@/lib/types'
import { Textarea } from '@workspace/ui/components/textarea'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Badge } from '@workspace/ui/components/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@workspace/ui/components/sheet'

// ─── Types ─────────────────────────────────────────────────────────────────────

type MenuPhase = 'commands' | 'variables'

interface MenuState {
  phase: MenuPhase
  query: string
  slashIndex: number
}

// ─── Create variable schema ─────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  value: z.string().min(1, 'Value is required'),
  isSecret: z.boolean(),
})
type CreateValues = z.infer<typeof createSchema>

// ─── Static command list ────────────────────────────────────────────────────────

const COMMANDS = [
  { key: 'variable', label: 'Variable', description: 'Insert a workspace variable' },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export interface SlashCommandMenuProps {
  value: string
  onChange: (value: string) => void
  variables: WorkspaceVariable[]
  onVariableCreated: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus?: () => void
  autoFocus?: boolean
}

export function SlashCommandMenu({
  value, onChange, variables, onVariableCreated,
  placeholder, disabled, className, onKeyDown, onFocus, autoFocus,
}: SlashCommandMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingInsert, setPendingInsert] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, reset, watch, setError, formState: { errors, isSubmitting } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    mode: 'onBlur',
    defaultValues: { name: '', value: '', isSecret: false },
  })

  const isSecret = watch('isSecret')

  // Filtered lists
  const filteredCommands = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes((menu?.query ?? '').toLowerCase()),
  )
  const filteredVariables = variables.filter((v) =>
    v.name.toLowerCase().includes((menu?.query ?? '').toLowerCase()),
  )

  const items = menu?.phase === 'commands' ? filteredCommands : filteredVariables
  const showCreate = menu?.phase === 'variables' && menu.query.trim().length > 0 &&
    !filteredVariables.find((v) => v.name.toLowerCase() === menu.query.toLowerCase())

  // Reset active index when the list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [menu?.phase, menu?.query])

  // Scroll active item into view
  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // After a variable is created and refetched, insert the pending variable
  useEffect(() => {
    if (pendingInsert && variables.find((v) => v.name === pendingInsert)) {
      insertVariable(pendingInsert)
      setPendingInsert(null)
    }
  }, [variables]) // eslint-disable-line react-hooks/exhaustive-deps

  function closeMenu() {
    setMenu(null)
    setActiveIndex(0)
  }

  function insertVariable(name: string) {
    if (!menu) return
    const slashIndex = menu.slashIndex
    const cursorPos = slashIndex + 1 + menu.query.length
    const before = value.slice(0, slashIndex)
    const after = value.slice(cursorPos)
    const newValue = `${before}{{${name}}}${after}`
    onChange(newValue)
    closeMenu()
    // Restore cursor after the inserted token
    requestAnimationFrame(() => {
      const pos = slashIndex + name.length + 4 // 4 = length of "{{" + "}}"
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    })
  }

  function selectItem(index: number) {
    if (!menu) return
    if (menu.phase === 'commands') {
      const cmd = filteredCommands[index]
      if (!cmd) return
      if (cmd.key === 'variable') {
        setMenu({ ...menu, phase: 'variables', query: '' })
      }
    } else {
      const variable = filteredVariables[index]
      if (!variable) {
        openCreate()
      } else {
        insertVariable(variable.name)
      }
    }
  }

  function openCreate() {
    if (!menu) return
    reset({ name: menu.query.trim(), value: '', isSecret: false })
    setCreateOpen(true)
  }

  async function onCreateSubmit(values: CreateValues) {
    try {
      await api.post('/workspace/variables', {
        name: values.name.trim(),
        value: values.value.trim(),
        isSecret: values.isSecret,
      })
      setPendingInsert(values.name.trim())
      setCreateOpen(false)
      onVariableCreated()
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to create variable' })
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value
    const cursor = e.target.selectionStart ?? 0
    onChange(newValue)

    if (menu) {
      if (cursor <= menu.slashIndex) {
        closeMenu()
        return
      }
      const query = newValue.slice(menu.slashIndex + 1, cursor)
      if (query.includes(' ') || query.includes('\n')) {
        closeMenu()
        return
      }
      setMenu((prev) => prev ? { ...prev, query } : null)
    } else {
      const charBefore = newValue[cursor - 1]
      const charBeforeSlash = cursor >= 2 ? newValue[cursor - 2] : null
      if (charBefore === '/' && (charBeforeSlash === null || charBeforeSlash === ' ' || charBeforeSlash === '\n')) {
        setMenu({ phase: 'commands', query: '', slashIndex: cursor - 1 })
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menu) {
      const totalItems = items.length + (showCreate ? 1 : 0)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % totalItems)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + totalItems) % totalItems)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (activeIndex < items.length) {
          selectItem(activeIndex)
        } else if (showCreate) {
          openCreate()
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (menu.phase === 'variables') {
          setMenu({ ...menu, phase: 'commands', query: '' })
        } else {
          closeMenu()
        }
        return
      }
    }
    onKeyDown?.(e)
  }

  const totalItems = items.length + (showCreate ? 1 : 0)

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoFocus={autoFocus}
      />

      {menu && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/40">
            {menu.phase === 'commands' ? (
              <span className="text-xs text-muted-foreground">Commands</span>
            ) : (
              <>
                <button
                  onClick={() => setMenu({ ...menu, phase: 'commands', query: '' })}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Commands
                </button>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-xs text-muted-foreground">Variables</span>
              </>
            )}
            <span className="ml-auto text-xs text-muted-foreground/50">
              {menu.query ? `"${menu.query}"` : ''}
            </span>
          </div>

          {/* Items */}
          <div className="max-h-48 overflow-y-auto py-1">
            {menu.phase === 'commands' ? (
              filteredCommands.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No commands match</p>
              ) : (
                filteredCommands.map((cmd, i) => (
                  <button
                    key={cmd.key}
                    data-idx={i}
                    onClick={() => selectItem(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      i === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <span className="text-xs font-medium">{cmd.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto truncate">{cmd.description}</span>
                  </button>
                ))
              )
            ) : (
              <>
                {filteredVariables.length === 0 && !showCreate && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No variables match</p>
                )}
                {filteredVariables.map((v, i) => (
                  <button
                    key={v.id}
                    data-idx={i}
                    onClick={() => insertVariable(v.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      i === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <code className="text-xs font-mono font-medium">{v.name}</code>
                    {v.isSecret && <Badge variant="secondary" className="text-xs shrink-0">secret</Badge>}
                    {!v.isSecret && v.value && (
                      <span className="text-xs text-muted-foreground truncate ml-auto">{v.value}</span>
                    )}
                  </button>
                ))}
                {showCreate && (
                  <button
                    data-idx={filteredVariables.length}
                    onClick={openCreate}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      activeIndex === filteredVariables.length ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground">Create</span>
                    <code className="text-xs font-mono font-medium">{menu.query}</code>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer hint */}
          {totalItems > 0 && (
            <div className="px-3 py-1.5 border-t border-border bg-muted/20 flex gap-3">
              <span className="text-xs text-muted-foreground/50">↑↓ navigate</span>
              <span className="text-xs text-muted-foreground/50">↵ select</span>
              <span className="text-xs text-muted-foreground/50">Esc {menu.phase === 'variables' ? 'back' : 'close'}</span>
            </div>
          )}
        </div>
      )}

      {/* Quick-create variable Sheet */}
      <Sheet open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false) }}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Create variable</SheetTitle>
            <SheetDescription>
              Add a new workspace variable. Use <code className="text-xs bg-muted px-1 rounded">{'{{name}}'}</code> to reference it in any step.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="mt-6 space-y-4 px-1">
            <div className="space-y-1">
              <Label htmlFor="create-var-name" className="text-xs">Name</Label>
              <Input
                id="create-var-name"
                {...register('name')}
                placeholder="email"
                className="font-mono text-xs"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-var-value" className="text-xs">Value</Label>
              <Input
                id="create-var-value"
                {...register('value')}
                type={isSecret ? 'password' : 'text'}
                placeholder={isSecret ? '••••••••' : 'test@example.com'}
                className="text-xs"
              />
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" {...register('isSecret')} className="accent-primary" />
              Mark as secret
            </label>
            {errors.root && <p className="text-xs text-destructive">{errors.root.message}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create & insert'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
