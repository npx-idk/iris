import { SetMetadata } from '@nestjs/common';
import type { ProjectRole } from '@iris/common';

export type { ProjectRole };

export const PROJECT_ROLES_KEY = 'projectRoles';

export const ProjectRoles = (...roles: ProjectRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);
