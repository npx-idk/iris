# Iris — Dev Guidelines

## UI Components

**Always use components from `@iris/ui`** for every interactive or structural element.
Never build custom buttons, inputs, cards, badges, labels, or textareas from raw HTML.

Available components (import path `@iris/ui/components/<name>`):

- `Button` — variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes: `xs`, `sm`, `default`, `lg`, `icon`
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`
- `Input`
- `Textarea`
- `Label`
- `Badge` — variants: `default`, `outline`, `secondary`, `destructive`, `ghost`, `link`
- `Separator`
- `Skeleton`
- `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`
- `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
- `Sidebar`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, `SidebarRail`, `SidebarHeader`, `SidebarFooter`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarSeparator`

If a component you need is not in the list above, **add it via shadcn** into `packages/ui/src/components/` before using it anywhere:

```bash
pnpm --filter @iris/ui dlx shadcn@latest add <component-name>
```

Never copy-paste raw HTML patterns — always go through the shared package.

## Colors & Spacing

**Never use hardcoded Tailwind color or spacing utilities** (e.g. `bg-blue-600`, `text-gray-500`, `px-5`, `gap-3` on one-off values).
Use only design tokens from the theme:

| Token                                        | Use for                          |
| -------------------------------------------- | -------------------------------- |
| `bg-background` / `text-foreground`          | Page background / primary text   |
| `bg-card` / `text-card-foreground`           | Card/panel surfaces              |
| `bg-muted` / `text-muted-foreground`         | Subtle surfaces / secondary text |
| `bg-primary` / `text-primary-foreground`     | Primary actions                  |
| `bg-secondary` / `text-secondary-foreground` | Secondary surfaces               |
| `bg-destructive` / `text-destructive`        | Errors and danger zones          |
| `border-border`                              | All borders                      |
| `border-input` / `bg-input`                  | Form control borders             |
| `ring-ring`                                  | Focus rings                      |

## Data Fetching (web)

Use **Axios + React Query** for all API calls in the Next.js app. Never use raw `fetch`.

- Axios instance: `src/lib/axios.ts` — base URL, `withCredentials: true`, error-message interceptor
- API helper: `src/lib/api.ts` — thin wrappers (`api.get`, `api.post`, `api.patch`, `api.delete`) over the axios instance
- **Shared query hooks live in `src/hooks/queries.ts`** (`useProject`, `useProjectTests`, `useWorkspaceVariables`, `useRun`). Use them instead of redefining `useQuery` inline when the resource already has a hook; add new domain hooks there when a query is needed from more than one component
- For one-off queries, `useQuery` inline is fine; pass `queryKey` arrays that uniquely identify the resource (e.g. `['project', id]`)
- After mutations call `refetch()` from the relevant `useQuery` result to invalidate the cache
- `QueryProvider` wraps the app in `src/app/layout.tsx` — do not create additional `QueryClient` instances
- Live frames/events come over socket.io — always connect via `createSessionSocket` in `src/lib/socket.ts`

```ts
// reading data
const { data, isLoading } = useQuery({
  queryKey: ["projects"],
  queryFn: () => api.get<Project[]>("/projects"),
  enabled: !!session,
})

// mutating — direct call then refetch
await api.post("/projects", form)
refetch()
```

## API Layer (NestJS)

Import `prisma` from `'../prisma/prisma'` in NestJS services — not from `@iris/database` or `PrismaService`.

## DTOs (NestJS)

Plain classes with `class-validator` decorators. No `@nestjs/swagger` yet.
Required fields use `!` (definite assignment assertion): `name!: string`.
`ValidationPipe` is enabled globally with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
