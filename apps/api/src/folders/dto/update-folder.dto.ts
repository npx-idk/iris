import { IsString, MinLength, IsOptional } from 'class-validator'
import { ValidateIf } from 'class-validator'

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string

  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsString()
  parentId?: string | null
}
