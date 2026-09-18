import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { env } from '../env.js';

/**
 * Media storage.
 *
 * An interface with a local-disk driver for tests and development and an
 * S3-compatible driver for everything deployed. The driver never sees an
 * original filename: keys are random, because a file called
 * `al-sajaa-yard-shelf-3.jpg` identifies a supplier just as effectively as the
 * EXIF that was stripped out of it.
 */

export interface StoredObject {
  readonly key: string;
  readonly url: string;
  readonly bytes: number;
}

export interface MediaStore {
  put(body: Buffer, contentType: string, extension: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
}

/** A random key, sharded two levels deep so no directory grows unbounded. */
export function randomKey(extension: string): string {
  const id = randomBytes(16).toString('hex');
  return `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.${extension.replace(/^\./, '')}`;
}

class LocalDiskStore implements MediaStore {
  constructor(
    private readonly root: string,
    private readonly baseUrl: string,
  ) {}

  async put(body: Buffer, _contentType: string, extension: string): Promise<StoredObject> {
    const key = randomKey(extension);
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, url: this.urlFor(key), bytes: body.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(join(this.root, key));
  }

  async delete(key: string): Promise<void> {
    await unlink(join(this.root, key)).catch(() => {});
  }

  urlFor(key: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/${key}`;
  }
}

/**
 * S3-compatible store.
 *
 * Signed with SigV4 directly rather than through the AWS SDK: the SDK is a large
 * dependency for four verbs, and this keeps the deployment portable across S3,
 * R2 and the region-pinned bucket the UAE's data-residency expectations require.
 */
class S3Store implements MediaStore {
  constructor(
    private readonly endpoint: string,
    private readonly region: string,
    private readonly bucket: string,
    private readonly accessKey: string,
    private readonly secretKey: string,
    private readonly publicBaseUrl: string,
  ) {}

  async put(body: Buffer, contentType: string, extension: string): Promise<StoredObject> {
    const key = randomKey(extension);
    await this.signedRequest('PUT', key, body, contentType);
    return { key, url: this.urlFor(key), bytes: body.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.signedRequest('GET', key);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await this.signedRequest('DELETE', key);
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  private async signedRequest(method: string, key: string, body?: Buffer, contentType?: string): Promise<Response> {
    const url = new URL(`${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256').update(body ?? Buffer.alloc(0)).digest('hex');

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType !== undefined) headers['content-type'] = contentType;

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((h) => `${h}:${headers[h]}\n`)
      .join('');
    const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const { createHmac } = await import('node:crypto');
    const sign = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest();
    const signingKey = sign(sign(sign(sign(`AWS4${this.secretKey}`, dateStamp), this.region), 's3'), 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const res = await fetch(url, {
      method,
      body,
      headers: {
        ...headers,
        Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    });
    if (!res.ok) throw new Error(`media store ${method} failed: ${res.status} ${await res.text()}`);
    return res;
  }
}

let store: MediaStore | null = null;

export function getMediaStore(): MediaStore {
  if (store !== null) return store;
  const e = env();
  if (e.MEDIA_DRIVER === 's3') {
    const missing = (['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const).filter(
      (k) => e[k] === undefined || e[k] === '',
    );
    if (missing.length > 0) throw new Error(`MEDIA_DRIVER=s3 but missing: ${missing.join(', ')}`);
    store = new S3Store(e.S3_ENDPOINT!, e.S3_REGION!, e.S3_BUCKET!, e.S3_ACCESS_KEY!, e.S3_SECRET_KEY!, e.MEDIA_PUBLIC_BASE_URL);
  } else {
    store = new LocalDiskStore(e.MEDIA_LOCAL_DIR, e.MEDIA_PUBLIC_BASE_URL);
  }
  return store;
}

export function setMediaStore(next: MediaStore | null): void {
  store = next;
}
