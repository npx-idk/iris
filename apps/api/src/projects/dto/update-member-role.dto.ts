import { IsIn } from 'class-validator';
import { ASSIGNABLE_PROJECT_ROLES, type AssignableProjectRole } from '@iris/common';

export class UpdateMemberRoleDto {
  @IsIn(ASSIGNABLE_PROJECT_ROLES)
  role!: AssignableProjectRole;
}
