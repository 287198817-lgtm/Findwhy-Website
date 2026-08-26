import type { CollectionAfterDeleteHook, CollectionBeforeDeleteHook } from 'payload'

import { cleanupOwnedMedia, relationshipIDs } from '../lib/mediaCleanup'

export const cleanupSeriesMedia: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const series = await req.payload.findByID({ collection: 'series', depth: 0, id })
  req.context.seriesMediaCleanup = {
    imageIDs: [
      ...relationshipIDs(series.cover),
      ...relationshipIDs(series.images),
      ...relationshipIDs(series.cover_image),
      ...relationshipIDs(series.gallery_images),
    ],
    videoIDs: relationshipIDs(series.videos),
  }
}

export const runSeriesMediaCleanup: CollectionAfterDeleteHook = async ({ id, req }) => {
  const cleanup = req.context.seriesMediaCleanup as { imageIDs?: Array<number | string>; videoIDs?: Array<number | string> } | undefined
  await cleanupOwnedMedia({
    ownerCollection: 'series',
    ownerID: id,
    imageIDs: cleanup?.imageIDs ?? [],
    videoIDs: cleanup?.videoIDs ?? [],
    req,
  })
}
