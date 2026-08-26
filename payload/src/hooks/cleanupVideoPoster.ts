import type { CollectionAfterDeleteHook } from 'payload'

import type { Video } from '../payload-types'
import { cleanupUnreferencedImage, relationshipID } from '../lib/mediaCleanup'

export const cleanupVideoPoster: CollectionAfterDeleteHook<Video> = async ({ doc, req }) => {
  const posterID = relationshipID(doc.poster)
  if (posterID === null) return doc

  try {
    await cleanupUnreferencedImage(req, posterID, new Set([String(doc.id)]))
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Unable to clean up poster ${posterID} after deleting video ${doc.id}`,
    })
  }

  return doc
}
