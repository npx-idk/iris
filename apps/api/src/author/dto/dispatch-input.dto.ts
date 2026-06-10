import { IsString, IsOptional, IsNumber, IsInt } from 'class-validator'

export class DispatchInputDto {
  @IsString()
  type!: string  // mousePressed | mouseReleased | mouseMoved | mouseWheel | keyDown | keyUp | char

  @IsOptional() @IsNumber() x?: number
  @IsOptional() @IsNumber() y?: number
  @IsOptional() @IsString() button?: string
  @IsOptional() @IsInt() clickCount?: number
  @IsOptional() @IsNumber() deltaX?: number
  @IsOptional() @IsNumber() deltaY?: number
  @IsOptional() @IsString() key?: string
  @IsOptional() @IsString() text?: string
  @IsOptional() @IsString() code?: string
  @IsOptional() @IsInt() modifiers?: number
  @IsOptional() @IsInt() windowsVirtualKeyCode?: number
}
