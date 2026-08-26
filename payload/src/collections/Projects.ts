import type { CollectionConfig } from 'payload'

import { applyProjectDefaults } from '../lib/projectDefaults'
import { cleanupProjectMedia, runProjectMediaCleanup } from '../hooks/cleanupProjectMedia'

export const Projects: CollectionConfig = {
  slug: 'projects',
  access: { read: () => true },
  admin: {
    useAsTitle: 'title_en',
    defaultColumns: ['title_en', 'title_zh', 'year', 'category', 'order', 'draft'],
  },
  defaultSort: 'order',
  hooks: {
    beforeValidate: [applyProjectDefaults],
    beforeDelete: [cleanupProjectMedia],
    afterDelete: [runProjectMediaCleanup],
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'title_zh', type: 'text', required: true, label: '中文项目名称' },
    { name: 'title_en', type: 'text', label: 'English Project Name' },
    { name: 'description_zh', type: 'textarea', label: '中文项目介绍' },
    { name: 'description_en', type: 'textarea', label: 'English Description' },
    { name: 'year', type: 'number', label: '项目年份' },
    {
      name: 'category',
      type: 'text',
      label: '项目类型',
      admin: { description: '例如 Branding、Illustration、Animation、Exhibition、Packaging' },
    },
    {
      name: 'services',
      type: 'array',
      label: '服务内容',
      labels: { singular: '服务', plural: '服务' },
      fields: [{ name: 'service', type: 'text', required: true, label: '服务名称' }],
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'images',
      label: '旧项目封面（兼容）',
      admin: { hidden: true },
    },
    {
      name: 'images',
      type: 'upload',
      relationTo: 'images',
      hasMany: true,
      label: '项目图片',
      admin: {
        description: '项目详情页 Gallery，可一次上传多张图片，并通过每张图片的 Order 调整展示顺序。',
        components: { Field: '/components/ProjectGalleryUploadField#ProjectGalleryUploadField' },
      },
    },
    {
      name: 'video',
      type: 'upload',
      relationTo: 'videos',
      hasMany: true,
      label: '项目视频',
      admin: {
        description: '可选；上传后自动生成 poster。',
        components: { Field: '/components/ProjectVideoUploadField#ProjectVideoUploadField' },
      },
    },
    {
      name: 'videoCover',
      type: 'upload',
      relationTo: 'images',
      hasMany: true,
      label: '视频封面',
      admin: { hidden: true },
    },
    {
      name: 'order',
      type: 'number',
      index: true,
      label: '排序',
      admin: {
        components: {
          Cell: '/components/InlineOrderCell#InlineOrderCell',
        },
      },
    },
    { name: 'draft', type: 'checkbox', defaultValue: false },
  ],
}
