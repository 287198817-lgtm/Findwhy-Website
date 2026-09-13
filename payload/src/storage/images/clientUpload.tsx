'use client'

import { createClientUploadHandler } from '@payloadcms/plugin-cloud-storage/client'
import { formatAdminURL } from 'payload/shared'

export const ImagesRoutingClientUploadHandler = createClientUploadHandler({
  handler: async ({ apiRoute, collectionSlug, docPrefix, file, serverHandlerPath, serverURL, updateFilename }) => {
    const endpoint = formatAdminURL({ apiRoute, path: serverHandlerPath, serverURL })
    const response = await fetch(endpoint, {
      body: JSON.stringify({ collectionSlug, docPrefix, filename: file.name, filesize: file.size, mimeType: file.type }),
      credentials: 'include',
      method: 'POST',
    })
    if (!response.ok) throw new Error('Unable to authorize the OSS image upload.')
    const result = await response.json() as { docPrefix?: string; filename?: string; url: string }
    if (result.filename && result.filename !== file.name) updateFilename(result.filename)
    const upload = await fetch(result.url, {
      body: file,
      headers: { 'Content-Length': String(file.size), 'Content-Type': file.type },
      method: 'PUT',
    })
    if (!upload.ok) throw new Error(`OSS upload failed with HTTP ${upload.status}.`)
    return { prefix: result.docPrefix, storageProvider: 'aliyun-oss' }
  },
})
