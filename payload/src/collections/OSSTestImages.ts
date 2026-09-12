import type { CollectionConfig } from 'payload'

const authenticated: NonNullable<CollectionConfig['access']>['read'] = ({ req }) =>
  Boolean(req.user)

export const OSSTestImages: CollectionConfig = {
  slug: 'oss-test-images',
  labels: {
    plural: 'OSS Test Images',
    singular: 'OSS Test Image',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    group: 'Phase 1B Prototype',
    useAsTitle: 'filename',
  },
  upload: {
    imageSizes: [
      { name: 'thumbnail', width: 480, height: 480, fit: 'inside' },
      {
        name: 'card',
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
        formatOptions: {
          format: 'webp',
          options: { quality: 82 },
        },
      },
      {
        name: 'portfolio',
        width: 2400,
        height: 2400,
        fit: 'inside',
        withoutEnlargement: true,
        formatOptions: {
          format: 'webp',
          options: { quality: 82 },
        },
      },
    ],
    mimeTypes: ['image/*'],
  },
  fields: [{ name: 'alt', type: 'text' }],
}
