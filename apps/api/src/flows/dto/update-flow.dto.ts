import { IsString, IsOptional, MinLength, IsArray } from 'class-validator'

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string

  @IsOptional()
  @IsArray()
  nodes?: object[]

  @IsOptional()
  @IsArray()
  edges?: object[]
}
