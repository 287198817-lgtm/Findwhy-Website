import type { CollectionConfig } from 'payload'

import { generateVideoPoster } from '../hooks/generateVideoPoster'
import { cleanupVideoPoster } from '../hooks/cleanupVideoPoster'

export const Videos: CollectionConfig = {
  slug: 'videos',
  access: { read: () => true },
  admin: { useAsTitle: 'filename' },
  upload: { mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'] },
  hooks: {
    afterChange: [generateVideoPoster],
    afterDelete: [cleanupVideoPoster],
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
    {
      name: 'webVideo',
      type: 'upload',
      relationTo: 'web-videos',
      admin: {
        description: 'Optional web-optimized MP4 used for frontend playback. The original video remains unchanged.',
      },
    },
  ],
}
