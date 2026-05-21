import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma } from './prisma';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly db = prisma;

  async onModuleInit() {
    await prisma.$connect();
  }

  async onModuleDestroy() {
    await prisma.$disconnect();
  }
}
