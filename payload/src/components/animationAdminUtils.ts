import type { ClientUploadHandler } from './clientMediaUpload'
import { createMediaDocument, deleteMediaDocument } from './clientMediaUpload'
import { findOrCreateImage } from './illustrationAdminUtils'
import { generateVideoPosterFile } from './videoPosterClient'

export type VideoDocument = {
  id: number | string
  filename?: string | null
  poster?: ImageRelationship
  url?: string | null
}

type ImageRelationship = { id: number | string; url?: string | null } | number | string | null | undefined

type CollectionResponse<T> = { docs: T[] }

export const relationshipID = (value: ImageRelationship) => {
  if (value && typeof value === 'object') return value.id
  return value
}

const filenameToAlt = (filename: string) =>
  filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()

export const responseError = async (response: Response, fallback: string) => {
  const result = (await response.json().catch(() => null)) as
    | { errors?: Array<{ message?: string }>; message?: string }
    | null
  return result?.errors?.[0]?.message || result?.message || fallback
}

const attachPoster = async (video: VideoDocument, posterID: number | string) => {
  const response = await fetch(`/api/videos/${encodeURIComponent(String(video.id))}?depth=1`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ poster: posterID }),
  })
  if (!response.ok) throw new Error(await responseError(response, 'Unable to link the video poster.'))
  const result = (await response.json()) as { doc: VideoDocument }
  return result.doc
}

const removeCreatedPoster = async (id: number | string) => {
  const response = await deleteMediaDocument('images', id)
  if (!response.ok && response.status !== 404) {
    throw new Error(await responseError(response, 'Unable to roll back the generated poster.'))
  }
}

export const findOrCreateVideo = async (
  file: File,
  videoUploadHandler: ClientUploadHandler | null,
  imageUploadHandler: ClientUploadHandler | null,
) => {
  const duplicateQuery = new URLSearchParams({
    depth: '1',
    limit: '1',
    'where[filename][equals]': file.name,
  })
  const duplicateResponse = await fetch(`/api/videos?${duplicateQuery}`, { credentials: 'include' })
  if (!duplicateResponse.ok) throw new Error('Unable to check the video library.')
  const duplicateResult = (await duplicateResponse.json()) as CollectionResponse<VideoDocument>
  let document = duplicateResult.docs[0]
  const reused = Boolean(document)
  if (document?.poster) return { document, posterWarning: null, reused }

  let posterCreated = false
  let posterDocument: { id: number | string } | null = null
  let posterWarning: string | null = null

  try {
    const posterFile = await generateVideoPosterFile(file)
    const posterResult = await findOrCreateImage(posterFile, imageUploadHandler)
    posterDocument = posterResult.document
    posterCreated = !posterResult.reused
  } catch (error) {
    posterWarning = error instanceof Error ? error.message : 'Poster generation failed.'
  }

  if (!document) {
    const uploadResponse = await createMediaDocument({
      collectionSlug: 'videos',
      data: {
        alt: filenameToAlt(file.name) || file.name,
        poster: posterDocument?.id,
      },
      file,
      uploadHandler: videoUploadHandler,
    })
    if (!uploadResponse.ok) {
      if (posterCreated && posterDocument) await removeCreatedPoster(posterDocument.id)
      throw new Error(await responseError(uploadResponse, 'Video upload failed.'))
    }
    const result = (await uploadResponse.json()) as { doc: VideoDocument }
    document = result.doc
  } else if (posterDocument) {
    try {
      document = await attachPoster(document, posterDocument.id)
    } catch (error) {
      if (posterCreated) await removeCreatedPoster(posterDocument.id)
      posterWarning = error instanceof Error ? error.message : 'Unable to link the video poster.'
    }
  }

  return { document, posterWarning, reused }
}

export const getNextAnimationOrder = async () => {
  const query = new URLSearchParams({ depth: '0', limit: '1', sort: '-order' })
  const response = await fetch(`/api/animations?${query}`, { credentials: 'include' })
  if (!response.ok) throw new Error('Unable to calculate the next order.')
  const result = (await response.json()) as CollectionResponse<{ order?: number | null }>
  return Number(result.docs[0]?.order ?? 0) + 1
}
