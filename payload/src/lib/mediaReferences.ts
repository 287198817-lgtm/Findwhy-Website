export type DocumentRecord = Record<string, unknown> & { id?: number | string }

export type Reference = {
  id: string
  label: string
  name: string
}

export type ImageReferenceSource = {
  fields: readonly string[]
  kind: 'collection' | 'global'
  label: string
  listLabel: string
  slug: string
}

export const imageReferenceSources: readonly ImageReferenceSource[] = [
  {
    kind: 'collection',
    slug: 'projects',
    label: 'Project',
    listLabel: 'Projects',
    fields: ['coverImage', 'images', 'videoCover'],
  },
  {
    kind: 'collection',
    slug: 'series',
    label: 'Series',
    listLabel: 'Series',
    fields: ['cover', 'images', 'cover_image', 'gallery_images'],
  },
  {
    kind: 'collection',
    slug: 'illustrations',
    label: 'Illustration',
    listLabel: 'Illustrations',
    fields: ['image'],
  },
  {
    kind: 'collection',
    slug: 'animations',
    label: 'Animation',
    listLabel: 'Animations',
    fields: ['poster'],
  },
  {
    kind: 'collection',
    slug: 'videos',
    label: 'Video poster',
    listLabel: 'Videos',
    fields: ['poster'],
  },
  {
    kind: 'global',
    slug: 'about',
    label: 'About',
    listLabel: 'About',
    fields: ['portrait'],
  },
]

export const videoReferenceSources = [
  { slug: 'projects', label: 'Project', fields: ['video'] },
  { slug: 'series', label: 'Series', fields: ['videos'] },
  { slug: 'animations', label: 'Animation', fields: ['video'] },
] as const

export const relationID = (value: unknown): string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return String(id)
  }
  return undefined
}

export const relationshipIncludes = (value: unknown, mediaID: string): boolean => {
  const values = Array.isArray(value) ? value : [value]
  return values.some((item) => relationID(item) === mediaID)
}

export const displayName = (document: DocumentRecord): string => {
  const candidates = [
    document.title_en,
    document.title_zh,
    document.slug,
    document.filename,
    document.id,
  ]

  return String(candidates.find((candidate) => candidate !== undefined && candidate !== '') ?? 'Untitled')
}

export const addMatches = (
  references: Reference[],
  documents: DocumentRecord[],
  label: string,
  mediaID: string,
  fields: readonly string[],
) => {
  for (const document of documents) {
    if (!fields.some((field) => relationshipIncludes(document[field], mediaID))) continue

    references.push({
      id: `${label}:${String(document.id)}`,
      label,
      name: displayName(document),
    })
  }
}
