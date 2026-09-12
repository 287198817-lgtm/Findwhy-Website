import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config as loadEnvironment } from 'dotenv'
import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

import {
  createOSSPrototypeStorage,
  getOSSPrototypePublicURL,
  OSS_PROTOTYPE_PREFIX,
} from '../src/storage/ossPrototype'

loadEnvironment({ path: '.env.local' })

const TEST_PREFIX = `${OSS_PROTOTYPE_PREFIX}/`

type GeneratedFile = {
  body: Buffer
  contentType: string
  height: number
  key: string
  label: string
  width: number
}

const requiredEnvironment = [
  'ALIYUN_OSS_ACCESS_KEY_ID',
  'ALIYUN_OSS_ACCESS_KEY_SECRET',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_ENDPOINT',
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_PUBLIC_BASE_URL',
] as const

const argument = (name: string) => {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')

const bodyBuffer = async (
  body: Awaited<ReturnType<S3Client['send']>> extends never ? never : unknown,
) => {
  if (!body || typeof body !== 'object' || !('transformToByteArray' in body)) {
    throw new Error('OSS GetObject returned no readable body.')
  }
  const bytes = await (
    body as { transformToByteArray: () => Promise<Uint8Array> }
  ).transformToByteArray()
  return Buffer.from(bytes)
}

const output = (event: string, details: Record<string, unknown> = {}) => {
  process.stdout.write(`${JSON.stringify({ event, ...details })}\n`)
}

const safeErrorDetails = (error: unknown) => {
  const candidate = error as {
    $metadata?: { httpStatusCode?: number; requestId?: string }
    Code?: string
    code?: string
    message?: string
    name?: string
  }
  return {
    code: candidate.Code || candidate.code,
    httpStatusCode: candidate.$metadata?.httpStatusCode,
    message: candidate.message || 'Unknown failure.',
    name: candidate.name,
    requestId: candidate.$metadata?.requestId,
  }
}

const ossResponseError = async (response: Response) => {
  const body = await response.text()
  const field = (name: string) =>
    body.match(new RegExp(`<${name}>([^<]*)</${name}>`, 'i'))?.[1] || undefined
  return {
    code: field('Code'),
    message: field('Message') || `HTTP ${response.status}`,
    requestId: field('RequestId') || response.headers.get('x-oss-request-id') || undefined,
    status: response.status,
  }
}

const main = async () => {
  const execute = process.argv.includes('--execute')
  const missing = requiredEnvironment.filter((name) => !process.env[name])

  output('configuration', {
    bucket: process.env.ALIYUN_OSS_BUCKET || 'findwhy-assets',
    endpoint: process.env.ALIYUN_OSS_ENDPOINT || 'https://oss-cn-shanghai.aliyuncs.com',
    execute,
    forcePathStyle: false,
    missing,
    prefix: TEST_PREFIX,
    publicBaseURL: process.env.ALIYUN_OSS_PUBLIC_BASE_URL || 'https://img.findwhy.art',
    region: process.env.ALIYUN_OSS_REGION || 'cn-shanghai',
  })

  if (!execute) {
    output('dry-run', {
      message: 'No network writes performed. Pass --execute and --source=<path>.',
    })
    return
  }
  if (missing.length > 0)
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)

  createOSSPrototypeStorage()

  const sourcePath = argument('source')
  if (!sourcePath) throw new Error('--source=<path> is required in execute mode.')
  const source = await readFile(path.resolve(sourcePath))
  if (source.length <= 4.5 * 1024 * 1024)
    throw new Error('Prototype source must be larger than 4.5 MiB.')

  const bucket = process.env.ALIYUN_OSS_BUCKET!
  const runID = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(6).toString('hex')}`
  const runPrefix = `${TEST_PREFIX}${runID}/`
  const createdKeys: string[] = []
  const validationFailures: string[] = []
  const client = new S3Client({
    credentials: {
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET!,
    },
    endpoint: process.env.ALIYUN_OSS_ENDPOINT!,
    forcePathStyle: false,
    region: process.env.ALIYUN_OSS_REGION!,
  })

  const put = async (file: GeneratedFile) => {
    if (!file.key.startsWith(TEST_PREFIX))
      throw new Error(`Refusing unsafe object key: ${file.key}`)
    createdKeys.push(file.key)
    await client.send(
      new PutObjectCommand({
        Body: file.body,
        Bucket: bucket,
        ContentType: file.contentType,
        Key: file.key,
      }),
    )
    output('put-object', { bytes: file.body.length, key: file.key, label: file.label })
  }

  try {
    output('head-bucket-start')
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      output('head-bucket', { ok: true })
    } catch (error) {
      validationFailures.push('HeadBucket')
      output('head-bucket', { ok: false, ...safeErrorDetails(error) })
    }

    const originalKey = `${runPrefix}original.jpg`
    const signedCommand = new PutObjectCommand({
      Bucket: bucket,
      ContentType: 'image/jpeg',
      Key: originalKey,
    })
    const signedURL = await getSignedUrl(client, signedCommand, { expiresIn: 600 })
    output('signed-put-url', { expiresIn: 600, generated: true, key: originalKey })
    createdKeys.push(originalKey)

    const origin = argument('origin')
    if (origin) {
      const preflight = await fetch(signedURL, {
        headers: {
          'Access-Control-Request-Headers': 'content-type',
          'Access-Control-Request-Method': 'PUT',
          Origin: origin,
        },
        method: 'OPTIONS',
      })
      output('cors-preflight', {
        allowHeaders: preflight.headers.get('access-control-allow-headers'),
        allowMethods: preflight.headers.get('access-control-allow-methods'),
        allowOrigin: preflight.headers.get('access-control-allow-origin'),
        ok: preflight.ok,
        status: preflight.status,
      })
      if (!preflight.ok || preflight.headers.get('access-control-allow-origin') !== origin) {
        throw new Error('OSS CORS preflight did not allow the requested Admin origin.')
      }
    }

    const signedPut = await fetch(signedURL, {
      body: source,
      headers: { 'Content-Type': 'image/jpeg' },
      method: 'PUT',
    })
    if (!signedPut.ok) {
      const details = await ossResponseError(signedPut)
      output('signed-put', { ok: false, ...details })
      throw new Error(`Signed PUT failed: ${details.code || details.status} ${details.message}`)
    }
    output('signed-put', {
      bytes: source.length,
      etag: signedPut.headers.get('etag'),
      status: signedPut.status,
    })

    const originalHead = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: originalKey }),
    )
    output('head-object', {
      contentLength: originalHead.ContentLength,
      contentType: originalHead.ContentType,
      etag: originalHead.ETag,
      key: originalKey,
    })

    const originalGet = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: originalKey }),
    )
    const fetchedOriginal = await bodyBuffer(originalGet.Body)
    if (sha256(fetchedOriginal) !== sha256(source))
      throw new Error('Fetched original checksum mismatch.')
    output('get-object', { bytes: fetchedOriginal.length, checksumMatch: true, key: originalKey })

    const sourceMetadata = await sharp(fetchedOriginal).metadata()
    const thumbnailResult = await sharp(fetchedOriginal)
      .rotate()
      .resize({ fit: 'inside', height: 480, width: 480, withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true })
    const cardResult = await sharp(fetchedOriginal)
      .rotate()
      .toColourspace('srgb')
      .resize({ fit: 'inside', height: 1200, width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    const portfolioResult = await sharp(fetchedOriginal)
      .rotate()
      .toColourspace('srgb')
      .resize({ fit: 'inside', height: 2400, width: 2400, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })

    const generated: GeneratedFile[] = [
      {
        body: thumbnailResult.data,
        contentType: 'image/jpeg',
        height: thumbnailResult.info.height,
        key: `${runPrefix}thumbnail.jpg`,
        label: 'thumbnail',
        width: thumbnailResult.info.width,
      },
      {
        body: cardResult.data,
        contentType: 'image/webp',
        height: cardResult.info.height,
        key: `${runPrefix}card.webp`,
        label: 'card',
        width: cardResult.info.width,
      },
      {
        body: portfolioResult.data,
        contentType: 'image/webp',
        height: portfolioResult.info.height,
        key: `${runPrefix}portfolio.webp`,
        label: 'portfolio',
        width: portfolioResult.info.width,
      },
    ]

    output('sharp-source', {
      bytes: source.length,
      format: sourceMetadata.format,
      height: sourceMetadata.height,
      orientation: sourceMetadata.orientation,
      width: sourceMetadata.width,
    })

    for (const file of generated) {
      await put(file)
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: file.key }))
      if (head.ContentLength !== file.body.length || head.ContentType !== file.contentType) {
        throw new Error(`${file.label} metadata mismatch after upload.`)
      }
      const url = getOSSPrototypePublicURL({ filename: file.key.slice(TEST_PREFIX.length) })
      const response = await fetch(url)
      if (!response.ok)
        throw new Error(`${file.label} public URL returned HTTP ${response.status}.`)
      output('public-url', {
        contentType: response.headers.get('content-type'),
        label: file.label,
        status: response.status,
        url,
      })
    }

    output('sharp-complete', {
      files: generated.map(({ body, contentType, height, key, label, width }) => ({
        bytes: body.length,
        contentType,
        height,
        key,
        label,
        width,
      })),
    })
    if (validationFailures.length > 0) {
      throw new Error(`Validation failed: ${validationFailures.join(', ')}`)
    }
  } finally {
    const cleanupFailures: Array<{ key: string; message: string }> = []
    for (const key of [...createdKeys].reverse()) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        output('delete-object', { key, ok: true })
      } catch (error) {
        cleanupFailures.push({
          key,
          message: error instanceof Error ? error.message : 'Delete failed.',
        })
      }
    }

    for (const key of createdKeys) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        cleanupFailures.push({ key, message: 'Object still exists after cleanup.' })
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode
        if (status !== 404) cleanupFailures.push({ key, message: 'Unable to verify deletion.' })
      }
    }
    output('cleanup', { failures: cleanupFailures, orphanCount: cleanupFailures.length })
    client.destroy()
    if (cleanupFailures.length > 0) process.exitCode = 1
  }
}

await main().catch((error) => {
  output('fatal', safeErrorDetails(error))
  process.exitCode = 1
})
