import type { GlobalConfig } from 'payload'

const textList = (name: string, label: string) => ({
  name,
  label,
  type: 'array' as const,
  fields: [{ name: 'text', type: 'text' as const, required: true }],
})

const textareaList = (name: string, label: string) => ({
  name,
  label,
  type: 'array' as const,
  fields: [{ name: 'text', type: 'textarea' as const, required: true }],
})

export const About: GlobalConfig = {
  slug: 'about',
  access: { read: () => true },
  fields: [
    textareaList('intro_zh', 'Chinese introduction'),
    textareaList('intro_en', 'English introduction'),
    { name: 'portrait', type: 'upload', relationTo: 'images' },
    { name: 'services_title_zh', type: 'text', required: true },
    { name: 'services_title_en', type: 'text', required: true },
    textList('services_zh', 'Chinese services'),
    textList('services_en', 'English services'),
    { name: 'clients_title_zh', type: 'text', required: true },
    { name: 'clients_title_en', type: 'text', required: true },
    textList('clients', 'Clients'),
    { name: 'contact_title_zh', type: 'text', required: true },
    { name: 'contact_title_en', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'instagram_url', type: 'text', required: true },
    { name: 'xiaohongshu_url', type: 'text', required: true },
  ],
}
