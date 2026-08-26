import type { CollectionConfig } from 'payload'

import { generateVideoPoster } from '../hooks/generateVideoPoster'

export const Videos: CollectionConfig = {
  slug: 'videos',
  access: { read: () => true },
  admin: { useAsTitle: 'filename' },
  upload: { mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'] },
  hooks: {
    afterChange: [generateVideoPoster],
  },
  fields: [
    {
      name: 'usedBy',
      type: 'ui',
      admin: {
        components: { Field: '/components/MediaUsedByField#MediaUsedByField' },
      },
    },
    { name: 'alt', type: 'text' },
    { name: 'poster', type: 'upload', relationTo: 'images' },
  ],
}
