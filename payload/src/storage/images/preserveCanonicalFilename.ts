import type { CollectionBeforeOperationHook } from 'payload'

import { resolveImageStorageEnvironment } from './key'
import { isTrustedImageUploadContext } from './uploadContext'

/** Keep the signed filename and namespace canonical before Payload generates upload file data. */
export const preserveCanonicalImageFilename: CollectionBeforeOperationHook = ({
  args,
  operation,
  req,
}) => {
  if (
    process.env.ENABLE_IMAGES_STORAGE_ROUTER !== 'true' ||
    (operation !== 'create' && operation !== 'update') ||
    !req.file
  ) {
    return args
  }

  const documentID = 'id' in args && args.id != null ? String(args.id) : undefined
  const context = req.file.clientUploadContext as { filename?: unknown; oldPrefix?: unknown }
  const canonicalFilename = typeof context?.filename === 'string' ? context.filename : undefined
  if (
    (operation === 'update' && !documentID) ||
    !canonicalFilename ||
    !isTrustedImageUploadContext({
      context,
      documentID,
      filename: canonicalFilename,
      oldPrefix: typeof context.oldPrefix === 'string' ? context.oldPrefix : undefined,
      operation: operation === 'create' ? 'create' : 'replacement',
      secret: process.env.PAYLOAD_SECRET || '',
      storageEnvironment: resolveImageStorageEnvironment(process.env.IMAGES_STORAGE_ENV),
    })
  )
    return args

  req.file.name = canonicalFilename
  const data = 'data' in args && args.data && typeof args.data === 'object' ? args.data : {}
  return {
    ...args,
    data: { ...data, prefix: (req.file.clientUploadContext as { prefix: string }).prefix },
    ...(operation === 'update' ? { overwriteExistingFiles: true } : {}),
  }
}
