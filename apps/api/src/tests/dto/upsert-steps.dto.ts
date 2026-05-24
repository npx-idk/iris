import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsInt, IsObject } from 'class-validator'
import { Type } from 'class-transformer'

export class AgentStepDto {
  @IsOptional()
  @IsString()
  id?: string

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

export class UpsertStepsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentStepDto)
  steps!: AgentStepDto[]
}
