import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { initClientUploads, resolveSignedURLKey } from '@payloadcms/plugin-cloud-storage/utilities'
import type { Config, PayloadRequest } from 'payload'
import { APIError, Forbidden } from 'payload'

import { createAliyunOSSImageProvider } from './aliyunOSSProvider'
import { createImagesRoutingAdapter } from './routingAdapter'
import { createVercelBlobImageProvider } from './vercelBlobProvider'

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when Images storage routing is enabled.`)
  return value
}

const readJSON = async (req: PayloadRequest) => {
  if (!req.json) throw new APIError('Content-Type must be application/json.', 400)
  return await req.json() as {
    collectionSlug?: string
    docPrefix?: string
    filename?: string
    filesize?: number
    mimeType?: string
  }
}

export const imagesRoutingStorage = () => (incomingConfig: Config): Config => {
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

  initClientUploads({
    clientHandler: '/storage/images/clientUpload#ImagesRoutingClientUploadHandler',
    collections,
    config: incomingConfig,
    enabled: true,
    serverHandlerPath: '/images-routing-signed-upload',
    serverHandler: async (req) => {
      if (!req.user) throw new Forbidden()
      const body = await readJSON(req)
      if (body.collectionSlug !== 'images' || !body.filename || !body.mimeType ||
        typeof body.filesize !== 'number' || body.filesize <= 0) {
        throw new APIError('Invalid Images upload request.', 400)
      }
      const resolved = await resolveSignedURLKey({
        collectionPrefix: 'images',
        collectionSlug: 'images',
        docPrefix: body.docPrefix,
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
      return Response.json({
        docPrefix: resolved.sanitizedDocPrefix,
        filename: resolved.sanitizedFilename,
        url: signed.url,
      })
    },
  })

  return cloudStoragePlugin({
    collections: {
      images: {
        adapter: createImagesRoutingAdapter({
          activeUploadProvider: 'aliyun-oss',
          providers: { 'aliyun-oss': oss, 'vercel-blob': blob },
          readClientUpload: ({ context, filename, headers, prefix }) => {
            if (!context || typeof context !== 'object' ||
              !('storageProvider' in context) || context.storageProvider !== 'aliyun-oss') {
              throw new APIError('Unknown Images client upload provider.', 400)
            }
            const contextPrefix = 'prefix' in context && typeof context.prefix === 'string'
              ? context.prefix
              : prefix
            return oss.readFile({ docPrefix: contextPrefix, filename, headers })
          },
        }),
        disablePayloadAccessControl: true,
        prefix: 'images',
      },
    },
    useCompositePrefixes: false,
  })(incomingConfig)
}
