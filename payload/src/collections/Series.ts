import type { CollectionConfig } from 'payload'

import { applySeriesDefaults } from '../lib/seriesDefaults'
import { cleanupSeriesMedia, runSeriesMediaCleanup } from '../hooks/cleanupSeriesMedia'

export const Series: CollectionConfig = {
  slug: 'series',
  labels: { singular: 'Series', plural: 'Series' },
  access: { read: () => true },
  admin: { useAsTitle: 'title_en', defaultColumns: ['title_en', 'title_zh', 'year', 'order', 'draft'] },
  defaultSort: 'order',
  hooks: {
    beforeValidate: [applySeriesDefaults],
    beforeDelete: [cleanupSeriesMedia],
    afterDelete: [runSeriesMediaCleanup],
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title_zh', type: 'text', required: true },
    { name: 'title_en', type: 'text', required: true },
    { name: 'description_zh', type: 'textarea' },
    { name: 'description_en', type: 'textarea' },
    { name: 'year', type: 'number', label: '年份' },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'images',
      required: true,
      label: '系列封面',
      admin: {
        description: '只用于 Series 列表页，不会出现在详情 Gallery。',
        components: { Field: '/components/SeriesCoverUploadField#SeriesCoverUploadField' },
      },
    },
    {
      name: 'images',
      type: 'upload',
      relationTo: 'images',
      hasMany: true,
      label: '系列图片',
      admin: {
        description: '可批量上传；拖动图片可调整前端展示顺序。',
        components: { Field: '/components/SeriesImagesUploadField#SeriesImagesUploadField' },
      },
    },
    {
      name: 'videos',
      type: 'upload',
      relationTo: 'videos',
      hasMany: true,
      label: '系列视频',
      admin: {
        description: '可批量上传；自动生成 poster，拖动视频可调整展示顺序。',
        components: { Field: '/components/SeriesVideosUploadField#SeriesVideosUploadField' },
      },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'images', admin: { hidden: true } },
    { name: 'gallery_images', type: 'upload', relationTo: 'images', hasMany: true, admin: { hidden: true } },
    { name: 'order', type: 'number', index: true },
    { name: 'draft', type: 'checkbox', required: true, defaultValue: false },
  ],
}
