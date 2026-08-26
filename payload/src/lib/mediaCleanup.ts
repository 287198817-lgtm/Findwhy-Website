import type { PayloadRequest, Where } from 'payload'

type OwnerCollection = 'projects' | 'series'
type MediaID = number | string

type CleanupInput = {
  ownerCollection: OwnerCollection
  ownerID: MediaID
  imageIDs: MediaID[]
  req: PayloadRequest
  videoIDs: MediaID[]
}

export const relationshipID = (value: unknown): MediaID | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = value.id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

export const relationshipIDs = (value: unknown): MediaID[] => {
  const values = Array.isArray(value) ? value : [value]
  return values.map(relationshipID).filter((id): id is MediaID => id !== null)
}

const collectionHasReference = async (
  req: PayloadRequest,
  collection: 'animations' | 'illustrations' | 'projects' | 'series' | 'videos',
  fields: string[],
  id: MediaID,
  exclude?: { collection: OwnerCollection; id: MediaID },
) => {
  const references = { or: fields.map((field) => ({ [field]: { equals: id } })) }
  const result = await req.payload.find({ collection, depth: 0, limit: exclude?.collection === collection ? 2 : 1, where: references as Where })
  return exclude?.collection === collection
    ? result.docs.some((document) => String(document.id) !== String(exclude.id))
    : result.totalDocs > 0
}

const imageHasReference = async (
  req: PayloadRequest,
  id: MediaID,
  owner?: Pick<CleanupInput, 'ownerCollection' | 'ownerID'>,
  deletedVideoIDs = new Set<string>(),
) => {
  const exclude = owner ? { collection: owner.ownerCollection, id: owner.ownerID } : undefined
  if (await collectionHasReference(req, 'illustrations', ['image'], id)) return true
  if (await collectionHasReference(req, 'animations', ['poster'], id)) return true
  if (await collectionHasReference(req, 'projects', ['coverImage', 'images', 'videoCover'], id, exclude)) return true
  if (await collectionHasReference(req, 'series', ['cover', 'images', 'cover_image', 'gallery_images'], id, exclude)) return true
  const videoReferences = await req.payload.find({
    collection: 'videos', depth: 0, limit: 100, where: { poster: { equals: id } },
  })
  if (videoReferences.docs.some((video) => !deletedVideoIDs.has(String(video.id)))) return true
  const about = await req.payload.findGlobal({ slug: 'about', depth: 0 })
  return String(relationshipID(about.portrait)) === String(id)
}

export const cleanupUnreferencedImage = async (
  req: PayloadRequest,
  id: MediaID,
  deletedVideoIDs = new Set<string>(),
) => {
  if (await imageHasReference(req, id, undefined, deletedVideoIDs)) return false
  await req.payload.delete({ collection: 'images', id, req })
  return true
}

const videoHasReference = async (req: PayloadRequest, id: MediaID, owner: CleanupInput) => {
  const exclude = { collection: owner.ownerCollection, id: owner.ownerID }
  if (await collectionHasReference(req, 'animations', ['video'], id)) return true
  if (await collectionHasReference(req, 'projects', ['video'], id, exclude)) return true
  return collectionHasReference(req, 'series', ['videos'], id, exclude)
}

export const cleanupOwnedMedia = async (input: CleanupInput) => {
  const videoIDs = [...new Map(input.videoIDs.map((id) => [String(id), id])).values()]
  const imageIDs = new Map(input.imageIDs.map((id) => [String(id), id]))
  const deletedVideoIDs = new Set<string>()

  for (const id of videoIDs) {
    if (await videoHasReference(input.req, id, input)) continue
    const video = await input.req.payload.findByID({ collection: 'videos', depth: 0, id })
    const posterID = relationshipID(video.poster)
    // Keep the poster in the owner's cleanup set as well. During a nested
    // delete, the Video afterDelete hook can still see the owner inside the
    // outer transaction and correctly defer deleting the poster. The owner
    // pass below excludes that document and performs the final cleanup.
    if (posterID !== null) imageIDs.set(String(posterID), posterID)
    await input.req.payload.delete({ collection: 'videos', id, req: input.req })
    deletedVideoIDs.add(String(id))
  }

  for (const id of imageIDs.values()) {
    const existing = await input.req.payload.find({
      collection: 'images',
      depth: 0,
      limit: 1,
      where: { id: { equals: id } },
    })
    if (existing.totalDocs === 0) continue
    if (await imageHasReference(input.req, id, input, deletedVideoIDs)) continue
    await input.req.payload.delete({ collection: 'images', id, req: input.req })
  }
}
