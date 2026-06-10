import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator'

export class CreateTestDto {
  @IsString()
  name!: string

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
}
