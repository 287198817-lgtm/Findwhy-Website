import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import type { PayloadRequest } from 'payload'

import type {
  ImageStorageDocument,
  ImageStorageFile,
  ImageStorageOperation,
  ImageStorageProvider,
  ImageStorageProviderName,
} from './types'
import { ImageStorageOperationError } from './types'

type ProviderMap = Record<ImageStorageProviderName, ImageStorageProvider>

type RoutingAdapterOptions = {
  activeUploadProvider: ImageStorageProviderName
  providers: ProviderMap
  readClientUpload: (args: {
    context: unknown
    filename: string
    headers?: Headers
    prefix?: string
  }) => Promise<Response>
}

type UploadState = {
  cleanupStarted: boolean
  failed: unknown
  queue: Promise<void>
  uploaded: string[]
}

const uploadStateKey = '_findwhyImagesStorageUpload'

const getUploadState = (req: PayloadRequest, originalFilename?: null | string): UploadState => {
  const context = (req.context ||= {}) as Record<string, unknown>
  const existing = context[uploadStateKey] as UploadState | undefined
  if (existing) return existing
  const state: UploadState = {
    cleanupStarted: false,
    failed: null,
    queue: Promise.resolve(),
    uploaded: originalFilename ? [originalFilename] : [],
  }
  context[uploadStateKey] = state
  return state
}

const isKnownProvider = (value: unknown): value is ImageStorageProviderName =>
  value === 'vercel-blob' || value === 'aliyun-oss'

/** Existing null ownership is intentionally treated as legacy Vercel Blob. */
export const resolveStoredImageProvider = (
  value: ImageStorageDocument['storageProvider'],
): ImageStorageProviderName => {
  if (value === null || typeof value === 'undefined' || value === '') return 'vercel-blob'
  if (isKnownProvider(value)) return value
  throw new Error(`Unknown image storage provider: ${String(value)}`)
}

const wrapStorageError = ({
  cause,
  doc,
  filename,
  operation,
  provider,
}: {
  cause: unknown
  doc: ImageStorageDocument
  filename: string
  operation: ImageStorageOperation
  provider: string
}) => new ImageStorageOperationError({
  collection: 'images',
  documentID: doc.id,
  filename,
  operation,
  provider,
}, { cause })

export const createImageStorageRouter = ({
  activeUploadProvider,
  providers,
}: RoutingAdapterOptions) => {
  const providerForStoredDocument = (doc: ImageStorageDocument) => {
    const name = resolveStoredImageProvider(doc.storageProvider)
    return providers[name]
  }

  return {
    activeUploadProvider,

    generateURL: (doc: ImageStorageDocument, filename: string) => {
      let providerName = String(doc.storageProvider ?? 'vercel-blob')
      try {
        const provider = providerForStoredDocument(doc)
        providerName = provider.name
        return provider.generateURL({ docPrefix: doc.prefix, filename })
      } catch (cause) {
        throw wrapStorageError({ cause, doc, filename, operation: 'generate-url', provider: providerName })
      }
    },

    deleteFile: async (doc: ImageStorageDocument, filename: string) => {
      let providerName = String(doc.storageProvider ?? 'vercel-blob')
      try {
        const provider = providerForStoredDocument(doc)
        providerName = provider.name
        await provider.deleteFile({ docPrefix: doc.prefix, filename })
      } catch (cause) {
        throw wrapStorageError({ cause, doc, filename, operation: 'delete', provider: providerName })
      }
    },

    uploadFile: async (doc: ImageStorageDocument, file: ImageStorageFile) => {
      const providerName = doc.storageProvider == null || doc.storageProvider === ''
        ? activeUploadProvider
        : resolveStoredImageProvider(doc.storageProvider)
      const provider = providers[providerName]

      try {
        await provider.uploadFile({ docPrefix: doc.prefix, file })
        return providerName
      } catch (cause) {
        throw wrapStorageError({
          cause,
          doc,
          filename: file.filename,
          operation: 'upload',
          provider: providerName,
        })
      }
    },
  }
}

/**
 * Payload adapter shape for the future coexistence rollout. Phase 2A deliberately
 * does not register it, so the current Images client upload remains Vercel Blob.
 * Phase 2B must add the authenticated client-upload endpoint before registration.
 */
export const createImagesRoutingAdapter = (options: RoutingAdapterOptions): Adapter =>
  () => {
    const router = createImageStorageRouter(options)

    return {
      name: 'findwhy-images-routing',
      clientUploads: true,
      generateURL: ({ data, filename }) => router.generateURL(data, filename),
      handleDelete: ({ doc, filename }) => router.deleteFile(doc, filename),
      handleUpload: async ({ data, file, req }) => {
        const state = getUploadState(req, data.filename)
        const upload = state.queue.then(async () => {
          if (state.failed) throw state.failed
          try {
            const storageProvider = await router.uploadFile(data, file)
            data.storageProvider = storageProvider
            state.uploaded.push(file.filename)
          } catch (cause) {
            state.failed = cause
            if (!state.cleanupStarted) {
              state.cleanupStarted = true
              const results = await Promise.allSettled(
                [...new Set(state.uploaded)].map((filename) => router.deleteFile(data, filename)),
              )
              const cleanupFailure = results.find((result) => result.status === 'rejected')
              if (cleanupFailure?.status === 'rejected') {
                throw new AggregateError(
                  [cause, cleanupFailure.reason],
                  'Upload and compensation both failed.',
                )
              }
            }
            throw cause
          }
        })
        state.queue = upload.catch(() => undefined)
        await upload
      },
      staticHandler: (_req, { headers, params }) => options.readClientUpload({
        context: params.clientUploadContext,
        filename: params.filename,
        headers,
        prefix: params.prefix,
      }),
    }
  }

export const replaceImageFiles = async ({
  cleanupNext,
  deletePrevious,
  nextFiles,
  uploadNext,
}: {
  cleanupNext?: () => Promise<void>
  deletePrevious: () => Promise<void>
  nextFiles: ImageStorageFile[]
  uploadNext: (file: ImageStorageFile) => Promise<void>
}) => {
  try {
    await Promise.all(nextFiles.map(uploadNext))
  } catch (cause) {
    if (cleanupNext) {
      try {
        await cleanupNext()
      } catch (cleanupCause) {
        throw new AggregateError([cause, cleanupCause], 'Replacement upload and compensation both failed.')
      }
    }
    throw cause
  }
  await deletePrevious()
}
