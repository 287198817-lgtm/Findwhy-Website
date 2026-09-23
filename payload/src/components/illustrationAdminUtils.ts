import type { ClientUploadHandler } from './clientMediaUpload'
import { createMediaDocument, deleteMediaDocument } from './clientMediaUpload'

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

export const findOrCreateImage = async (
  file: File,
  uploadHandler: ClientUploadHandler | null,
  onImageCreated?: () => void,
  onOriginalUploadComplete?: () => void,
) => {
  const uploadResponse = await createMediaDocument({
    collectionSlug: 'images',
    data: {
      alt: filenameToAlt(file.name) || file.name,
      metadata: { copyright: '© Findwhy' },
    },
    file,
    onOriginalUploadComplete,
    uploadHandler,
  })

  if (!uploadResponse.ok) {
    const error = new Error(await responseError(uploadResponse, 'Image upload failed.')) as Error & {
      status?: number
    }
    error.status = uploadResponse.status
    throw error
  }

  const result = (await uploadResponse.json()) as { doc: ImageDocument }
  onImageCreated?.()
  return { document: result.doc, reused: false }
}

export const createIllustrationFromFile = async (
  file: File,
  uploadHandler: ClientUploadHandler | null,
  callbacks: {
    onImageCreated?: () => void
    onOriginalUploadComplete?: () => void
  } = {},
) => {
  const { document } = await findOrCreateImage(
    file,
    uploadHandler,
    callbacks.onImageCreated,
    callbacks.onOriginalUploadComplete,
  )
  const response = await fetch('/api/illustrations', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft: false, image: document.id }),
  })

  if (response.ok) return response

  const status = response.status
  const message = await responseError(response, 'Unable to create Illustration.')
  const cleanupResponse = await deleteMediaDocument('images', document.id)
  const cleanupMessage = cleanupResponse.ok
    ? ''
    : ` Image cleanup failed: ${await responseError(cleanupResponse, 'unknown cleanup error')}`
  const error = new Error(`${message}${cleanupMessage}`) as Error & { status?: number }
  error.status = cleanupResponse.ok ? status : cleanupResponse.status
  throw error
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
