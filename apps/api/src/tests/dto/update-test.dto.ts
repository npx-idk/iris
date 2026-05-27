import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator'

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
  @IsString()
  folderId?: string | null
}
