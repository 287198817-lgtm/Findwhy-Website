import { getFileKey } from '@payloadcms/plugin-cloud-storage/utilities'
import { randomBytes } from 'node:crypto'

export const IMAGES_STORAGE_PREFIX = 'images'
export const IMAGE_STORAGE_ENVIRONMENTS = ['production', 'preview', 'local'] as const
export type ImageStorageEnvironment = (typeof IMAGE_STORAGE_ENVIRONMENTS)[number]

export const resolveImageStorageEnvironment = (value: unknown): ImageStorageEnvironment => {
  if (IMAGE_STORAGE_ENVIRONMENTS.includes(value as ImageStorageEnvironment)) {
    return value as ImageStorageEnvironment
  }
  throw new Error('IMAGES_STORAGE_ENV must be production, preview, or local.')
}

/** 16 random bytes provide 128 bits of entropy (the requirement is >= 96 bits). */
export const createImageUploadID = () => randomBytes(16).toString('hex')

export const createImageUploadNamespace = ({
  environment,
  uploadID = createImageUploadID(),
}: {
  environment: ImageStorageEnvironment
  uploadID?: string
}) => {
  if (!/^[a-f\d]{24,}$/i.test(uploadID)) {
    throw new Error('Image upload IDs must contain at least 96 bits of hexadecimal entropy.')
  }
  return `${IMAGES_STORAGE_PREFIX}/${environment}/${uploadID.toLowerCase()}`
}

export const isImageUploadNamespace = ({
  environment,
  prefix,
}: {
  environment: ImageStorageEnvironment
  prefix: unknown
}) => typeof prefix === 'string' &&
  new RegExp(`^${IMAGES_STORAGE_PREFIX}/${environment}/[a-f\\d]{24,}$`, 'i').test(prefix)

export const getImageStorageKey = ({
  docPrefix,
  filename,
}: {
  docPrefix?: null | string
  filename: string
}) => getFileKey({
  collectionPrefix: IMAGES_STORAGE_PREFIX,
  docPrefix: docPrefix || undefined,
  filename,
  useCompositePrefixes: false,
}).fileKey

export const encodeStorageKey = (key: string) =>
  key.split('/').map(encodeURIComponent).join('/')
