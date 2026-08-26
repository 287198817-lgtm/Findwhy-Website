import type { CollectionAfterChangeHook } from 'payload'

import type { Video } from '../payload-types'

export const generateVideoPoster: CollectionAfterChangeHook<Video> = async ({
  doc,
  req,
}) => {
  if (!doc.poster && doc.filename) {
    req.payload.logger.warn(`Video ${doc.filename} was saved without a browser-generated poster.`)
  }
  return doc
}
