import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import * as Minio from 'minio'

const BUCKET = process.env.MINIO_BUCKET ?? 'iris'
const PUBLIC_URL = (process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000').replace(/\/$/, '')

@Injectable()
export class ArtifactsService implements OnModuleInit {
  private readonly logger = new Logger(ArtifactsService.name)
  private readonly client: Minio.Client

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    })
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(BUCKET)
      if (!exists) {
        await this.client.makeBucket(BUCKET)
        this.logger.log(`Created MinIO bucket: ${BUCKET}`)
      }
      // Public-read so browsers can fetch images directly without proxying
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET}/*`],
        }],
      })
      await this.client.setBucketPolicy(BUCKET, policy)
    } catch (err) {
      this.logger.error('MinIO init failed — artifacts will not be saved', err)
    }
  }

  async saveScreenshot(runId: string, stepIndex: number, jpegBase64: string): Promise<string> {
    const key = `runs/${runId}/screenshots/step-${String(stepIndex).padStart(3, '0')}.jpg`
    const buf = Buffer.from(jpegBase64, 'base64')
    await this.client.putObject(BUCKET, key, buf, buf.length, { 'Content-Type': 'image/jpeg' })
    return `${PUBLIC_URL}/${BUCKET}/${key}`
  }

  async saveFrame(runId: string, frameIndex: number, jpegBase64: string): Promise<void> {
    const key = `runs/${runId}/frames/frame-${String(frameIndex).padStart(6, '0')}.jpg`
    const buf = Buffer.from(jpegBase64, 'base64')
    await this.client.putObject(BUCKET, key, buf, buf.length, { 'Content-Type': 'image/jpeg' })
  }

  async saveBrowserEvents(runId: string, events: { network: unknown[]; console: unknown[] }): Promise<void> {
    const key = `runs/${runId}/events.json`
    const buf = Buffer.from(JSON.stringify(events))
    await this.client.putObject(BUCKET, key, buf, buf.length, { 'Content-Type': 'application/json' })
  }

  async getBrowserEvents(runId: string): Promise<{ network: unknown[]; console: unknown[] } | null> {
    try {
      const stream = await this.client.getObject(BUCKET, `runs/${runId}/events.json`)
      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', resolve)
        stream.on('error', reject)
      })
      return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
    } catch { return null }
  }

  async listFrames(runId: string): Promise<string[]> {
    const prefix = `runs/${runId}/frames/`
    const keys: string[] = []
    await new Promise<void>((resolve, reject) => {
      const stream = this.client.listObjectsV2(BUCKET, prefix, true)
      stream.on('data', (obj: Minio.BucketItem) => { if (obj.name) keys.push(obj.name) })
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    keys.sort()
    return keys.map((k) => `${PUBLIC_URL}/${BUCKET}/${k}`)
  }
}
