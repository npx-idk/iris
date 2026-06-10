# Contributing to Iris

Thanks for your interest in contributing! This guide covers everything you need to get a local environment running and submit a change.

## Local setup

**Prerequisites:** Node.js ≥ 20, pnpm 9, Docker, and a free [Gemini API key](https://aistudio.google.com/app/apikey).

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables (each example file documents its values)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp packages/database/.env.example packages/database/.env

# 3. Start PostgreSQL, Redis, and MinIO
pnpm docker:up

# 4. Generate the Prisma client and apply migrations
pnpm db:generate
pnpm db:migrate

# 5. Start the dev servers (web on :3001, API on :3000)
pnpm dev
```

## Project layout

- `apps/api` — NestJS REST API, WebSocket gateway, Bull job processor
- `apps/web` — Next.js app (test authoring UI, live browser canvas)
- `packages/agent` — Stagehand browser automation engine
- `packages/cli` — `iris` CLI for CI/CD pipelines
- `packages/common` — shared types, events, and role constants
- `packages/database` — Prisma schema and migrations
- `packages/ui` — shared shadcn/ui component library

## Development guidelines

- **UI components** come from `@iris/ui` — never hand-roll buttons, inputs, cards, etc. Add missing components via `pnpm --filter @iris/ui dlx shadcn@latest add <name>`.
- **Colors and spacing** use design tokens (`bg-background`, `text-muted-foreground`, `border-border`, …) — no hardcoded Tailwind palette classes.
- **Data fetching (web)** goes through Axios + React Query (`src/lib/api.ts`); no raw `fetch`.
- **Database schema changes** require a migration: edit `packages/database/prisma/schema.prisma`, then `pnpm db:migrate`.

## Submitting changes

1. Fork the repo and create a branch from `main` (`feat/...`, `fix/...`, or `chore/...`).
2. Make your change. Keep PRs focused — one feature or fix per PR.
3. Make sure checks pass locally:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
   Pre-commit hooks (husky + lint-staged) run automatically.
4. Write commit messages that describe what was built or fixed.
5. Open a PR against `main` describing the motivation and the change.

## Reporting bugs and requesting features

Open a GitHub issue with reproduction steps (for bugs) or the use case (for features). For security vulnerabilities, see [SECURITY.md](SECURITY.md) — please do not open public issues for those.
