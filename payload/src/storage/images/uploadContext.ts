import { createHmac, timingSafeEqual } from 'node:crypto'

import type { ImageStorageEnvironment } from './key'
import { isImageUploadNamespace } from './key'

export type ImageClientUploadContext = {
  documentID?: string
  operation: 'create' | 'replacement'
  prefix: string
  signature: string
  storageEnvironment: ImageStorageEnvironment
  storageProvider: 'aliyun-oss'
}

const signaturePayload = ({
  documentID,
  filename,
  operation,
  prefix,
  storageEnvironment,
}: Pick<ImageClientUploadContext, 'documentID' | 'operation' | 'prefix' | 'storageEnvironment'> & {
  filename: string
}) => `${storageEnvironment}\0${operation}\0${documentID || ''}\0${prefix}\0${filename}`

export const signImageUploadContext = ({
  documentID,
  filename,
  operation,
  prefix,
  secret,
  storageEnvironment,
}: Pick<ImageClientUploadContext, 'documentID' | 'operation' | 'prefix' | 'storageEnvironment'> & {
  filename: string
  secret: string
}) =>
  createHmac('sha256', secret)
    .update(signaturePayload({ documentID, filename, operation, prefix, storageEnvironment }))
    .digest('hex')

export const isTrustedImageUploadContext = ({
  context,
  documentID,
  filename,
  operation,
  secret,
  storageEnvironment,
}: {
  context: unknown
  documentID?: string
  filename: string
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
    (candidate.operation === 'create' && candidate.documentID !== undefined) ||
    (candidate.operation === 'replacement' && typeof candidate.documentID !== 'string') ||
    !isImageUploadNamespace({ environment: storageEnvironment, prefix }) ||
    typeof prefix !== 'string' ||
    typeof candidate.signature !== 'string'
  )
    return false
  const expected = signImageUploadContext({
    documentID: candidate.documentID,
    filename,
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
