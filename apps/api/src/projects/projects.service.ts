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
import { can, type ProjectRole } from '@iris/common';

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

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async update(projectId: string, dto: UpdateProjectDto) {
    return prisma.project.update({
      where: { id: projectId },
      data: dto,
    });
  }

  // Role already verified by @ProjectRoles('OWNER') guard
  async remove(projectId: string) {
    await prisma.project.delete({ where: { id: projectId } });
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async inviteMember(projectId: string, dto: InviteMemberDto) {
    const invitee = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!invitee) {
      // Generic message — do not reveal whether the email is registered
      throw new BadRequestException('Could not invite that email address.');
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

  // Role already verified by @ProjectRoles('OWNER') guard
  async updateMemberRole(
    projectId: string,
    userId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    return prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.findUnique({
        where: { id: memberId },
      });
      if (!member || member.projectId !== projectId) {
        throw new NotFoundException('Member not found');
      }
      if (member.userId === userId) {
        throw new BadRequestException('Cannot change your own role');
      }

      if (member.role === 'OWNER') {
        const ownerCount = await tx.projectMember.count({
          where: { projectId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot demote the last owner');
        }
      }

      return tx.projectMember.update({
        where: { id: memberId },
        data: { role: dto.role },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });
    });
  }

  // Self-removal + OWNER/ADMIN logic is too nuanced for a single decorator,
  // so membership and permission checks live here.
  async removeMember(projectId: string, userId: string, memberId: string) {
    const actorMember = await this.getMember(projectId, userId);

    await prisma.$transaction(async (tx) => {
      const targetMember = await tx.projectMember.findUnique({
        where: { id: memberId },
      });

      if (!targetMember || targetMember.projectId !== projectId) {
        throw new NotFoundException('Member not found');
      }

      const isSelf = targetMember.userId === userId;
      const canRemoveOthers = can(actorMember.role as ProjectRole, 'manage');

      if (!isSelf && !canRemoveOthers) {
        throw new ForbiddenException();
      }

      if (targetMember.role === 'OWNER') {
        const ownerCount = await tx.projectMember.count({
          where: { projectId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException('Cannot remove the last owner');
        }
      }

      await tx.projectMember.delete({ where: { id: memberId } });
    });
  }

  // ─── API Keys ──────────────────────────────────────────────────────────────

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async listApiKeys(projectId: string) {
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

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async createApiKey(projectId: string, userId: string, dto: CreateApiKeyDto) {
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
      raw,
    };
  }

  // Role already verified by @ProjectRoles('OWNER', 'ADMIN') guard
  async revokeApiKey(projectId: string, keyId: string) {
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
}
