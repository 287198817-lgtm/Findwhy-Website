import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'

export const filenameToSlug = (filename: string) => {
  const withoutExtension = filename.replace(/\.[^.]+$/, '')
  const normalized = withoutExtension
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'illustration'
}

const imageIDFrom = (image: unknown) => {
  if (typeof image === 'number' || typeof image === 'string') return image
  if (image && typeof image === 'object' && 'id' in image) {
    const id = image.id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

const uniqueSlug = async (baseSlug: string, req: PayloadRequest) => {
  let candidate = baseSlug
  let suffix = 2

  while (true) {
    const existing = await req.payload.find({
      collection: 'illustrations',
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
    collection: 'illustrations',
    depth: 0,
    limit: 1,
    sort: '-order',
  })

  return Number(latest.docs[0]?.order ?? 0) + 1
}

export const applyIllustrationDefaults: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  if (!data.slug?.trim()) {
    const imageID = imageIDFrom(data.image ?? originalDoc?.image)
    let filename = ''

    if (imageID !== null) {
      const image = await req.payload.findByID({ collection: 'images', depth: 0, id: imageID })
      filename = image.filename || ''
    }

    data.slug = await uniqueSlug(filenameToSlug(filename), req)
  }

  if (operation === 'create' && (data.order === null || data.order === undefined)) {
    data.order = await nextOrder(req)
  }

  if (data.draft === null || data.draft === undefined) data.draft = false

  return data
}
