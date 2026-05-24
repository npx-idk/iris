---
name: feedback-ui-components
description: Always use @workspace/ui components; never add hardcoded Tailwind colors or spacing
metadata:
  type: feedback
---

Always use components from `@workspace/ui/components/<name>` for buttons, inputs, cards, badges, labels, textareas. Never build these from raw HTML elements.

**Why:** User explicitly corrected Phase 2 pages that used raw `<button>`, `<input>`, custom Tailwind colors like `bg-blue-600`/`text-gray-500`/`bg-green-50` instead of the shared design system.

**How to apply:**
- Import from `@workspace/ui/components/button`, `card`, `input`, `textarea`, `label`, `badge`
- Available: `Button`, `Card`+sub-components, `Input`, `Textarea`, `Label`, `Badge`
- For colors use only design tokens: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-secondary`, `bg-destructive`, `text-foreground`, `text-muted-foreground`, `text-primary-foreground`, `text-destructive`, `border-border`, `border-input`, `ring-ring`
- If a component is not yet in `@workspace/ui`, add it via shadcn: `pnpm --filter @workspace/ui dlx shadcn@latest add <name>` — never build from raw HTML
- Native `<select>` (no UI component) → style with `border-input bg-card text-foreground` tokens
- No hardcoded color utilities: `bg-blue-*`, `bg-gray-*`, `bg-green-*`, `text-purple-*`, etc.
