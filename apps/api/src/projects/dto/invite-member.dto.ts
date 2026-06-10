import { IsEmail, IsIn } from 'class-validator';
import { ASSIGNABLE_PROJECT_ROLES, type AssignableProjectRole } from '@iris/common';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(ASSIGNABLE_PROJECT_ROLES)
  role!: AssignableProjectRole;
}
