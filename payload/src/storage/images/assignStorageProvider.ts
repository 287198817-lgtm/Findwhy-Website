import type { CollectionBeforeValidateHook } from 'payload'

import {
  createImageUploadNamespace,
  resolveImageStorageEnvironment,
} from './key'
import { isTrustedImageUploadContext } from './uploadContext'
import type { ImageClientUploadContext } from './uploadContext'

export const assignImageStorageProvider: CollectionBeforeValidateHook = ({ data, operation, originalDoc, req }) => {
  if (process.env.ENABLE_IMAGES_STORAGE_ROUTER !== 'true' || !data) return data

  const storageEnvironment = resolveImageStorageEnvironment(process.env.IMAGES_STORAGE_ENV)
  const secret = process.env.PAYLOAD_SECRET || ''
  const clientContext = req.file?.clientUploadContext
  if (req.file && isTrustedImageUploadContext({
    context: clientContext,
    filename: req.file.name,
    secret,
    storageEnvironment,
  })) {
    data.storageProvider = 'aliyun-oss'
    data.prefix = (clientContext as ImageClientUploadContext).prefix
  } else if (req.file && !clientContext) {
    // Server-side uploads receive the same collision-safe namespace.
    data.storageProvider = 'aliyun-oss'
    data.prefix = createImageUploadNamespace({ environment: storageEnvironment })
  } else if (operation === 'update') {
    data.storageProvider = originalDoc?.storageProvider ?? null
    data.prefix = originalDoc?.prefix
  } else {
    delete data.storageProvider
    delete data.prefix
  }
  return data
}
