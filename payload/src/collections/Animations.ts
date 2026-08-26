import type { CollectionConfig } from 'payload'

import { applyAnimationDefaults } from '../lib/animationDefaults'

export const Animations: CollectionConfig = {
  slug: 'animations',
  access: { read: () => true },
  admin: {
    useAsTitle: 'slug',
    defaultColumns: ['slug', 'video', 'poster', 'draft'],
    components: {
      beforeListTable: [
        '/components/AnimationBulkUpload#AnimationBulkUpload',
        '/components/MediaOrderLists#AnimationOrderList',
      ],
    },
  },
  defaultSort: 'order',
  hooks: {
    beforeValidate: [applyAnimationDefaults],
  },
  fields: [
    { name: 'slug', type: 'text', unique: true, index: true },
    {
      name: 'video',
      type: 'upload',
      relationTo: 'videos',
      required: true,
      admin: {
        components: {
          Field: '/components/DirectVideoUploadField#DirectVideoUploadField',
        },
      },
    },
    { name: 'poster', type: 'upload', relationTo: 'images', admin: { hidden: true } },
    {
      name: 'order',
      type: 'number',
      index: true,
      admin: { hidden: true },
    },
    { name: 'draft', type: 'checkbox', defaultValue: false },
  ],
}
