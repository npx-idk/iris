import { IsString, IsOptional } from 'class-validator'

export class NewTabDto {
  @IsOptional()
  @IsString()
  url?: string
}
