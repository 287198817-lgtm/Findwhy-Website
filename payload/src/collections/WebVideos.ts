import type { CollectionConfig } from 'payload'

export const WebVideos: CollectionConfig = {
  slug: 'web-videos',
  access: { read: () => true },
  admin: { useAsTitle: 'filename' },
  upload: { mimeTypes: ['video/mp4'] },
  fields: [],
}
