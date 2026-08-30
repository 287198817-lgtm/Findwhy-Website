'use client'

import type { DefaultCellComponentProps } from 'payload'
import React, { useEffect, useState } from 'react'

import {
  imageReferenceSources,
  relationshipIncludes,
  type DocumentRecord,
  type ImageReferenceSource,
} from '../lib/mediaReferences'

type CellState =
  | { status: 'loading' }
  | { status: 'ready'; labels: string[] }
  | { status: 'error' }

const referenceCache = new Map<string, Promise<string[]>>()

const collectionHasReference = async (source: ImageReferenceSource, mediaID: string): Promise<boolean> => {
  const params = new URLSearchParams({ depth: '0', limit: '1', 'select[id]': 'true' })

  source.fields.forEach((field, index) => {
    params.set(`where[or][${index}][${field}][equals]`, mediaID)
  })

  const response = await fetch(`/api/${source.slug}?${params.toString()}`, {
    credentials: 'include',
  })
  if (!response.ok) throw new Error(`Unable to load ${source.slug}`)

  const result = (await response.json()) as { totalDocs?: number }
  return (result.totalDocs ?? 0) > 0
}

const globalHasReference = async (source: ImageReferenceSource, mediaID: string): Promise<boolean> => {
  const response = await fetch(`/api/globals/${source.slug}?depth=0`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Unable to load ${source.slug}`)

  const document = (await response.json()) as DocumentRecord
  return source.fields.some((field) => relationshipIncludes(document[field], mediaID))
}

const findImageReferenceLabels = (mediaID: string): Promise<string[]> => {
  const cached = referenceCache.get(mediaID)
  if (cached) return cached

  const request = Promise.all(
    imageReferenceSources.map(async (source) => {
      const found =
        source.kind === 'collection'
          ? await collectionHasReference(source, mediaID)
          : await globalHasReference(source, mediaID)
      return found ? source.listLabel : undefined
    }),
  ).then((labels) => Array.from(new Set(labels.filter((label): label is string => Boolean(label)))))

  referenceCache.set(mediaID, request)
  void request.catch(() => referenceCache.delete(mediaID))
  return request
}

export const MediaUsedByCell: React.FC<DefaultCellComponentProps> = ({ rowData }) => {
  const mediaID = rowData.id === undefined || rowData.id === null ? undefined : String(rowData.id)
  const [state, setState] = useState<CellState>({ status: 'loading' })

  useEffect(() => {
    if (!mediaID) {
      setState({ status: 'error' })
      return
    }

    let active = true
    setState({ status: 'loading' })

    void findImageReferenceLabels(mediaID)
      .then((labels) => {
        if (active) setState({ status: 'ready', labels })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })

    return () => {
      active = false
    }
  }, [mediaID])

  if (state.status === 'loading') return <span>Checking…</span>
  if (state.status === 'error') return <span style={{ color: 'var(--theme-error-500)' }}>Unavailable</span>
  if (state.labels.length === 0) return <span>No references</span>

  return <span>{state.labels.join(', ')}</span>
}
