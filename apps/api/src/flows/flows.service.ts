import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common"
import { prisma } from "../prisma/prisma"
import { ProjectAccessService } from "../common/project-access.service"
import { CreateFlowDto } from "./dto/create-flow.dto"
import { UpdateFlowDto } from "./dto/update-flow.dto"

type FlowNode = { id: string; data: { testId: string } }
type FlowEdge = { source: string; target: string }

function topologicalSort(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { nodeId: string; testId: string }[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]))

  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id)
  const result: { nodeId: string; testId: string }[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) result.push({ nodeId: id, testId: node.data.testId })
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  return result
}

@Injectable()
export class FlowsService {
  constructor(private projectAccess: ProjectAccessService) {}

  private async getFlowAndVerify(
    flowId: string,
    userId: string,
    write = false
  ) {
    const flow = await prisma.flow.findUnique({ where: { id: flowId } })
    if (!flow) throw new NotFoundException("Flow not found")
    await this.projectAccess.verifyMember(flow.projectId, userId, write)
    return flow
  }

  async findAll(projectId: string, userId: string) {
    await this.projectAccess.verifyMember(projectId, userId)
    return prisma.flow.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    })
  }

  async findOne(flowId: string, userId: string) {
    return this.getFlowAndVerify(flowId, userId)
  }

  async create(projectId: string, userId: string, dto: CreateFlowDto) {
    await this.projectAccess.verifyMember(projectId, userId, true)
    return prisma.flow.create({
      data: { name: dto.name, projectId },
    })
  }

  async update(flowId: string, userId: string, dto: UpdateFlowDto) {
    await this.getFlowAndVerify(flowId, userId, true)
    return prisma.flow.update({
      where: { id: flowId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nodes !== undefined && { nodes: dto.nodes }),
        ...(dto.edges !== undefined && { edges: dto.edges }),
      },
    })
  }

  async remove(flowId: string, userId: string) {
    await this.getFlowAndVerify(flowId, userId, true)
    await prisma.flow.delete({ where: { id: flowId } })
  }

  async getRunOrder(flowId: string, userId: string) {
    const flow = await this.getFlowAndVerify(flowId, userId)
    const nodes = (flow.nodes as unknown as FlowNode[]) ?? []
    const edges = (flow.edges as unknown as FlowEdge[]) ?? []
    if (nodes.length === 0) throw new BadRequestException("Flow has no nodes")
    const order = topologicalSort(nodes, edges)
    if (order.length !== nodes.length)
      throw new BadRequestException("Flow contains a cycle")
    return { order }
  }
}
