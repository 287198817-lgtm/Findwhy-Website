import { createHmac, timingSafeEqual } from 'node:crypto'

import type { ImageStorageEnvironment } from './key'
import { isImageUploadNamespace } from './key'

export type ImageClientUploadContext = {
  prefix: string
  signature: string
  storageEnvironment: ImageStorageEnvironment
  storageProvider: 'aliyun-oss'
}

const signaturePayload = ({
  filename,
  prefix,
  storageEnvironment,
}: Pick<ImageClientUploadContext, 'prefix' | 'storageEnvironment'> & { filename: string }) =>
  `${storageEnvironment}\0${prefix}\0${filename}`

export const signImageUploadContext = ({
  filename,
  prefix,
  secret,
  storageEnvironment,
}: Pick<ImageClientUploadContext, 'prefix' | 'storageEnvironment'> & {
  filename: string
  secret: string
}) => createHmac('sha256', secret)
  .update(signaturePayload({ filename, prefix, storageEnvironment }))
  .digest('hex')

export const isTrustedImageUploadContext = ({
  context,
  filename,
  secret,
  storageEnvironment,
}: {
  context: unknown
  filename: string
  secret: string
  storageEnvironment: ImageStorageEnvironment
}): boolean => {
  if (!context || typeof context !== 'object') return false
  const candidate = context as Partial<ImageClientUploadContext>
  const prefix = candidate.prefix
  if (candidate.storageProvider !== 'aliyun-oss' ||
    candidate.storageEnvironment !== storageEnvironment ||
    !isImageUploadNamespace({ environment: storageEnvironment, prefix }) ||
    typeof prefix !== 'string' ||
    typeof candidate.signature !== 'string') return false
  const expected = signImageUploadContext({
    filename,
    prefix,
    secret,
    storageEnvironment,
  })
  const actualBuffer = Buffer.from(candidate.signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}
