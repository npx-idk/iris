'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { MemberList } from '@/components/projects/MemberList';
import { ApiKeyList } from '@/components/projects/ApiKeyList';
import type { ProjectDetail, ApiKey } from '@/lib/types';
import { ROUTES } from '@/lib/routes';
import { can } from '@iris/common';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
import { Label } from '@workspace/ui/components/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@workspace/ui/components/card';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';

type Tab = 'overview' | 'members' | 'api-keys' | 'settings';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>('overview');

  const {
    data: project,
    isLoading,
    isError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
  });

  const canManage = project && can(project.role, 'manage');
  const isOwner = project && can(project.role, 'delete-project');

  const { data: apiKeys = [], refetch: refetchApiKeys } = useQuery({
    queryKey: ['api-keys', id],
    queryFn: () => api.get<ApiKey[]>(`/projects/${id}/api-keys`),
    enabled: tab === 'api-keys' && !!canManage,
  });

  const redirected = useRef(false);
  useEffect(() => {
    if (isError && !redirected.current) {
      redirected.current = true;
      router.push(ROUTES.dashboard);
    }
  }, [isError, router]);

  if (isLoading || !project) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{project.name}</span>
        </nav>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href={ROUTES.projectTestNew(id)}>+ New test</Link>
          </Button>
        </div>
      </header>

      <div className="flex gap-0 border-b border-border px-4">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-3 px-1 mr-4 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>Project details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div className="flex gap-4">
                  <dt className="text-xs text-muted-foreground w-28 shrink-0">Base URL</dt>
                  <dd className="text-xs text-foreground">{project.baseUrl}</dd>
                </div>
                {project.description && (
                  <div className="flex gap-4">
                    <dt className="text-xs text-muted-foreground w-28 shrink-0">Description</dt>
                    <dd className="text-xs text-foreground">{project.description}</dd>
                  </div>
                )}
                <div className="flex gap-4">
                  <dt className="text-xs text-muted-foreground w-28 shrink-0">Your role</dt>
                  <dd className="text-xs text-foreground capitalize">{project.role.toLowerCase()}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="text-xs text-muted-foreground w-28 shrink-0">Created</dt>
                  <dd className="text-xs text-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 pt-6 border-t border-border">
                <Button asChild variant="outline" size="sm">
                  <Link href={ROUTES.projectTests(id)}>View tests →</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'members' && (
          <MemberList
            members={project.members}
            projectId={id}
            canManage={!!canManage}
            isOwner={!!isOwner}
            currentUserId={session?.user.id ?? ''}
            onUpdate={() => refetchProject()}
          />
        )}

        {tab === 'api-keys' && canManage && (
          <ApiKeyList
            apiKeys={apiKeys}
            projectId={id}
            onUpdate={() => refetchApiKeys()}
          />
        )}

        {tab === 'settings' && canManage && (
          <ProjectSettings
            project={project}
            isOwner={!!isOwner}
            onUpdate={() => refetchProject()}
            onDelete={() => router.push(ROUTES.dashboard)}
          />
        )}
      </div>
    </>
  );
}

function ProjectSettings({
  project, isOwner, onUpdate, onDelete,
}: {
  project: ProjectDetail;
  isOwner: boolean;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    baseUrl: project.baseUrl,
    description: project.description ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: project.name,
      baseUrl: project.baseUrl,
      description: project.description ?? '',
    });
  }, [project]);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${project.id}`, form);
      onUpdate();
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
      <Card>
        <CardHeader>
          <CardTitle>General settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-url">Base URL</Label>
              <Input
                id="settings-url"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-desc">Description</Label>
              <Textarea
                id="settings-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting a project permanently removes all tests, runs, and API keys.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!confirmDelete ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete project
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-xs text-destructive font-medium">Are you sure?</p>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
