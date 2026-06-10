import * as dotenv from "dotenv"

dotenv.config()

const int = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? "", 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

/**
 * All environment configuration for the API, read once at startup.
 * Plain object (not a Nest provider) so module-level consumers — gateway
 * decorators, better-auth setup — can use it too.
 */
export const env = {
  port: int(process.env.PORT, 3000),
  webUrl: process.env.WEB_URL ?? "http://localhost:3001",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  /** Spread into createStagehand / runTest / explorePage configs. */
  stagehand: {
    env: (process.env.BROWSER_ENV ?? "LOCAL") as "LOCAL" | "BROWSERBASE",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
    browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
  },

  minio: {
    endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: int(process.env.MINIO_PORT, 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    bucket: process.env.MINIO_BUCKET ?? "iris",
    publicUrl: (
      process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000"
    ).replace(/\/$/, ""),
  },
} as const

/** WebSocket URL the web app connects to for live browser frames of a LOCAL run. */
export const localLiveViewUrl = (sessionId: string): string =>
  `ws://localhost:${env.port}/sessions/${sessionId}/stream`
