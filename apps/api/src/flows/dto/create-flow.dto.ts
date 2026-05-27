import { IsString, MinLength } from 'class-validator'

export class CreateFlowDto {
  @IsString()
  @MinLength(1)
  name!: string
}
