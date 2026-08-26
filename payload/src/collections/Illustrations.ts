import type { CollectionConfig } from 'payload'

import { applyIllustrationDefaults } from '../lib/illustrationDefaults'

export const Illustrations: CollectionConfig = {
  slug: 'illustrations',
  access: { read: () => true },
  admin: {
    useAsTitle: 'slug',
    defaultColumns: ['slug', 'image', 'draft'],
    components: {
      beforeListTable: [
        '/components/IllustrationBulkUpload#IllustrationBulkUpload',
        '/components/MediaOrderLists#IllustrationOrderList',
      ],
    },
  },
  defaultSort: 'order',
  hooks: {
    beforeValidate: [applyIllustrationDefaults],
  },
  fields: [
    { name: 'slug', type: 'text', unique: true, index: true },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'images',
      required: true,
      admin: {
        components: {
          Field: '/components/DirectImageUploadField#DirectImageUploadField',
        },
      },
    },
    {
      name: 'order',
      type: 'number',
      index: true,
      admin: { hidden: true },
    },
    { name: 'draft', type: 'checkbox', defaultValue: false },
  ],
}
