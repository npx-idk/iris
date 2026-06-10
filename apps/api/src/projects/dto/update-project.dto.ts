import { OmitType, PartialType } from "@nestjs/mapped-types"
import { CreateProjectDto } from "./create-project.dto"

// Slug is permanent after creation, so it is excluded from updates.
export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, ["slug"] as const)
) {}
