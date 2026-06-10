export const PROJECT_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

// OWNER cannot be assigned via invite or role-update
export const ASSIGNABLE_PROJECT_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type AssignableProjectRole = (typeof ASSIGNABLE_PROJECT_ROLES)[number];

export const API_KEY_ROLES = ['CI', 'ADMIN'] as const;
export type ApiKeyRole = (typeof API_KEY_ROLES)[number];

const ROLE_RANK: Record<ProjectRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

type ProjectAction = 'read' | 'write' | 'manage' | 'delete-project';

export function can(role: ProjectRole, action: ProjectAction): boolean {
  switch (action) {
    case 'delete-project':
      return role === 'OWNER';
    case 'manage':
      return ROLE_RANK[role] >= ROLE_RANK['ADMIN'];
    case 'write':
      return ROLE_RANK[role] >= ROLE_RANK['MEMBER'];
    case 'read':
      return true;
  }
}
