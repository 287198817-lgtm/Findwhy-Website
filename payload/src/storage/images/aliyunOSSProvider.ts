import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { encodeStorageKey, getImageStorageKey } from './key'
import type { ImageStorageProvider } from './types'

type AliyunOSSProviderOptions = {
  accessKeyId: string
  bucket: string
  endpoint: string
  publicBaseURL: string
  region: string
  secretAccessKey: string
}

export type SignedImageUpload = {
  key: string
  url: string
}

export const createAliyunOSSImageProvider = (
  options: AliyunOSSProviderOptions,
): ImageStorageProvider & {
  createSignedUpload: (args: {
    contentLength: number
    docPrefix?: null | string
    filename: string
    mimeType: string
  }) => Promise<SignedImageUpload>
  readFile: (args: {
    docPrefix?: null | string
    filename: string
    headers?: Headers
  }) => Promise<Response>
} => {
  const client = new S3Client({
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    endpoint: options.endpoint,
    forcePathStyle: false,
    region: options.region,
  })
  const publicBaseURL = options.publicBaseURL.replace(/\/+$/, '')

  return {
    name: 'aliyun-oss',
    generateURL: ({ docPrefix, filename }) => {
      const key = getImageStorageKey({ docPrefix, filename })
      return `${publicBaseURL}/${encodeStorageKey(key)}`
    },
    uploadFile: async ({ docPrefix, file }) => {
      const key = getImageStorageKey({ docPrefix, filename: file.filename })
      await client.send(new PutObjectCommand({
        Body: file.buffer,
        Bucket: options.bucket,
        ContentLength: file.buffer.length,
        ContentType: file.mimeType,
        Key: key,
      }))
    },
    deleteFile: async ({ docPrefix, filename }) => {
      const key = getImageStorageKey({ docPrefix, filename })
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }))
    },
    createSignedUpload: async ({ contentLength, docPrefix, filename, mimeType }) => {
      const key = getImageStorageKey({ docPrefix, filename })
      const url = await getSignedUrl(client, new PutObjectCommand({
        Bucket: options.bucket,
        ContentLength: contentLength,
        ContentType: mimeType,
        Key: key,
      }), { expiresIn: 600 })
      return { key, url }
    },
    readFile: ({ docPrefix, filename, headers }) => {
      const key = getImageStorageKey({ docPrefix, filename })
      return fetch(`${publicBaseURL}/${encodeStorageKey(key)}`, { headers })
    },
  }
}
