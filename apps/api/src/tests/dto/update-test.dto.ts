import { IsString, IsOptional, IsBoolean, IsArray, ValidateIf } from 'class-validator'

export class UpdateTestDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  startUrl?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsBoolean()
  continueOnFailure?: boolean

  @IsOptional()
  @ValidateIf((o) => o.groupId !== null)
  @IsString()
  groupId?: string | null
}
