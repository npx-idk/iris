import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common"
import { BrowserSession } from "./browser-session"

/** In-memory registry of live authoring browser sessions, keyed by session id. */
@Injectable()
export class SessionRegistry {
  private sessions = new Map<string, BrowserSession>()

  /** Returns the session or throws; enforces that it belongs to `userId`. */
  get(sessionId: string, userId: string): BrowserSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new NotFoundException("Authoring session not found")
    if (session.userId !== userId) throw new ForbiddenException()
    return session
  }

  /** Non-throwing lookup without the ownership check. */
  peek(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId)
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  set(sessionId: string, session: BrowserSession): void {
    this.sessions.set(sessionId, session)
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}
