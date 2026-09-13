export const IMAGE_STORAGE_PROVIDERS = ['vercel-blob', 'aliyun-oss'] as const

export type ImageStorageProviderName = (typeof IMAGE_STORAGE_PROVIDERS)[number]

export type ImageStorageDocument = {
  id?: number | string
  prefix?: null | string
  storageProvider?: ImageStorageProviderName | null | string
}

export type ImageStorageFile = {
  buffer: Buffer
  filename: string
  mimeType: string
}

export type ImageStorageOperation = 'delete' | 'generate-url' | 'upload'

export type ImageStorageProvider = {
  deleteFile: (args: { docPrefix?: null | string; filename: string }) => Promise<void>
  generateURL: (args: { docPrefix?: null | string; filename: string }) => string
  name: ImageStorageProviderName
  uploadFile: (args: { docPrefix?: null | string; file: ImageStorageFile }) => Promise<void>
}

export class ImageStorageOperationError extends Error {
  readonly details: {
    collection: 'images'
    documentID?: number | string
    filename: string
    operation: ImageStorageOperation
    provider: string
  }

  constructor(
    details: ImageStorageOperationError['details'],
    options?: { cause?: unknown },
  ) {
    super(`Image storage ${details.operation} failed for provider ${details.provider}.`, options)
    this.name = 'ImageStorageOperationError'
    this.details = details
  }
}
