import type { CollectionBeforeValidateHook } from 'payload'

const isOSSUploadContext = (value: unknown) =>
  Boolean(value && typeof value === 'object' &&
    'storageProvider' in value && value.storageProvider === 'aliyun-oss')

export const assignImageStorageProvider: CollectionBeforeValidateHook = ({ data, operation, originalDoc, req }) => {
  if (process.env.ENABLE_IMAGES_STORAGE_ROUTER !== 'true' || !data) return data

  if (isOSSUploadContext(req.file?.clientUploadContext)) {
    data.storageProvider = 'aliyun-oss'
  } else if (operation === 'update') {
    data.storageProvider = originalDoc?.storageProvider ?? null
  } else {
    delete data.storageProvider
  }
  return data
}
