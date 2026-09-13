import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { initClientUploads, resolveSignedURLKey } from '@payloadcms/plugin-cloud-storage/utilities'
import type {
  CollectionAfterChangeHook,
  CollectionAfterErrorHook,
  Config,
  PayloadRequest,
} from 'payload'
import { APIError, Forbidden } from 'payload'

import { createAliyunOSSImageProvider } from './aliyunOSSProvider'
import { createImageUploadNamespace, resolveImageStorageEnvironment } from './key'
import { createImageStorageRouter, createImagesRoutingAdapter } from './routingAdapter'
import { isTrustedImageUploadContext, signImageUploadContext } from './uploadContext'
import type { ImageClientUploadContext } from './uploadContext'
import { createVercelBlobImageProvider } from './vercelBlobProvider'

export const IMAGE_UPLOAD_CONTEXT_TTL_MS = 30 * 60 * 1000

export const compensateFailedImageReplacement = async ({
  cleanupNamespace,
  context,
  currentPrefix,
  payloadSecret,
  storageEnvironment,
}: {
  cleanupNamespace: (prefix: string) => Promise<void>
  context: unknown
  currentPrefix?: null | string
  payloadSecret: string
  storageEnvironment: ReturnType<typeof resolveImageStorageEnvironment>
}) => {
  const candidate = context as Partial<ImageClientUploadContext> | undefined
  if (
    !candidate ||
    candidate.operation !== 'replacement' ||
    typeof candidate.documentID !== 'string' ||
    typeof candidate.filename !== 'string' ||
    typeof candidate.oldPrefix !== 'string' ||
    !isTrustedImageUploadContext({
      context: candidate,
      documentID: candidate.documentID,
      filename: candidate.filename,
      oldPrefix: candidate.oldPrefix,
      operation: 'replacement',
      secret: payloadSecret,
      storageEnvironment,
      validateExpiration: false,
    }) ||
    currentPrefix === candidate.prefix
  )
    return false

  await cleanupNamespace(candidate.prefix!)
  return true
}

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when Images storage routing is enabled.`)
  return value
}

const readJSON = async (req: PayloadRequest) => {
  if (!req.json) throw new APIError('Content-Type must be application/json.', 400)
  return (await req.json()) as {
    collectionSlug?: string
    docPrefix?: string
    filename?: string
    filesize?: number
    mimeType?: string
    documentID?: string
    oldPrefix?: string
    operation?: 'create' | 'replacement'
  }
}

export const getSkippedPreviousNamespaceFilenames = ({
  doc,
  previousDoc,
}: {
  doc: Record<string, unknown>
  previousDoc: Record<string, unknown>
}) => {
  if (previousDoc.prefix === doc.prefix) return []
  const docSizes = (doc.sizes || {}) as Record<string, { filename?: null | string }>
  const previousSizes = (previousDoc.sizes || {}) as Record<string, { filename?: null | string }>
  const newFilenames = new Set<string>(
    [doc.filename, ...Object.values(docSizes).map((size) => size?.filename)].filter(
      (value): value is string => typeof value === 'string',
    ),
  )
  return [
    previousDoc.filename,
    ...Object.values(previousSizes).map((size) => size?.filename),
  ].filter((value): value is string => typeof value === 'string' && newFilenames.has(value))
}

export const imagesRoutingStorage =
  () =>
  (incomingConfig: Config): Config => {
    const storageEnvironment = resolveImageStorageEnvironment(required('IMAGES_STORAGE_ENV'))
    const payloadSecret = required('PAYLOAD_SECRET')
    const oss = createAliyunOSSImageProvider({
      accessKeyId: required('ALIYUN_OSS_ACCESS_KEY_ID'),
      bucket: required('ALIYUN_OSS_BUCKET'),
      endpoint: required('ALIYUN_OSS_ENDPOINT'),
      publicBaseURL: required('ALIYUN_OSS_PUBLIC_BASE_URL'),
      region: required('ALIYUN_OSS_REGION'),
      secretAccessKey: required('ALIYUN_OSS_ACCESS_KEY_SECRET'),
    })
    const blob = createVercelBlobImageProvider({ token: required('BLOB_READ_WRITE_TOKEN') })
    const collections = { images: { prefix: 'images' } }
    const routingOptions = {
      activeUploadProvider: 'aliyun-oss' as const,
      providers: { 'aliyun-oss': oss, 'vercel-blob': blob },
      readClientUpload: ({
        context,
        filename,
        headers,
        prefix,
      }: {
        context: unknown
        filename: string
        headers?: Headers
        prefix?: string
      }) => {
        if (
          !isTrustedImageUploadContext({
            context,
            filename,
            secret: payloadSecret,
            storageEnvironment,
          })
        ) {
          throw new APIError('Unknown Images client upload provider.', 400)
        }
        return oss.readFile({
          docPrefix: (context as ImageClientUploadContext).prefix || prefix,
          filename,
          headers,
        })
      },
    }
    const router = createImageStorageRouter(routingOptions)

    initClientUploads({
      clientHandler: '/storage/images/clientUpload#ImagesRoutingClientUploadHandler',
      collections,
      config: incomingConfig,
      enabled: true,
      serverHandlerPath: '/images-routing-signed-upload',
      serverHandler: async (req) => {
        if (!req.user) throw new Forbidden()
        const body = await readJSON(req)
        if (
          body.collectionSlug !== 'images' ||
          !body.filename ||
          !body.mimeType ||
          typeof body.filesize !== 'number' ||
          body.filesize <= 0 ||
          (body.operation !== 'create' && body.operation !== 'replacement') ||
          (body.operation === 'create' && body.documentID !== undefined) ||
          (body.operation === 'create' && body.oldPrefix !== undefined) ||
          (body.operation === 'replacement' && (!body.documentID || !body.oldPrefix))
        ) {
          throw new APIError('Invalid Images upload request.', 400)
        }
        if (body.operation === 'replacement') {
          const oldPrefix = body.oldPrefix!
          const existing = await req.payload.findByID({
            collection: 'images',
            id: body.documentID!,
            overrideAccess: false,
            req,
          })
          if (
            existing.storageProvider !== 'aliyun-oss' ||
            existing.prefix !== oldPrefix ||
            !oldPrefix.startsWith(`images/${storageEnvironment}/`)
          ) {
            throw new APIError('Invalid Images replacement source namespace.', 400)
          }
        }
        const uploadNamespace = createImageUploadNamespace({ environment: storageEnvironment })
        if (body.operation === 'replacement' && uploadNamespace === body.oldPrefix) {
          throw new APIError('Images replacement must rotate its storage namespace.', 500)
        }
        const resolved = await resolveSignedURLKey({
          collectionPrefix: 'images',
          collectionSlug: 'images',
          docPrefix: uploadNamespace,
          filename: body.filename,
          req,
          useCompositePrefixes: false,
        })
        const signed = await oss.createSignedUpload({
          contentLength: body.filesize,
          docPrefix: resolved.sanitizedDocPrefix,
          filename: resolved.sanitizedFilename,
          mimeType: body.mimeType,
        })
        const issuedAt = Date.now()
        const expiresAt = issuedAt + IMAGE_UPLOAD_CONTEXT_TTL_MS
        return Response.json({
          docPrefix: resolved.sanitizedDocPrefix,
          filename: resolved.sanitizedFilename,
          signature: signImageUploadContext({
            documentID: body.documentID,
            expiresAt,
            filename: resolved.sanitizedFilename,
            issuedAt,
            oldPrefix: body.oldPrefix,
            operation: body.operation,
            prefix: resolved.sanitizedDocPrefix,
            secret: payloadSecret,
            storageEnvironment,
          }),
          storageEnvironment,
          documentID: body.documentID,
          expiresAt,
          issuedAt,
          oldPrefix: body.oldPrefix,
          operation: body.operation,
          url: signed.url,
        })
      },
    })

    const configured = cloudStoragePlugin({
      collections: {
        images: {
          adapter: createImagesRoutingAdapter(routingOptions),
          disablePayloadAccessControl: true,
          prefix: 'images',
        },
      },
      useCompositePrefixes: false,
    })(incomingConfig)

    // Payload skips deleting a previous file when the new display filename is identical.
    // With namespaced keys, identical filenames in different prefixes are distinct objects.
    const deleteSkippedPreviousNamespaceFiles: CollectionAfterChangeHook = async ({
      doc,
      operation,
      previousDoc,
      req,
    }) => {
      if (operation !== 'update' || !req.file || !previousDoc || previousDoc.prefix === doc.prefix)
        return doc
      await Promise.all(
        getSkippedPreviousNamespaceFilenames({ doc, previousDoc }).map((filename) =>
          router.deleteFile(previousDoc, filename),
        ),
      )
      return doc
    }

    const compensateFailedClientReplacement: CollectionAfterErrorHook = async ({ req }) => {
      const context = req.file?.clientUploadContext as Partial<ImageClientUploadContext> | undefined
      if (!context || typeof context.documentID !== 'string') return

      const current = await req.payload.findByID({
        collection: 'images',
        id: context.documentID,
        overrideAccess: true,
        req,
      })
      await compensateFailedImageReplacement({
        cleanupNamespace: oss.cleanupNamespace,
        context,
        currentPrefix: current.prefix,
        payloadSecret,
        storageEnvironment,
      })
    }

    return {
      ...configured,
      collections: configured.collections?.map((collection) =>
        collection.slug === 'images'
          ? {
              ...collection,
              hooks: {
                ...collection.hooks,
                afterError: [
                  ...(collection.hooks?.afterError || []),
                  compensateFailedClientReplacement,
                ],
                afterChange: [
                  ...(collection.hooks?.afterChange || []),
                  deleteSkippedPreviousNamespaceFiles,
                ],
              },
            }
          : collection,
      ),
    }
  }
