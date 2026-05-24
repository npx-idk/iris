import { IsString } from 'class-validator'

export class NavigateDto {
  @IsString()
  url!: string
}
