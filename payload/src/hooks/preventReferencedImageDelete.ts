import { APIError, type CollectionBeforeDeleteHook } from 'payload'

import { getImageReferenceLabels } from '../lib/mediaReferenceQueries'

export const preventReferencedImageDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const labels = await getImageReferenceLabels({ imageID: id, payload: req.payload, req })

  if (labels.length > 0) {
    throw new APIError(
      `Cannot delete this image because it is currently used by: ${labels.join(', ')}`,
      409,
    )
  }
}
