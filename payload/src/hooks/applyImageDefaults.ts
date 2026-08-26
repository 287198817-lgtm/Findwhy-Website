import path from 'node:path'

import type { CollectionBeforeValidateHook } from 'payload'

export const applyImageDefaults: CollectionBeforeValidateHook = ({ data, originalDoc, req }) => {
  if (!data || data.alt?.trim() || originalDoc?.alt?.trim()) return data

  const filename = req.file?.name || originalDoc?.filename || ''
  data.alt = path.parse(filename).name.replace(/[-_]+/g, ' ').trim()

  return data
}
