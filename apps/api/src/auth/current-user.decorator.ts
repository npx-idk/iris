import { createParamDecorator, ExecutionContext } from "@nestjs/common"

/** Shape of the authenticated user that AuthGuard / ApiKeyGuard put on the request. */
export interface RequestUser {
  id: string
  email: string
  name: string
  image?: string | null
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | null => {
    const request = ctx.switchToHttp().getRequest()
    return request.user ?? null
  }
)
