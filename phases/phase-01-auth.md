# Iris — Phase 1: Authentication

## Current State

```
iris/
  apps/web/          ✅ Next.js 14 App Router
  packages/
    ui/              ✅ shared components
    eslint-config/   ✅
    typescript-config/ ✅
  apps/api/          ← CREATE THIS
  packages/database/ ← CREATE THIS
```

## What This Phase Builds

- `packages/database` — Prisma schema (auth tables only), generated client
- `apps/api` — NestJS app with better-auth mounted as a handler
- `apps/web` — signup, login, logout, protected route, session hook

By the end: user can sign up, log in, and be redirected to a protected dashboard.

---

## Step 1 — `packages/database`

### Create the package

```bash
mkdir -p packages/database/prisma
```

**`packages/database/package.json`**
```json
{
  "name": "@iris/database",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio",
    "seed": "tsx prisma/seed.ts"
  },
  "exports": {
    ".": {
      "types": "./generated/client/index.d.ts",
      "default": "./generated/client/index.js"
    }
  },
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "prisma": "^6.0.0",
    "tsx": "^4.19.1",
    "typescript": "5.9.3"
  }
}
```

**`packages/database/tsconfig.json`**
```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "prisma"],
  "exclude": ["node_modules", "dist", "generated"]
}
```

**`packages/database/prisma/schema.prisma`**
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Auth (better-auth compatible) ───────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
  accounts      Account[]

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("accounts")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verifications")
}
```

**`packages/database/prisma/seed.ts`**
```typescript
import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');
  console.log('✅ Done — no seed data needed for auth phase');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

---

## Step 2 — `apps/api`

### Scaffold NestJS

```bash
mkdir -p apps/api/src/{auth,prisma,common}
```

**`apps/api/package.json`**
```json
{
  "name": "@iris/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@iris/database": "workspace:*",
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "better-auth": "^1.2.7",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@workspace/eslint-config": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "typescript": "5.9.3"
  }
}
```

**`apps/api/tsconfig.json`**
```json
{
  "extends": "@workspace/typescript-config/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "."
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**`apps/api/nest-cli.json`**
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

---

### Prisma Service

**`apps/api/src/prisma/prisma.service.ts`**
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@iris/database';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**`apps/api/src/prisma/prisma.module.ts`**
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

### Auth — better-auth setup

**`apps/api/src/auth/auth.ts`**

This is the better-auth server instance. Keep it in a plain `.ts` file
(not a NestJS class) so it can be imported by the controller without
circular dependency issues.

```typescript
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@iris/database';

// Module-level singleton — created once on startup
const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,        // 7 days
    updateAge: 60 * 60 * 24,             // refresh if >1 day old
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,                    // 5 min client-side cache
    },
  },
  trustedOrigins: [
    process.env.WEB_URL ?? 'http://localhost:3000',
  ],
});

export type Auth = typeof auth;
```

**`apps/api/src/auth/auth.controller.ts`**

better-auth uses a single wildcard handler — all `/api/auth/**` requests
are forwarded to it. NestJS passes the raw Express request/response through.

```typescript
import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { auth } from './auth';
import { toNodeHandler } from 'better-auth/node';

const handler = toNodeHandler(auth);

@Controller('api/auth')
export class AuthController {
  @All('*')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    // Strip the NestJS prefix — better-auth expects paths starting with /api/auth
    await handler(req, res);
  }
}
```

**`apps/api/src/auth/current-user.decorator.ts`**
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { auth } from './auth';

export const CurrentUser = createParamDecorator(
  async (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const session = await auth.api.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });
    return session?.user ?? null;
  },
);
```

**`apps/api/src/auth/auth.guard.ts`**
```typescript
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { auth } from './auth';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = await auth.api.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    // Attach user to request for use in controllers
    request.user = session.user;
    return true;
  }
}
```

**`apps/api/src/auth/auth.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
})
export class AuthModule {}
```

---

### App module + main

**`apps/api/src/app.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
```

**`apps/api/src/main.ts`**
```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Disable body parser for auth routes — better-auth handles its own body parsing
    bodyParser: false,
  });

  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,               // required for cookie-based auth
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}

bootstrap();
```

> **Note on bodyParser: false** — better-auth's `toNodeHandler` reads the
> raw request body itself. If NestJS's body parser runs first, better-auth
> gets an empty body on POST requests. Setting `bodyParser: false` at app
> level and re-enabling it for non-auth routes is the correct pattern.
> Alternatively, enable body parser but exclude `/api/auth/*` paths.

The cleaner approach — disable body parser globally and add it back
explicitly for other routes. Since we only have auth in Phase 1, `false`
is fine. When we add other controllers in Phase 2, add this to `main.ts`:

```typescript
import * as express from 'express';

// Re-enable body parser for non-auth routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) return next();
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) return next();
  express.urlencoded({ extended: true })(req, res, next);
});
```

---

### tsconfig for NestJS

The workspace `typescript-config` package needs a `nestjs.json` preset.

**`packages/typescript-config/nestjs.json`**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "module": "commonjs",
    "target": "ES2021",
    "lib": ["ES2021"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true
  },
  "exclude": ["node_modules", "dist"]
}
```

Check if `packages/typescript-config/base.json` exists — if not, create it:

**`packages/typescript-config/base.json`**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

## Step 3 — `apps/web` Auth Integration

### Install better-auth client

```bash
pnpm --filter @iris/web add better-auth
```

### Auth client

**`apps/web/src/lib/auth-client.ts`**
```typescript
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
```

### Auth pages

**`apps/web/src/app/(auth)/layout.tsx`**
```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
```

**`apps/web/src/app/(auth)/login/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn.email({
      email,
      password,
      callbackURL: '/dashboard',
    });

    if (error) {
      setError(error.message ?? 'Invalid email or password');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Sign in to Iris</h1>
        <p className="text-gray-500 mt-1 text-sm">
          AI-powered QA testing platform
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium
                     rounded-lg hover:bg-blue-700 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-blue-600 hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}
```

**`apps/web/src/app/(auth)/signup/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth-client';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signUp.email({
      name,
      email,
      password,
      callbackURL: '/dashboard',
    });

    if (error) {
      setError(error.message ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Create an account</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Start testing smarter with Iris
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Min. 8 characters"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium
                     rounded-lg hover:bg-blue-700 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

### Protected dashboard placeholder

**`apps/web/src/app/dashboard/page.tsx`**
```typescript
'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg" />
            <span className="font-semibold text-gray-900">Iris</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session.user.email}</span>
            <button
              onClick={() => signOut().then(() => router.push('/login'))}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Welcome, {session.user.name} 👋
        </h1>
        <p className="text-gray-500">
          Auth is working. Projects and tests come in Phase 2.
        </p>
      </main>
    </div>
  );
}
```

### Middleware — redirect unauthenticated users

**`apps/web/src/middleware.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from 'better-auth/cookies';

const PUBLIC_PATHS = ['/login', '/signup', '/api'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = await getSession({
    request,
    secret: process.env.BETTER_AUTH_SECRET ?? '',
  });

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackURL', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### Update root page to redirect

**`apps/web/src/app/page.tsx`**
```typescript
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
```

### Update `apps/web` environment variables

**`apps/web/.env.local`**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
BETTER_AUTH_SECRET=your-secret-min-32-chars-change-in-production
```

---

## Step 4 — Environment Files

**`apps/api/.env`**
```bash
DATABASE_URL=postgresql://iris:iris@localhost:5432/iris
PORT=3001
WEB_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret-min-32-chars-change-in-production
```

> ⚠️ `BETTER_AUTH_SECRET` must be identical in both `apps/api` and
> `apps/web` — it signs session cookies.

---

## Step 5 — Docker Compose (Postgres only for now)

**`docker-compose.yml`** (root)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: iris
      POSTGRES_PASSWORD: iris
      POSTGRES_DB: iris
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U iris"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## Step 6 — Update `turbo.json`

Add `dist` outputs for the API and database packages:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**", "generated/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "format": {
      "dependsOn": ["^format"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "generate": {
      "cache": false
    },
    "migrate": {
      "cache": false
    }
  }
}
```

---

## Step 7 — Update root `package.json` scripts

```json
{
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "format": "turbo format",
    "typecheck": "turbo typecheck",
    "db:generate": "pnpm --filter @iris/database generate",
    "db:migrate": "pnpm --filter @iris/database migrate",
    "db:studio": "pnpm --filter @iris/database studio",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down"
  }
}
```

---

## Step 8 — Add workspace to pnpm

Create **`pnpm-workspace.yaml`** at root if it doesn't exist:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## Build & Run Order

```bash
# 1. Start Postgres
pnpm docker:up

# 2. Install all dependencies
pnpm install

# 3. Generate Prisma client
pnpm db:generate

# 4. Run migrations
pnpm db:migrate
# → when prompted for migration name: "init_auth"

# 5. Start everything
pnpm dev
# → api on http://localhost:3001
# → web on http://localhost:3000
```

---

## Acceptance Criteria

- [ ] `pnpm install` completes without errors
- [ ] `pnpm db:migrate` creates the 4 auth tables in Postgres
- [ ] `pnpm dev` starts both `apps/api` (3001) and `apps/web` (3000)
- [ ] `GET http://localhost:3001/api/auth/get-session` returns `{ "session": null }`
- [ ] Visiting `http://localhost:3000` redirects to `/login`
- [ ] User can sign up at `/signup` → redirected to `/dashboard`
- [ ] User can sign out → redirected to `/login`
- [ ] Refreshing `/dashboard` keeps the user logged in
- [ ] Visiting `/dashboard` without a session redirects to `/login`

---

## Common Issues

**`Unauthorized` on signup/login**
→ `BETTER_AUTH_SECRET` mismatch between `apps/api/.env` and `apps/web/.env.local`
→ CORS origin not matching — check `WEB_URL` in `apps/api/.env`

**`bodyParser` conflict errors**
→ Ensure `bodyParser: false` in `NestFactory.create()` options in `main.ts`

**Prisma client not found**
→ Run `pnpm db:generate` before `pnpm dev`

**`reflect-metadata` errors**
→ Ensure `import 'reflect-metadata'` is the very first line in `apps/api/src/main.ts`

**Session not persisting after refresh**
→ The auth client `baseURL` must point to the API, not the web app
→ Cookies require `credentials: true` in CORS config