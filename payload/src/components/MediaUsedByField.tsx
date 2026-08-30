'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import {
  addMatches,
  imageReferenceSources,
  videoReferenceSources,
  type DocumentRecord,
  type Reference,
} from '../lib/mediaReferences'

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

const findImageReferences = async (mediaID: string): Promise<Reference[]> => {
  const documentsBySource = await Promise.all(
    imageReferenceSources.map(async (source) => ({
      source,
      documents:
        source.kind === 'collection' ? await fetchCollection(source.slug) : [await fetchGlobal(source.slug)],
    })),
  )
  const references: Reference[] = []

  for (const { source, documents } of documentsBySource) {
    addMatches(references, documents, source.label, mediaID, source.fields)
  }

  return references
}

const findVideoReferences = async (mediaID: string): Promise<Reference[]> => {
  const documentsBySource = await Promise.all(
    videoReferenceSources.map(async (source) => ({
      source,
      documents: await fetchCollection(source.slug),
    })),
  )
  const references: Reference[] = []

  for (const { source, documents } of documentsBySource) {
    addMatches(references, documents, source.label, mediaID, source.fields)
  }

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
