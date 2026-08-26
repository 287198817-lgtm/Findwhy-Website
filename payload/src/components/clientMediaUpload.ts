export type ClientUploadHandler = (args: {
  docPrefix?: string
  file: File
  updateFilename: (filename: string) => void
}) => Promise<unknown>

const naturalFileNameCompare = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
}).compare

export const sortFilesNaturally = (files: File[]) =>
  [...files].sort((first, second) => naturalFileNameCompare(first.name, second.name))

type CreateMediaDocumentArgs = {
  collectionSlug: 'images' | 'videos'
  data: Record<string, unknown>
  file: File
  uploadHandler: ClientUploadHandler | null
}

/**
 * Uses Payload's registered storage-adapter client upload handler when available.
 * The original file is uploaded by that handler directly to cloud storage; the
 * subsequent Payload request contains metadata only. Local development without
 * a configured adapter intentionally falls back to Payload's local upload flow.
 */
export const createMediaDocument = async ({
  collectionSlug,
  data,
  file,
  uploadHandler,
}: CreateMediaDocumentArgs) => {
  const formData = new FormData()
  let uploadFile: File | string = file

  if (uploadHandler) {
    let filename = file.name
    const clientUploadContext = await uploadHandler({
      file,
      updateFilename: (nextFilename) => {
        filename = nextFilename
      },
    })

    uploadFile = JSON.stringify({
      clientUploadContext,
      collectionSlug,
      filename,
      mimeType: file.type,
      size: file.size,
    })
  }

  formData.append('file', uploadFile)
  formData.append('_payload', JSON.stringify(data))

  return fetch(`/api/${collectionSlug}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
}

export const deleteMediaDocument = async (
  collectionSlug: 'images' | 'videos',
  id: number | string,
) => fetch(`/api/${collectionSlug}/${encodeURIComponent(String(id))}`, {
  method: 'DELETE',
  credentials: 'include',
})
