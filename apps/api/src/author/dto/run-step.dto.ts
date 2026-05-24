import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator'

export class RunStepDto {
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
