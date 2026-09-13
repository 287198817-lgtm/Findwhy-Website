import type { CollectionBeforeOperationHook } from 'payload'

import { resolveImageStorageEnvironment } from './key'
import { isTrustedImageUploadContext } from './uploadContext'

/**
 * Payload checks filename collisions before beforeValidate assigns the new upload prefix.
 * A same-name replacement therefore sees its own previous record and increments the name.
 * A trusted replacement already has an isolated namespace, so retaining its signed filename
 * cannot overwrite the previous object and keeps the document and object key canonical.
 */
export const preserveCanonicalImageFilename: CollectionBeforeOperationHook = ({
  args,
  operation,
  req,
}) => {
  if (process.env.ENABLE_IMAGES_STORAGE_ROUTER !== 'true' || operation !== 'update' || !req.file) {
    return args
  }

  const documentID = 'id' in args && args.id != null ? String(args.id) : undefined
  if (
    !documentID ||
    !isTrustedImageUploadContext({
      context: req.file.clientUploadContext,
      documentID,
      filename: req.file.name,
      oldPrefix:
        typeof (req.file.clientUploadContext as { oldPrefix?: unknown })?.oldPrefix === 'string'
          ? (req.file.clientUploadContext as { oldPrefix: string }).oldPrefix
          : undefined,
      operation: 'replacement',
      secret: process.env.PAYLOAD_SECRET || '',
      storageEnvironment: resolveImageStorageEnvironment(process.env.IMAGES_STORAGE_ENV),
    })
  )
    return args

  return { ...args, overwriteExistingFiles: true }
}
