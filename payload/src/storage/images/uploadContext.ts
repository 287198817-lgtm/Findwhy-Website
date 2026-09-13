import { createHmac, timingSafeEqual } from 'node:crypto'

import type { ImageStorageEnvironment } from './key'
import { isImageUploadNamespace } from './key'

export type ImageClientUploadContext = {
  documentID?: string
  oldPrefix?: string
  operation: 'create' | 'replacement'
  prefix: string
  signature: string
  storageEnvironment: ImageStorageEnvironment
  storageProvider: 'aliyun-oss'
}

const signaturePayload = ({
  documentID,
  filename,
  oldPrefix,
  operation,
  prefix,
  storageEnvironment,
}: Pick<
  ImageClientUploadContext,
  'documentID' | 'oldPrefix' | 'operation' | 'prefix' | 'storageEnvironment'
> & {
  filename: string
}) =>
  `${storageEnvironment}\0aliyun-oss\0${operation}\0${documentID || ''}\0${oldPrefix || ''}\0${prefix}\0${filename}`

export const signImageUploadContext = ({
  documentID,
  filename,
  oldPrefix,
  operation,
  prefix,
  secret,
  storageEnvironment,
}: Pick<
  ImageClientUploadContext,
  'documentID' | 'oldPrefix' | 'operation' | 'prefix' | 'storageEnvironment'
> & {
  filename: string
  secret: string
}) =>
  createHmac('sha256', secret)
    .update(
      signaturePayload({ documentID, filename, oldPrefix, operation, prefix, storageEnvironment }),
    )
    .digest('hex')

export const isTrustedImageUploadContext = ({
  context,
  documentID,
  filename,
  oldPrefix,
  operation,
  secret,
  storageEnvironment,
}: {
  context: unknown
  documentID?: string
  filename: string
  oldPrefix?: string
  operation?: ImageClientUploadContext['operation']
  secret: string
  storageEnvironment: ImageStorageEnvironment
}): boolean => {
  if (!context || typeof context !== 'object') return false
  const candidate = context as Partial<ImageClientUploadContext>
  const prefix = candidate.prefix
  if (
    candidate.storageProvider !== 'aliyun-oss' ||
    candidate.storageEnvironment !== storageEnvironment ||
    (candidate.operation !== 'create' && candidate.operation !== 'replacement') ||
    (operation && candidate.operation !== operation) ||
    (typeof documentID === 'string' && candidate.documentID !== documentID) ||
    (typeof oldPrefix === 'string' && candidate.oldPrefix !== oldPrefix) ||
    (candidate.operation === 'create' && candidate.documentID !== undefined) ||
    (candidate.operation === 'create' && candidate.oldPrefix !== undefined) ||
    (candidate.operation === 'replacement' && typeof candidate.documentID !== 'string') ||
    (candidate.operation === 'replacement' && typeof candidate.oldPrefix !== 'string') ||
    (candidate.operation === 'replacement' && candidate.oldPrefix === prefix) ||
    !isImageUploadNamespace({ environment: storageEnvironment, prefix }) ||
    typeof prefix !== 'string' ||
    typeof candidate.signature !== 'string'
  )
    return false
  const expected = signImageUploadContext({
    documentID: candidate.documentID,
    filename,
    oldPrefix: candidate.oldPrefix,
    operation: candidate.operation,
    prefix,
    secret,
    storageEnvironment,
  })
  const actualBuffer = Buffer.from(candidate.signature)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  )
}
