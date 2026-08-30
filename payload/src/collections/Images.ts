import type { CollectionConfig } from 'payload'

import { applyImageDefaults } from '../hooks/applyImageDefaults'

export const Images: CollectionConfig = {
  slug: 'images',
  access: { read: () => true },
  admin: { useAsTitle: 'filename' },
  upload: {
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumbnail', width: 480, height: 480, fit: 'inside' },
      { name: 'portfolio', width: 2500, fit: 'inside', withoutEnlargement: true },
      {
        name: 'card',
        width: 1200,
        fit: 'inside',
        withoutEnlargement: true,
        formatOptions: {
          format: 'webp',
          options: { quality: 82 },
        },
      },
    ],
  },
  hooks: {
    beforeValidate: [applyImageDefaults],
  },
  fields: [
    {
      name: 'usedBy',
      type: 'ui',
      admin: {
        components: {
          Cell: '/components/MediaUsedByCell#MediaUsedByCell',
          Field: '/components/MediaUsedByField#MediaUsedByField',
        },
      },
    },
    { name: 'alt', type: 'text' },
    {
      name: 'metadata',
      type: 'group',
      fields: [
        { name: 'caption', type: 'text' },
        { name: 'copyright', type: 'text' },
        { name: 'source', type: 'text' },
      ],
    },
  ],
}
