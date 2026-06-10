import { io, type Socket } from "socket.io-client"

/**
 * Connects to the API's `/sessions` WebSocket namespace, which streams live
 * browser frames and run/authoring events for one run or authoring session.
 */
export function createSessionSocket(sessionId: string): Socket {
  return io(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/sessions`,
    { query: { runId: sessionId }, withCredentials: true }
  )
}
