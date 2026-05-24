import { IsString } from 'class-validator'

export class AddPrerequisiteDto {
  @IsString()
  prerequisiteId!: string
}
