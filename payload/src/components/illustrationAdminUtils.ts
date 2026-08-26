import type { ClientUploadHandler } from './clientMediaUpload'
import { createMediaDocument } from './clientMediaUpload'

export type ImageDocument = {
  id: number | string
  filename?: string | null
  thumbnailURL?: string | null
  url?: string | null
}

type CollectionResponse<T> = {
  docs: T[]
}

export const filenameToAlt = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()

export const filenameToSlug = (filename: string) => {
  const normalized = filename
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'illustration'
}

export const responseError = async (response: Response, fallback: string) => {
  const result = (await response.json().catch(() => null)) as
    | { errors?: Array<{ message?: string }>; message?: string }
    | null
  return result?.errors?.[0]?.message || result?.message || fallback
}

export const findOrCreateImage = async (file: File, uploadHandler: ClientUploadHandler | null) => {
  const duplicateQuery = new URLSearchParams({
    depth: '0',
    limit: '1',
    'where[filename][equals]': file.name,
  })
  const duplicateResponse = await fetch(`/api/images?${duplicateQuery}`, { credentials: 'include' })

  if (!duplicateResponse.ok) throw new Error('Unable to check the media library.')

  const duplicateResult = (await duplicateResponse.json()) as CollectionResponse<ImageDocument>
  if (duplicateResult.docs[0]) {
    return { document: duplicateResult.docs[0], reused: true }
  }

  const uploadResponse = await createMediaDocument({
    collectionSlug: 'images',
    data: {
      alt: filenameToAlt(file.name) || file.name,
      metadata: { copyright: '© Findwhy' },
    },
    file,
    uploadHandler,
  })

  if (!uploadResponse.ok) {
    throw new Error(await responseError(uploadResponse, 'Image upload failed.'))
  }

  const result = (await uploadResponse.json()) as { doc: ImageDocument }
  return { document: result.doc, reused: false }
}

export const getUniqueIllustrationSlug = async (filename: string) => {
  const baseSlug = filenameToSlug(filename)
  let candidate = baseSlug
  let suffix = 2

  while (true) {
    const query = new URLSearchParams({
      depth: '0',
      limit: '1',
      'where[slug][equals]': candidate,
    })
    const response = await fetch(`/api/illustrations?${query}`, { credentials: 'include' })
    if (!response.ok) throw new Error('Unable to generate a unique slug.')
    const result = (await response.json()) as CollectionResponse<unknown>
    if (result.docs.length === 0) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

export const getNextIllustrationOrder = async () => {
  const query = new URLSearchParams({ depth: '0', limit: '1', sort: '-order' })
  const response = await fetch(`/api/illustrations?${query}`, { credentials: 'include' })
  if (!response.ok) throw new Error('Unable to calculate the next order.')
  const result = (await response.json()) as CollectionResponse<{ order?: number | null }>
  return Number(result.docs[0]?.order ?? 0) + 1
}
