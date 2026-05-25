import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator'

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string
}
