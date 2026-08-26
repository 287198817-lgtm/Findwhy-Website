'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

type DocumentRecord = Record<string, unknown> & { id?: number | string }

type Reference = {
  id: string
  label: string
  name: string
}

const relationID = (value: unknown): string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return String(id)
  }
  return undefined
}

const relationshipIncludes = (value: unknown, mediaID: string): boolean => {
  const values = Array.isArray(value) ? value : [value]
  return values.some((item) => relationID(item) === mediaID)
}

const displayName = (document: DocumentRecord): string => {
  const candidates = [
    document.title_en,
    document.title_zh,
    document.slug,
    document.filename,
    document.id,
  ]

  return String(candidates.find((candidate) => candidate !== undefined && candidate !== '') ?? 'Untitled')
}

const fetchCollection = async (collection: string): Promise<DocumentRecord[]> => {
  const documents: DocumentRecord[] = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const response = await fetch(`/api/${collection}?depth=0&limit=100&page=${page}`, {
      credentials: 'include',
    })

    if (!response.ok) throw new Error(`Unable to load ${collection}`)

    const result = (await response.json()) as {
      docs?: DocumentRecord[]
      hasNextPage?: boolean
      nextPage?: number | null
    }

    documents.push(...(result.docs ?? []))
    hasNextPage = Boolean(result.hasNextPage)
    page = result.nextPage ?? page + 1
  }

  return documents
}

const fetchGlobal = async (global: string): Promise<DocumentRecord> => {
  const response = await fetch(`/api/globals/${global}?depth=0`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Unable to load ${global}`)
  return response.json() as Promise<DocumentRecord>
}

const addMatches = (
  references: Reference[],
  documents: DocumentRecord[],
  label: string,
  mediaID: string,
  fields: string[],
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

const findImageReferences = async (mediaID: string): Promise<Reference[]> => {
  const [projects, series, illustrations, animations, videos, about] = await Promise.all([
    fetchCollection('projects'),
    fetchCollection('series'),
    fetchCollection('illustrations'),
    fetchCollection('animations'),
    fetchCollection('videos'),
    fetchGlobal('about'),
  ])
  const references: Reference[] = []

  addMatches(references, projects, 'Project', mediaID, ['coverImage', 'images', 'videoCover'])
  addMatches(references, series, 'Series', mediaID, ['cover', 'images', 'cover_image', 'gallery_images'])
  addMatches(references, illustrations, 'Illustration', mediaID, ['image'])
  addMatches(references, animations, 'Animation', mediaID, ['poster'])
  addMatches(references, videos, 'Video poster', mediaID, ['poster'])
  addMatches(references, [about], 'About', mediaID, ['portrait'])

  return references
}

const findVideoReferences = async (mediaID: string): Promise<Reference[]> => {
  const [projects, series, animations] = await Promise.all([
    fetchCollection('projects'),
    fetchCollection('series'),
    fetchCollection('animations'),
  ])
  const references: Reference[] = []

  addMatches(references, projects, 'Project', mediaID, ['video'])
  addMatches(references, series, 'Series', mediaID, ['videos'])
  addMatches(references, animations, 'Animation', mediaID, ['video'])

  return references
}

export const MediaUsedByField: React.FC = () => {
  const { collectionSlug, id } = useDocumentInfo()
  const [references, setReferences] = useState<Reference[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    if (!id || (collectionSlug !== 'images' && collectionSlug !== 'videos')) {
      setReferences([])
      setStatus('ready')
      return
    }

    let active = true
    setStatus('loading')

    const load = collectionSlug === 'images' ? findImageReferences : findVideoReferences
    void load(String(id))
      .then((items) => {
        if (!active) return
        const uniqueItems = Array.from(new Map(items.map((item) => [item.id, item])).values())
        setReferences(uniqueItems)
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setReferences([])
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [collectionSlug, id])

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Used By</div>
      <div
        style={{
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: '4px',
          padding: '14px 16px',
        }}
      >
        {status === 'loading' && <span style={{ color: 'var(--theme-elevation-600)' }}>Checking references…</span>}
        {status === 'error' && <span style={{ color: 'var(--theme-error-500)' }}>Unable to load references</span>}
        {status === 'ready' && references.length === 0 && (
          <span style={{ color: 'var(--theme-elevation-600)' }}>No references</span>
        )}
        {status === 'ready' && references.length > 0 && (
          <div style={{ display: 'grid', gap: '12px' }}>
            {references.map((reference) => (
              <div key={reference.id}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>✓ {reference.label}</div>
                <div style={{ color: 'var(--theme-elevation-700)', marginTop: '2px' }}>{reference.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
