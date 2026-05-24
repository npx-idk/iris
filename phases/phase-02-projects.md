# Iris — Phase 2: Projects, Members & API Keys

## Current State

```
apps/api/src/
  app.module.ts          ✅
  auth/                  ✅
  prisma/
    prisma.ts            ✅ singleton: export const prisma = new PrismaClient()
    prisma.module.ts     ✅
    prisma.service.ts    ✅
packages/database/
  prisma/schema.prisma   ✅ auth tables only
```

## What This Phase Builds

- Prisma schema: `Project`, `ProjectMember`, `ApiKey`
- `apps/api/src/projects/` — full CRUD + members + API keys
- `apps/web/src/app/dashboard/` — project list page
- `apps/web/src/app/projects/` — create project, project detail

---

## Step 1 — Schema

Add to `packages/database/prisma/schema.prisma` **after** the existing models:

```prisma
// ─── Projects ─────────────────────────────────────────────────────────────────

model Project {
  id          String          @id @default(cuid())
  name        String
  slug        String          @unique
  description String?
  baseUrl     String
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  members     ProjectMember[]
  apiKeys     ApiKey[]

  @@map("projects")
}

enum ProjectRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

model ProjectMember {
  id        String      @id @default(cuid())
  role      ProjectRole @default(MEMBER)
  createdAt DateTime    @default(now())

  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  projectId String
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
  @@map("project_members")
}

enum ApiKeyRole {
  CI
  ADMIN
}

model ApiKey {
  id         String     @id @default(cuid())
  name       String
  keyHash    String     @unique
  keyPrefix  String
  role       ApiKeyRole @default(CI)
  lastUsedAt DateTime?
  expiresAt  DateTime?
  createdAt  DateTime   @default(now())

  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  projectId  String
  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("api_keys")
}
```

Also add back-relations to the `User` model (inside the existing model):
```prisma
model User {
  // ... existing fields ...
  projectMembers ProjectMember[]
  apiKeys        ApiKey[]
}
```

Then run:
```bash
pnpm db:generate
pnpm db:migrate
# migration name: "add_projects"
```

---

## Step 2 — API Key Utility

**`apps/api/src/common/utils/api-key.util.ts`**
```typescript
import { createHash, randomBytes } from 'crypto';

const PREFIX = 'iris_';

export function generateApiKey(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const secret = randomBytes(32).toString('hex');
  const raw = `${PREFIX}${secret}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12); // "iris_" + 7 chars shown in UI
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
```

**`apps/api/src/common/utils/slug.util.ts`**
```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const baseSlug = slugify(base);
  let slug = baseSlug;
  let i = 2;
  while (await exists(slug)) {
    slug = `${baseSlug}-${i++}`;
  }
  return slug;
}
```

---

## Step 3 — Projects Module

### File structure to create

```
apps/api/src/projects/
  projects.module.ts
  projects.controller.ts
  projects.service.ts
  dto/
    create-project.dto.ts
    update-project.dto.ts
    invite-member.dto.ts
    update-member-role.dto.ts
    create-api-key.dto.ts
```

### DTOs

**`apps/api/src/projects/dto/create-project.dto.ts`**
```typescript
export class CreateProjectDto {
  name: string;
  description?: string;
  baseUrl: string;
  slug?: string;
}
```

**`apps/api/src/projects/dto/update-project.dto.ts`**
```typescript
export class UpdateProjectDto {
  name?: string;
  description?: string;
  baseUrl?: string;
}
```

**`apps/api/src/projects/dto/invite-member.dto.ts`**
```typescript
export class InviteMemberDto {
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}
```

**`apps/api/src/projects/dto/update-member-role.dto.ts`**
```typescript
export class UpdateMemberRoleDto {
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}
```

**`apps/api/src/projects/dto/create-api-key.dto.ts`**
```typescript
export class CreateApiKeyDto {
  name: string;
  role: 'CI' | 'ADMIN';
  expiresAt?: string; // ISO datetime string
}
```

---

### Service

**`apps/api/src/projects/projects.service.ts`**

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '../prisma/prisma';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { generateApiKey } from '../common/utils/api-key.util';
import { uniqueSlug } from '../common/utils/slug.util';

@Injectable()
export class ProjectsService {

  // ─── Projects ──────────────────────────────────────────────────────────────

  async findAllForUser(userId: string) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.project,
      role: m.role,
      memberCount: m.project._count.members,
    }));
  }

  async findOne(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const member = project.members.find((m) => m.userId === userId);
    if (!member) throw new ForbiddenException('Not a project member');

    return { ...project, role: member.role };
  }

  async create(userId: string, dto: CreateProjectDto) {
    const slug = await uniqueSlug(
      dto.slug ?? dto.name,
      async (s) => !!(await prisma.project.findUnique({ where: { slug: s } })),
    );

    return prisma.project.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        baseUrl: dto.baseUrl,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
    });
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto) {
    await this.requireRole(projectId, userId, ['OWNER', 'ADMIN']);

    return prisma.project.update({
      where: { id: projectId },
      data: dto,
    });
  }

  async remove(projectId: string, userId: string) {
    await this.requireRole(projectId, userId, ['OWNER']);

    await prisma.project.delete({ where: { id: projectId } });
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  async inviteMember(projectId: string, userId: string, dto: InviteMemberDto) {
    await this.requireRole(projectId, userId, ['OWNER', 'ADMIN']);

    const invitee = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!invitee) {
      throw new NotFoundException(
        'No user found with that email. They must sign up first.',
      );
    }

    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: invitee.id, projectId } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return prisma.projectMember.create({
      data: { projectId, userId: invitee.id, role: dto.role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.requireRole(projectId, userId, ['OWNER']);

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.projectId !== projectId) {
      throw new NotFoundException('Member not found');
    }
    if (member.userId === userId) {
      throw new BadRequestException('Cannot change your own role');
    }

    // Prevent demoting the last owner
    if (member.role === 'OWNER') {
      const ownerCount = await prisma.projectMember.count({
        where: { projectId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot demote the last owner');
      }
    }

    return prisma.projectMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  }

  async removeMember(projectId: string, userId: string, memberId: string) {
    const actorMember = await this.getMember(projectId, userId);
    const targetMember = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.projectId !== projectId) {
      throw new NotFoundException('Member not found');
    }

    // Can remove self, or OWNER/ADMIN can remove others
    const isSelf = targetMember.userId === userId;
    const canRemoveOthers = ['OWNER', 'ADMIN'].includes(actorMember.role);

    if (!isSelf && !canRemoveOthers) {
      throw new ForbiddenException();
    }

    // Cannot remove the last owner
    if (targetMember.role === 'OWNER') {
      const ownerCount = await prisma.projectMember.count({
        where: { projectId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    await prisma.projectMember.delete({ where: { id: memberId } });
  }

  // ─── API Keys ──────────────────────────────────────────────────────────────

  async listApiKeys(projectId: string, userId: string) {
    await this.requireRole(projectId, userId, ['OWNER', 'ADMIN']);

    return prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        role: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(projectId: string, userId: string, dto: CreateApiKeyDto) {
    await this.requireRole(projectId, userId, ['OWNER', 'ADMIN']);

    const { raw, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash: hash,
        keyPrefix: prefix,
        role: dto.role,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        userId,
        projectId,
      },
    });

    // Return raw key ONCE — never stored, never retrievable again
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      role: apiKey.role,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      raw, // ← shown once in UI, then gone
    };
  }

  async revokeApiKey(projectId: string, userId: string, keyId: string) {
    await this.requireRole(projectId, userId, ['OWNER', 'ADMIN']);

    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key || key.projectId !== projectId) {
      throw new NotFoundException('API key not found');
    }

    await prisma.apiKey.delete({ where: { id: keyId } });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async getMember(projectId: string, userId: string) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!member) throw new ForbiddenException('Not a project member');
    return member;
  }

  private async requireRole(
    projectId: string,
    userId: string,
    roles: string[],
  ) {
    const member = await this.getMember(projectId, userId);
    if (!roles.includes(member.role)) {
      throw new ForbiddenException(
        `Requires one of: ${roles.join(', ')}`,
      );
    }
    return member;
  }
}
```

---

### Controller

**`apps/api/src/projects/projects.controller.ts`**

```typescript
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@UseGuards(AuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // ─── Projects ──────────────────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.projects.findAllForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projects.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projects.remove(id, user.id);
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  @Post(':id/members')
  inviteMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.projects.inviteMember(id, user.id, dto);
  }

  @Patch(':id/members/:memberId')
  updateMemberRole(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.projects.updateMemberRole(id, user.id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projects.removeMember(id, user.id, memberId);
  }

  // ─── API Keys ──────────────────────────────────────────────────────────────

  @Get(':id/api-keys')
  listApiKeys(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projects.listApiKeys(id, user.id);
  }

  @Post(':id/api-keys')
  createApiKey(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.projects.createApiKey(id, user.id, dto);
  }

  @Delete(':id/api-keys/:keyId')
  @HttpCode(204)
  revokeApiKey(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    return this.projects.revokeApiKey(id, user.id, keyId);
  }
}
```

---

### Module

**`apps/api/src/projects/projects.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

---

### Register in AppModule

**`apps/api/src/app.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
  ],
})
export class AppModule {}
```

---

## Step 4 — Frontend

### API client

**`apps/web/src/lib/api.ts`**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',  // send session cookie
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? 'Request failed');
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

### Types

**`apps/web/src/lib/types.ts`**
```typescript
export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  baseUrl: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  role: 'CI' | 'ADMIN';
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  raw?: string; // only present immediately after creation
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}
```

### Dashboard — project list

**`apps/web/src/app/dashboard/page.tsx`**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) router.push('/login');
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session) return;
    api.get<Project[]>('/projects')
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [session]);

  if (isPending || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg" />
            <span className="font-semibold text-gray-900">Iris</span>
          </div>
          <span className="text-sm text-gray-500">{session.user.email}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
            <p className="text-gray-500 text-sm mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm
                       font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New project
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h2 className="text-gray-900 font-medium mb-1">No projects yet</h2>
            <p className="text-gray-500 text-sm mb-6">
              Create your first project to start running AI tests
            </p>
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm
                         font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5
                           hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center
                                  justify-center text-blue-600 font-semibold text-sm">
                    {project.name[0].toUpperCase()}
                  </div>
                  <RoleBadge role={project.role} />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{project.name}</h3>
                {project.description && (
                  <p className="text-gray-500 text-sm mb-3 line-clamp-1">
                    {project.description}
                  </p>
                )}
                <p className="text-xs text-gray-400 truncate">{project.baseUrl}</p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center
                                justify-between text-xs text-gray-400">
                  <span>{project.memberCount} member{project.memberCount !== 1 ? 's' : ''}</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    OWNER: 'bg-purple-50 text-purple-700',
    ADMIN: 'bg-blue-50 text-blue-700',
    MEMBER: 'bg-gray-100 text-gray-600',
    VIEWER: 'bg-gray-50 text-gray-500',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[role] ?? styles.MEMBER}`}>
      {role.toLowerCase()}
    </span>
  );
}
```

### Create project page

**`apps/web/src/app/projects/new/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    baseUrl: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const project = await api.post<{ id: string }>('/projects', form);
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create project');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            ← Back
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">New project</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Create a project</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="My E-commerce App"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={form.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value)}
              required
              placeholder="https://myapp.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              The root URL of the app being tested
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="What are you testing?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                         rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
```

### Project detail page

**`apps/web/src/app/projects/[id]/page.tsx`**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { MemberList } from '@/components/projects/MemberList';
import { ApiKeyList } from '@/components/projects/ApiKeyList';
import type { ProjectDetail, ApiKey } from '@/lib/types';

type Tab = 'overview' | 'members' | 'api-keys' | 'settings';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  const canManage = project && ['OWNER', 'ADMIN'].includes(project.role);
  const isOwner = project?.role === 'OWNER';

  useEffect(() => {
    api.get<ProjectDetail>(`/projects/${id}`)
      .then(setProject)
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (tab === 'api-keys' && canManage) {
      api.get<ApiKey[]>(`/projects/${id}/api-keys`).then(setApiKeys);
    }
  }, [tab, id, canManage]);

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'members', label: `Members (${project.members.length})`, show: true },
    { key: 'api-keys', label: 'API Keys', show: !!canManage },
    { key: 'settings', label: 'Settings', show: !!canManage },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
              Projects
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-900">{project.name}</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{project.baseUrl}</p>
            </div>
            <Link
              href={`/projects/${id}/tests/new`}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                         rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New test
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-6xl mx-auto flex gap-6">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'overview' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-4">Project details</h2>
            <dl className="space-y-3">
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-28 shrink-0">Base URL</dt>
                <dd className="text-sm text-gray-900">{project.baseUrl}</dd>
              </div>
              {project.description && (
                <div className="flex gap-4">
                  <dt className="text-sm text-gray-500 w-28 shrink-0">Description</dt>
                  <dd className="text-sm text-gray-900">{project.description}</dd>
                </div>
              )}
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-28 shrink-0">Your role</dt>
                <dd className="text-sm text-gray-900 capitalize">
                  {project.role.toLowerCase()}
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-28 shrink-0">Created</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(project.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-400">
                Tests will appear here in Phase 3.
              </p>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <MemberList
            members={project.members}
            projectId={id}
            canManage={!!canManage}
            isOwner={!!isOwner}
            currentUserId={project.members.find(m =>
              ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(m.role)
            )?.user.id ?? ''}
            onUpdate={() =>
              api.get<ProjectDetail>(`/projects/${id}`).then(setProject)
            }
          />
        )}

        {tab === 'api-keys' && canManage && (
          <ApiKeyList
            apiKeys={apiKeys}
            projectId={id}
            onUpdate={() =>
              api.get<ApiKey[]>(`/projects/${id}/api-keys`).then(setApiKeys)
            }
          />
        )}

        {tab === 'settings' && canManage && (
          <ProjectSettings
            project={project}
            isOwner={!!isOwner}
            onUpdate={(updated) => setProject({ ...project, ...updated })}
            onDelete={() => router.push('/dashboard')}
          />
        )}
      </main>
    </div>
  );
}

// ─── Settings inline component ────────────────────────────────────────────────

function ProjectSettings({
  project, isOwner, onUpdate, onDelete,
}: {
  project: ProjectDetail;
  isOwner: boolean;
  onUpdate: (data: Partial<ProjectDetail>) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    baseUrl: project.baseUrl,
    description: project.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${project.id}`, form);
      onUpdate(form);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/projects/${project.id}`);
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <h2 className="font-medium text-gray-900">General settings</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
          <input
            value={form.baseUrl}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                       rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      {isOwner && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h2 className="font-medium text-red-700 mb-1">Danger zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Deleting a project permanently removes all tests, runs, and API keys.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 border border-red-300 text-red-600 text-sm
                         font-medium rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete project
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-600 font-medium">Are you sure?</p>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium
                           rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### MemberList component

**`apps/web/src/components/projects/MemberList.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { ProjectMember } from '@/lib/types';

interface Props {
  members: ProjectMember[];
  projectId: string;
  canManage: boolean;
  isOwner: boolean;
  currentUserId: string;
  onUpdate: () => void;
}

const ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;

export function MemberList({
  members, projectId, canManage, isOwner, currentUserId, onUpdate,
}: Props) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInviting(true);
    try {
      await api.post(`/projects/${projectId}/members`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    await api.delete(`/projects/${projectId}/members/${memberId}`);
    onUpdate();
  }

  async function handleRoleChange(memberId: string, role: string) {
    await api.patch(`/projects/${projectId}/members/${memberId}`, { role });
    onUpdate();
  }

  return (
    <div className="space-y-4">
      {/* Invite form */}
      {canManage && (
        <form
          onSubmit={handleInvite}
          className="bg-white rounded-xl border border-gray-200 p-5"
        >
          <h3 className="font-medium text-gray-900 mb-4">Invite member</h3>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              placeholder="colleague@company.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.toLowerCase()}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                         rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {inviting ? 'Inviting...' : 'Invite'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </form>
      )}

      {/* Member list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center
                              justify-center text-sm font-medium text-gray-600">
                {member.user.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{member.user.name}</p>
                <p className="text-xs text-gray-400">{member.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isOwner && member.role !== 'OWNER' ? (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['ADMIN', 'MEMBER', 'VIEWER'].map((r) => (
                    <option key={r} value={r}>{r.toLowerCase()}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-gray-500 capitalize">
                  {member.role.toLowerCase()}
                </span>
              )}
              {canManage && member.role !== 'OWNER' && (
                <button
                  onClick={() => handleRemove(member.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### ApiKeyList component

**`apps/web/src/components/projects/ApiKeyList.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { ApiKey } from '@/lib/types';

interface Props {
  apiKeys: ApiKey[];
  projectId: string;
  onUpdate: () => void;
}

export function ApiKeyList({ apiKeys, projectId, onUpdate }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'CI' | 'ADMIN'>('CI');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const key = await api.post<ApiKey>(`/projects/${projectId}/api-keys`, {
        name, role,
      });
      setNewKey(key.raw!);
      setName('');
      onUpdate();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    await api.delete(`/projects/${projectId}/api-keys/${keyId}`);
    onUpdate();
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-4">
      {/* New key just created — show once */}
      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="text-sm font-medium text-green-800 mb-1">
            API key created — copy it now
          </p>
          <p className="text-xs text-green-600 mb-3">
            This key will never be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-200 rounded-lg
                             px-3 py-2 text-sm font-mono text-gray-800 break-all">
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-green-600 text-white text-sm font-medium
                         rounded-lg hover:bg-green-700 transition-colors shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-green-600 hover:text-green-800 mt-3"
          >
            I've saved it, dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="bg-white rounded-xl border border-gray-200 p-5"
      >
        <h3 className="font-medium text-gray-900 mb-4">Create API key</h3>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="CI Pipeline"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'CI' | 'ADMIN')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="CI">CI (trigger runs only)</option>
            <option value="ADMIN">Admin (full access)</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium
                       rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>

      {/* Key list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {apiKeys.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            No API keys yet
          </p>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{key.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <code className="text-xs text-gray-400 font-mono">
                    {key.keyPrefix}••••••••
                  </code>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    key.role === 'ADMIN'
                      ? 'bg-purple-50 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {key.role}
                  </span>
                  {key.lastUsedAt && (
                    <span className="text-xs text-gray-400">
                      Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## Acceptance Criteria

- [ ] `pnpm db:migrate` adds `projects`, `project_members`, `api_keys` tables
- [ ] `POST /projects` creates a project and adds creator as OWNER
- [ ] Duplicate slug auto-resolves (`my-app` → `my-app-2`)
- [ ] `GET /projects` returns only projects the user belongs to
- [ ] VIEWER cannot invite members or create API keys (403)
- [ ] Cannot remove or demote the last OWNER
- [ ] `POST /projects/:id/api-keys` returns `raw` key once — not stored in DB
- [ ] Dashboard shows project cards with role badge
- [ ] Create project form redirects to project detail page
- [ ] Project detail has Overview / Members / API Keys / Settings tabs
- [ ] Members tab shows invite form for OWNER/ADMIN only
- [ ] API Keys tab shows newly created key in green banner once, then never again
- [ ] Delete project (OWNER only) redirects to dashboard

---

## Tips for Claude Code

1. **Import `prisma` from `'../prisma/prisma'`** — not from `@iris/database` directly.
   The singleton is in `apps/api/src/prisma/prisma.ts`.

2. **No `@nestjs/swagger` or `class-validator` yet** — keep DTOs as plain classes.
   We'll add Swagger in a later phase when the API surface is stable.

3. **The `currentUserId` prop in `MemberList`** — get it by finding the member
   whose userId matches `session.user.id` from `useSession()`.
   Update the project detail page to pass `session.user.id` directly.

4. **Body parser** — if POST requests to `/projects` get empty bodies,
   check that `main.ts` has body parser enabled for non-auth routes
   (from the note in Phase 1).