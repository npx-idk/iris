import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from "@nestjs/common"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser, RequestUser } from "../auth/current-user.decorator"
import { FlowsService } from "./flows.service"
import { CreateFlowDto } from "./dto/create-flow.dto"
import { UpdateFlowDto } from "./dto/update-flow.dto"

@UseGuards(AuthGuard)
@Controller()
export class FlowsController {
  constructor(private readonly flows: FlowsService) {}

  @Get("projects/:projectId/flows")
  findAll(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string
  ) {
    return this.flows.findAll(projectId, user.id)
  }

  @Post("projects/:projectId/flows")
  create(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Body() dto: CreateFlowDto
  ) {
    return this.flows.create(projectId, user.id, dto)
  }

  @Get("flows/:id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.flows.findOne(id, user.id)
  }

  @Patch("flows/:id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateFlowDto
  ) {
    return this.flows.update(id, user.id, dto)
  }

  @Delete("flows/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.flows.remove(id, user.id)
  }

  @Get("flows/:id/run-order")
  getRunOrder(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.flows.getRunOrder(id, user.id)
  }
}
