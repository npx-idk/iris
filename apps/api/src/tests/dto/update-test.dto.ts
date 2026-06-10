import { PartialType } from "@nestjs/mapped-types"
import { IsString, IsOptional, IsBoolean } from "class-validator"
import { CreateTestDto } from "./create-test.dto"

export class UpdateTestDto extends PartialType(CreateTestDto) {
  @IsOptional()
  @IsBoolean()
  continueOnFailure?: boolean

  @IsOptional()
  @IsString()
  folderId?: string | null
}
