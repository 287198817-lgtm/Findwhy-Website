import type { CollectionBeforeValidateHook } from 'payload'

export const applySeriesDefaults: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (!data) return data

  if (operation === 'create' && (data.order === null || data.order === undefined)) {
    const latest = await req.payload.find({
      collection: 'series',
      depth: 0,
      limit: 1,
      sort: '-order',
    })
    data.order = Number(latest.docs[0]?.order ?? 0) + 1
  }

  if (data.draft === null || data.draft === undefined) data.draft = false
  return data
}
