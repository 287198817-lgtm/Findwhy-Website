'use client'

import { useField, useUploadHandlers } from '@payloadcms/ui'
import type { UploadFieldClientComponent } from 'payload'
import React, { useEffect, useId, useMemo, useState } from 'react'

import { findOrCreateImage, type ImageDocument } from './illustrationAdminUtils'
import { sortFilesNaturally } from './clientMediaUpload'

type ImageValue = ImageDocument | number | string

const relationshipID = (value: ImageValue) => typeof value === 'object' ? value.id : value

export const ProjectGalleryUploadField: UploadFieldClientComponent = ({ path }) => {
  const { getUploadHandler } = useUploadHandlers()
  const { errorMessage, setValue, showError, value } = useField<ImageValue[]>({ path })
  const [images, setImages] = useState<ImageDocument[]>(
    Array.isArray(value) ? value.filter((item): item is ImageDocument => typeof item === 'object') : [],
  )
  const [draggedID, setDraggedID] = useState<number | string | null>(null)
  const [status, setStatus] = useState('')
  const inputID = useId()
  const ids = useMemo(() => Array.isArray(value) ? value.map(relationshipID) : [], [value])
  const idsKey = ids.map(String).join(',')

  useEffect(() => {
    if (ids.length === 0) { setImages([]); return }
    if (images.length === ids.length && images.every((image, index) => String(image.id) === String(ids[index]))) return
    let cancelled = false
    void Promise.all(ids.map((id) => fetch(`/api/images/${encodeURIComponent(String(id))}?depth=0`, { credentials: 'include' })
      .then((response) => response.json() as Promise<ImageDocument>)))
      .then((documents) => { if (!cancelled) setImages(documents) })
      .catch(() => { if (!cancelled) setStatus('Unable to load one or more images.') })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const upload = async (selectedFiles: File[]) => {
    const files = sortFilesNaturally(selectedFiles)
    setStatus(`Uploading ${files.length} image${files.length === 1 ? '' : 's'}…`)
    try {
      const uploaded: ImageDocument[] = []
      for (const file of files) {
        uploaded.push(
          (await findOrCreateImage(file, getUploadHandler({ collectionSlug: 'images' }))).document,
        )
      }
      const combined = [...images, ...uploaded]
        .filter((image, index, all) => all.findIndex((candidate) => String(candidate.id) === String(image.id)) === index)
      setImages(combined)
      setValue(combined.map((image) => image.id))
      setStatus(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded and linked.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Gallery upload failed.')
    }
  }

  const remove = (id: number | string) => {
    const next = images.filter((image) => String(image.id) !== String(id))
    setImages(next)
    setValue(next.map((image) => image.id))
  }

  const moveBefore = (targetID: number | string) => {
    if (draggedID === null || String(draggedID) === String(targetID)) return
    const next = [...images]
    const currentIndex = next.findIndex((image) => String(image.id) === String(draggedID))
    const targetIndex = next.findIndex((image) => String(image.id) === String(targetID))
    if (currentIndex === -1 || targetIndex === -1) return
    const [moved] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, moved)
    setImages(next)
    setValue(next.map((image) => image.id))
  }

  return (
    <div className="field-type upload" style={{ marginBottom: '24px' }}>
      <label className="field-label" htmlFor={inputID}>项目图片</label>
      {images.map((image, index) => (
        <div draggable key={image.id} onDragEnd={() => setDraggedID(null)} onDragOver={(event) => event.preventDefault()}
          onDragStart={() => setDraggedID(image.id)} onDrop={() => moveBefore(image.id)}
          style={{ alignItems: 'center', border: '1px solid var(--theme-elevation-150)', cursor: 'grab', display: 'flex', gap: '12px', marginBottom: '8px', padding: '10px' }}>
          {(image.thumbnailURL || image.url) ? <img alt={image.filename || 'Gallery image'} src={image.thumbnailURL || image.url || ''} style={{ height: '56px', objectFit: 'contain', width: '56px' }} /> : null}
          <span aria-hidden="true">⋮⋮</span>
          <span style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
          <span style={{ flex: 1 }}>{image.filename || `Image #${image.id}`}</span>
          <button onClick={() => remove(image.id)} type="button">Remove</button>
        </div>
      ))}
      <input accept="image/*" id={inputID} multiple onChange={(event) => {
        const files = Array.from(event.currentTarget.files || [])
        if (files.length > 0) void upload(files)
        event.currentTarget.value = ''
      }} type="file" />
      <div aria-live="polite" style={{ color: 'var(--theme-elevation-500)', fontSize: '13px', marginTop: '8px' }}>{status}</div>
      {showError && errorMessage ? <div style={{ color: 'var(--theme-error-500)' }}>{errorMessage}</div> : null}
    </div>
  )
}
