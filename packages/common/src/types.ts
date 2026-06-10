import type { ProjectRole, ApiKeyRole } from './roles';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  baseUrl: string;
  role: ProjectRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  role: ProjectRole;
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
  role: ApiKeyRole;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  raw?: string;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}

export interface BrowserTab {
  targetId: string
  url: string
  active: boolean
}

export type BrowserEventKind = 'console' | 'exception' | 'navigation' | 'network.response' | 'network.body'

export interface BrowserEvent {
  sessionId: string
  kind: BrowserEventKind
  timestamp: number
  [key: string]: unknown
}

export type CompletedRunStatus = 'PASSED' | 'FAILED' | 'CANCELLED'
export type RunStatus = 'QUEUED' | 'RUNNING' | CompletedRunStatus
