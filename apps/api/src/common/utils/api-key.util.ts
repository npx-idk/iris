import { createHash, randomBytes } from 'crypto';

const PREFIX = 'iris_';

export function generateApiKey(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const secret = randomBytes(32).toString('hex');
  const raw = `${PREFIX}${secret}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12); // "iris_" + 7 chars shown in UI
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
