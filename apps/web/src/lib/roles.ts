import type { ProjectRole, ApiKeyRole } from '@iris/common';

export const PROJECT_ROLE_BADGE_VARIANT: Record<ProjectRole, 'default' | 'secondary' | 'outline'> = {
  OWNER: 'default',
  ADMIN: 'secondary',
  MEMBER: 'outline',
  VIEWER: 'outline',
};

export const API_KEY_ROLE_BADGE_VARIANT: Record<ApiKeyRole, 'default' | 'secondary'> = {
  ADMIN: 'default',
  CI: 'secondary',
};
