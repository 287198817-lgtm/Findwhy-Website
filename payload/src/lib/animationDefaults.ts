import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'

export const videoFilenameToSlug = (filename: string) => {
  const normalized = filename
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'animation'
}

const relationshipID = (value: unknown) => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = value.id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

const uniqueSlug = async (baseSlug: string, req: PayloadRequest) => {
  let candidate = baseSlug
  let suffix = 2

  while (true) {
    const existing = await req.payload.find({
      collection: 'animations',
      depth: 0,
      limit: 1,
      where: { slug: { equals: candidate } },
    })
    if (existing.totalDocs === 0) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

const nextOrder = async (req: PayloadRequest) => {
  const latest = await req.payload.find({
    collection: 'animations',
    depth: 0,
    limit: 1,
    sort: '-order',
  })
  return Number(latest.docs[0]?.order ?? 0) + 1
}

export const applyAnimationDefaults: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const videoID = relationshipID(data.video ?? originalDoc?.video)
  const video = videoID === null
    ? null
    : await req.payload.findByID({ collection: 'videos', depth: 0, id: videoID })

  if (!data.slug?.trim()) {
    data.slug = await uniqueSlug(videoFilenameToSlug(video?.filename || ''), req)
  }

  if (operation === 'create' && (data.order === null || data.order === undefined)) {
    data.order = await nextOrder(req)
  }

  if ((data.poster === null || data.poster === undefined) && video?.poster) {
    data.poster = relationshipID(video.poster)
  }

  if (data.draft === null || data.draft === undefined) data.draft = false

  return data
}
