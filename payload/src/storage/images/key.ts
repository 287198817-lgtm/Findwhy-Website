import { getFileKey } from '@payloadcms/plugin-cloud-storage/utilities'

export const IMAGES_STORAGE_PREFIX = 'images'

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
