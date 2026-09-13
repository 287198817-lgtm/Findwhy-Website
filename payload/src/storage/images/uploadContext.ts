import { createHmac, timingSafeEqual } from 'node:crypto'

import type { ImageStorageEnvironment } from './key'
import { isImageUploadNamespace } from './key'

export type ImageClientUploadContext = {
  documentID?: string
  expiresAt: number
  filename: string
  issuedAt: number
  oldPrefix?: string
  operation: 'create' | 'replacement'
  prefix: string
  signature: string
  storageEnvironment: ImageStorageEnvironment
  storageProvider: 'aliyun-oss'
}

const signaturePayload = ({
  documentID,
  expiresAt,
  filename,
  issuedAt,
  oldPrefix,
  operation,
  prefix,
  storageEnvironment,
}: Pick<
  ImageClientUploadContext,
  | 'documentID'
  | 'expiresAt'
  | 'filename'
  | 'issuedAt'
  | 'oldPrefix'
  | 'operation'
  | 'prefix'
  | 'storageEnvironment'
>) =>
  `${storageEnvironment}\0aliyun-oss\0${operation}\0${documentID || ''}\0${oldPrefix || ''}\0${prefix}\0${filename}\0${issuedAt}\0${expiresAt}`

export const signImageUploadContext = ({
  documentID,
  expiresAt,
  filename,
  issuedAt,
  oldPrefix,
  operation,
  prefix,
  secret,
  storageEnvironment,
}: Pick<
  ImageClientUploadContext,
  | 'documentID'
  | 'expiresAt'
  | 'filename'
  | 'issuedAt'
  | 'oldPrefix'
  | 'operation'
  | 'prefix'
  | 'storageEnvironment'
> & {
  secret: string
}) =>
  createHmac('sha256', secret)
    .update(
      signaturePayload({
        documentID,
        expiresAt,
        filename,
        issuedAt,
        oldPrefix,
        operation,
        prefix,
        storageEnvironment,
      }),
    )
    .digest('hex')

export const isTrustedImageUploadContext = ({
  context,
  documentID,
  filename,
  now = Date.now(),
  oldPrefix,
  operation,
  secret,
  storageEnvironment,
  validateExpiration = true,
}: {
  context: unknown
  documentID?: string
  filename: string
  now?: number
  oldPrefix?: string
  operation?: ImageClientUploadContext['operation']
  secret: string
  storageEnvironment: ImageStorageEnvironment
  validateExpiration?: boolean
}): boolean => {
  if (!context || typeof context !== 'object') return false
  const candidate = context as Partial<ImageClientUploadContext>
  const prefix = candidate.prefix
  if (
    candidate.storageProvider !== 'aliyun-oss' ||
    candidate.storageEnvironment !== storageEnvironment ||
    candidate.filename !== filename ||
    typeof candidate.issuedAt !== 'number' ||
    typeof candidate.expiresAt !== 'number' ||
    (validateExpiration && (candidate.issuedAt > now || candidate.expiresAt <= now)) ||
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
    expiresAt: candidate.expiresAt,
    filename,
    issuedAt: candidate.issuedAt,
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
