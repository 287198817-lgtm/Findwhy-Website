import type { CollectionAfterDeleteHook, CollectionBeforeDeleteHook } from 'payload'

import { cleanupOwnedMedia, relationshipIDs } from '../lib/mediaCleanup'

export const cleanupProjectMedia: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const project = await req.payload.findByID({ collection: 'projects', depth: 0, id })
  req.context.projectMediaCleanup = {
    imageIDs: [
      ...relationshipIDs(project.coverImage),
      ...relationshipIDs(project.images),
      ...relationshipIDs(project.videoCover),
    ],
    videoIDs: relationshipIDs(project.video),
  }
}

export const runProjectMediaCleanup: CollectionAfterDeleteHook = async ({ id, req }) => {
  const cleanup = req.context.projectMediaCleanup as { imageIDs?: Array<number | string>; videoIDs?: Array<number | string> } | undefined
  await cleanupOwnedMedia({
    ownerCollection: 'projects',
    ownerID: id,
    imageIDs: cleanup?.imageIDs ?? [],
    videoIDs: cleanup?.videoIDs ?? [],
    req,
  })
}
