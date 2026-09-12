import { s3Storage } from '@payloadcms/storage-s3'
import path from 'node:path'

export const OSS_PROTOTYPE_PREFIX = '__payload-oss-test'
export const OSS_PHASE1B_PREFIX = `${OSS_PROTOTYPE_PREFIX}/phase1b`

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the OSS prototype.`)
  return value
}

export const getOSSPrototypePublicURL = ({
  filename,
  prefix = '',
}: {
  filename: string
  prefix?: string
}) => {
  const key = path.posix.join(OSS_PROTOTYPE_PREFIX, prefix, filename)
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${required('ALIYUN_OSS_PUBLIC_BASE_URL').replace(/\/+$/, '')}/${encodedKey}`
}

/** Isolated Phase 1A configuration; deliberately not registered in payload.config.ts. */
export const createOSSPrototypeStorage = () =>
  s3Storage({
    bucket: required('ALIYUN_OSS_BUCKET'),
    clientUploads: true,
    collections: {
      images: {
        disablePayloadAccessControl: true,
        generateFileURL: ({ filename, prefix }) => getOSSPrototypePublicURL({ filename, prefix }),
        prefix: OSS_PROTOTYPE_PREFIX,
      },
    },
    config: {
      credentials: {
        accessKeyId: required('ALIYUN_OSS_ACCESS_KEY_ID'),
        secretAccessKey: required('ALIYUN_OSS_ACCESS_KEY_SECRET'),
      },
      endpoint: required('ALIYUN_OSS_ENDPOINT'),
      forcePathStyle: false,
      region: required('ALIYUN_OSS_REGION'),
    },
    useCompositePrefixes: true,
  })

export const createOSSPhase1BStorage = () =>
  s3Storage({
    bucket: required('ALIYUN_OSS_BUCKET'),
    clientUploads: true,
    collections: {
      'oss-test-images': {
        disablePayloadAccessControl: true,
        generateFileURL: ({ filename, prefix = '' }: { filename: string; prefix?: string }) => {
          const key = path.posix.join(OSS_PHASE1B_PREFIX, prefix, filename)
          const encodedKey = key.split('/').map(encodeURIComponent).join('/')
          return `${required('ALIYUN_OSS_PUBLIC_BASE_URL').replace(/\/+$/, '')}/${encodedKey}`
        },
        prefix: OSS_PHASE1B_PREFIX,
      },
    } as Parameters<typeof s3Storage>[0]['collections'],
    config: {
      credentials: {
        accessKeyId: required('ALIYUN_OSS_ACCESS_KEY_ID'),
        secretAccessKey: required('ALIYUN_OSS_ACCESS_KEY_SECRET'),
      },
      endpoint: required('ALIYUN_OSS_ENDPOINT'),
      forcePathStyle: false,
      region: required('ALIYUN_OSS_REGION'),
    },
    useCompositePrefixes: true,
  })
