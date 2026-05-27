# Iris

AI-powered browser test platform. Write plain-English test steps, Iris executes them in a real browser using Stagehand + Gemini, streams screenshots live, and integrates with CI/CD via a CLI and API keys.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js (App Router, Turbopack) |
| API | NestJS 11 |
| Auth | better-auth (email/password) |
| Database | PostgreSQL 17 + Prisma |
| Queue | Bull + Redis |
| Storage | MinIO (screenshots, frame recordings) |
| Browser AI | Stagehand + Gemini 2.5 Flash |
| UI | shadcn/ui in `packages/ui` |

## Prerequisites

- Node.js ≥ 20
- pnpm 9
- Docker
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free tier works)

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

**`apps/api/.env`**
```bash
DATABASE_URL=postgresql://iris:iris@localhost:5432/iris
PORT=3000
WEB_URL=http://localhost:3001
BETTER_AUTH_SECRET=         # openssl rand -hex 32
BETTER_AUTH_URL=http://localhost:3000

REDIS_URL=redis://localhost:6379

GEMINI_API_KEY=             # from Google AI Studio
BROWSER_ENV=LOCAL           # LOCAL or BROWSERBASE

# MinIO — defaults match docker-compose, no changes needed locally
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=iris
MINIO_PUBLIC_URL=http://localhost:9000

# Optional — Browserbase cloud browsers
# BROWSERBASE_API_KEY=
# BROWSERBASE_PROJECT_ID=
```

**`apps/web/.env.local`**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
BETTER_AUTH_SECRET=         # same value as API
```

> `BETTER_AUTH_SECRET` must be identical in both files — it signs session tokens.

### 3. Start infrastructure

```bash
pnpm docker:up
```

This starts PostgreSQL, Redis, and MinIO via Docker Compose.

| Service | URL |
|---|---|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |

### 4. Run database migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 5. Start dev servers

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Web | http://localhost:3001 |
| API | http://localhost:3000 |

---

## Project structure

```
iris/
├── apps/
│   ├── api/          # NestJS — REST API, WebSocket gateway, Bull job processor
│   └── web/          # Next.js — test authoring UI, live canvas, run viewer
└── packages/
    ├── agent/        # Stagehand browser automation engine
    ├── cli/          # iris CLI — trigger runs from CI/CD pipelines
    ├── common/       # Shared TypeScript types and event constants
    ├── database/     # Prisma schema and generated client
    ├── ui/           # Shared shadcn/ui component library
    ├── eslint-config/
    └── typescript-config/
```

## CI/CD integration

Generate an API key from a project's settings page, then use the CLI:

```bash
# Run all enabled tests in a project
npx @iris/cli run --url https://your-iris-instance.com --key iris_... --project <projectId>

# Run a single test
npx @iris/cli run --url https://your-iris-instance.com --key iris_... --test <testId>
```

Exit code `0` = all passed, `1` = any failed or cancelled.

**GitHub Actions example:**
```yaml
- name: Run Iris tests
  run: npx @iris/cli run --project ${{ vars.IRIS_PROJECT_ID }}
  env:
    IRIS_URL: ${{ vars.IRIS_URL }}
    IRIS_KEY: ${{ secrets.IRIS_KEY }}
```

## Useful commands

| Command | Description |
|---|---|
| `pnpm dev` | Start web + API in watch mode |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:generate` | Regenerate Prisma client from schema |
| `pnpm db:migrate` | Create and apply a new migration |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` | Start all infrastructure containers |
| `pnpm docker:down` | Stop and remove containers |

## Adding UI components

Components live in `packages/ui` and are shared across all apps:

```bash
pnpm --filter @iris/ui dlx shadcn@latest add <component-name>
```

Then import anywhere in the monorepo:

```tsx
import { Button } from '@iris/ui/components/button'
```
