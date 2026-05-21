# Iris

AI-powered QA testing platform.

## Stack

- **Monorepo** — pnpm workspaces + Turborepo
- **Web** — Next.js 16 (App Router, Turbopack)
- **API** — NestJS 11
- **Auth** — better-auth (email/password)
- **Database** — PostgreSQL 17 via Prisma
- **UI** — shadcn/ui components in `packages/ui`

## Prerequisites

- Node.js ≥ 20
- pnpm 9
- Docker (for Postgres)

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Postgres

```bash
pnpm docker:up
```

### 3. Generate the Prisma client

```bash
pnpm db:generate
```

### 4. Run migrations

```bash
pnpm db:migrate
# When prompted for a migration name, enter: init_auth
```

### 5. Start the dev servers

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |

---

## Project structure

```
iris/
├── apps/
│   ├── api/          # NestJS — auth handler, future REST endpoints
│   └── web/          # Next.js — UI, auth pages, dashboard
└── packages/
    ├── database/     # Prisma schema + generated client
    ├── ui/           # Shared shadcn/ui components
    ├── eslint-config/
    └── typescript-config/
```

## Useful commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in watch mode |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:generate` | Regenerate Prisma client from schema |
| `pnpm db:migrate` | Create and apply a new migration |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` | Start Postgres container |
| `pnpm docker:down` | Stop and remove containers |

## Adding UI components

Components live in `packages/ui` and are shared across all apps. To add a new shadcn component:

```bash
cd packages/ui
npx shadcn@latest add <component-name>
```

Import it anywhere in the monorepo:

```tsx
import { Button } from '@workspace/ui/components/button';
```

## Environment variables

Copy the examples and fill in your values before running:

**`apps/api/.env`**
```
DATABASE_URL=postgresql://iris:iris@localhost:5432/iris
PORT=3001
WEB_URL=http://localhost:3000
BETTER_AUTH_SECRET=<run: openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:3001
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
BETTER_AUTH_SECRET=<same value as API>
```

> `BETTER_AUTH_SECRET` must be identical in both files — it signs session cookies.
