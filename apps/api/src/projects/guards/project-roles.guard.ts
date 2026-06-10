import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma } from '../../prisma/prisma';
import {
  PROJECT_ROLES_KEY,
  type ProjectRole,
} from '../decorators/project-roles.decorator';

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @ProjectRoles() on this route — skip
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.id;
    const projectId: string = request.params.id;

    if (!userId || !projectId) throw new ForbiddenException();

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (!member) throw new ForbiddenException('Not a project member');

    if (!requiredRoles.includes(member.role as ProjectRole)) {
      throw new ForbiddenException(
        `Requires one of: ${requiredRoles.join(', ')}`,
      );
    }

    // Attach for downstream use without re-querying
    request.projectMember = member;
    return true;
  }
}
