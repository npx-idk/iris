import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
} from "class-validator"

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
  @IsInt()
  @Min(240)
  @Max(3840)
  viewportWidth?: number

  @IsOptional()
  @IsInt()
  @Min(240)
  @Max(2160)
  viewportHeight?: number

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
