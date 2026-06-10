import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { auth } from './auth';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = await auth.api.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    // Attach user to request for use in controllers
    request.user = session.user;
    return true;
  }
}
