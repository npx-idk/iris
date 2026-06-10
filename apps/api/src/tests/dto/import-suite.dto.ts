import {
  IsString, IsNotEmpty, IsOptional, IsBoolean,
  IsArray, IsInt, ValidateNested, IsObject,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ImportStepDto {
  @IsInt()
  stepIndex!: number

  @IsString()
  @IsNotEmpty()
  instruction!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>
}

export class ImportTestDto {
  @IsString()
  @IsNotEmpty()
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

  @IsOptional()
  @IsBoolean()
  continueOnFailure?: boolean

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStepDto)
  steps!: ImportStepDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisiteNames?: string[]
}

export class ImportSuiteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTestDto)
  tests!: ImportTestDto[]
}
