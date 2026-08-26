import type { CollectionBeforeValidateHook, PayloadRequest, Where } from 'payload'

const titleToSlug = (title: string) => {
  const normalized = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'project'
}

const uniqueSlug = async (
  baseSlug: string,
  req: PayloadRequest,
  currentID?: number | string,
) => {
  let candidate = baseSlug
  let suffix = 2

  while (true) {
    const where: Where = currentID === undefined
      ? { slug: { equals: candidate } }
      : { and: [{ slug: { equals: candidate } }, { id: { not_equals: currentID } }] }
    const existing = await req.payload.find({
      collection: 'projects',
      depth: 0,
      limit: 1,
      where,
    })

    if (existing.totalDocs === 0) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

export const applyProjectDefaults: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  if (!data.slug?.trim()) {
    const title = data.title_en?.trim()
      || data.title_zh?.trim()
      || originalDoc?.title_en?.trim()
      || originalDoc?.title_zh?.trim()
      || ''
    data.slug = await uniqueSlug(titleToSlug(title), req, originalDoc?.id)
  }

  if (operation === 'create' && (data.order === null || data.order === undefined)) {
    const latest = await req.payload.find({
      collection: 'projects',
      depth: 0,
      limit: 1,
      sort: '-order',
    })
    data.order = Number(latest.docs[0]?.order ?? 0) + 1
  }

  const videos = Array.isArray(data.video) ? data.video : originalDoc?.video
  if (Array.isArray(videos) && videos.length > 0) {
    const videoCovers: Array<number | string> = []
    for (const value of videos) {
      const id = typeof value === 'object' && value !== null && 'id' in value ? value.id : value
      if (typeof id !== 'number' && typeof id !== 'string') continue
      const video = await req.payload.findByID({ collection: 'videos', depth: 0, id })
      const poster = typeof video.poster === 'object' && video.poster !== null ? video.poster.id : video.poster
      if (typeof poster === 'number' || typeof poster === 'string') videoCovers.push(poster)
    }
    data.videoCover = videoCovers
  }

  if (data.draft === null || data.draft === undefined) data.draft = false

  return data
}
