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

const refreshPoster = async (video: VideoDocument) => {
  const response = await fetch(`/api/videos/${encodeURIComponent(String(video.id))}?depth=1`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alt: video.filename ? filenameToAlt(video.filename) : undefined }),
  })
  if (!response.ok) throw new Error(await responseError(response, 'Unable to generate video poster.'))
  const result = (await response.json()) as { doc: VideoDocument }
  return result.doc
}

export const findOrCreateVideo = async (file: File) => {
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

  if (!document) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('_payload', JSON.stringify({ alt: filenameToAlt(file.name) || file.name }))
    const uploadResponse = await fetch('/api/videos?depth=1', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (!uploadResponse.ok) throw new Error(await responseError(uploadResponse, 'Video upload failed.'))
    const result = (await uploadResponse.json()) as { doc: VideoDocument }
    document = result.doc
  }

  if (!document.poster) document = await refreshPoster(document)
  if (!document.poster) throw new Error('Video saved, but poster generation failed.')

  return { document, reused }
}

export const getNextAnimationOrder = async () => {
  const query = new URLSearchParams({ depth: '0', limit: '1', sort: '-order' })
  const response = await fetch(`/api/animations?${query}`, { credentials: 'include' })
  if (!response.ok) throw new Error('Unable to calculate the next order.')
  const result = (await response.json()) as CollectionResponse<{ order?: number | null }>
  return Number(result.docs[0]?.order ?? 0) + 1
}
