'use client'

import { useField, useUploadHandlers } from '@payloadcms/ui'
import type { UploadFieldClientComponent } from 'payload'
import React, { useEffect, useId, useState } from 'react'

import { findOrCreateImage, type ImageDocument } from './illustrationAdminUtils'

type ImageValue = ImageDocument | number | string | null
const imageID = (value: ImageValue) => value && typeof value === 'object' ? value.id : value

export const SeriesCoverUploadField: UploadFieldClientComponent = ({ path }) => {
  const { getUploadHandler } = useUploadHandlers()
  const { errorMessage, setValue, showError, value } = useField<ImageValue>({ path })
  const [image, setImage] = useState<ImageDocument | null>(value && typeof value === 'object' ? value : null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const inputID = useId()
  const id = imageID(value)

  useEffect(() => {
    if (!id || (image && String(image.id) === String(id))) return
    let cancelled = false
    void fetch(`/api/images/${encodeURIComponent(String(id))}?depth=0`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the selected cover.')
        return response
      })
      .then((response) => response.json() as Promise<ImageDocument>)
      .then((document) => { if (!cancelled) setImage(document) })
      .catch(() => { if (!cancelled) setImage(null) })
    return () => { cancelled = true }
  }, [id, image])

  const upload = async (file: File) => {
    setStatus('uploading')
    setStatusMessage('Uploading and processing Series cover…')
    try {
      const { document, reused } = await findOrCreateImage(
        file,
        getUploadHandler({ collectionSlug: 'images' }),
      )
      setValue(document.id)
      setImage(document)
      setStatus('idle')
      setStatusMessage(reused ? 'Existing image reused and linked.' : 'Cover uploaded and linked.')
    } catch (error) {
      setStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Cover upload failed.')
    }
  }

  const previewURL = image?.thumbnailURL || image?.url
  return (
    <div className="field-type upload" style={{ marginBottom: '24px' }}>
      <label className="field-label" htmlFor={inputID}>系列封面 <span className="required">*</span></label>
      {id && image ? <div style={{ alignItems: 'center', border: '1px solid var(--theme-elevation-150)', display: 'flex', gap: '16px', marginBottom: '12px', padding: '12px' }}>
        {previewURL ? <img alt={image.filename || 'Series cover'} src={previewURL} style={{ height: '72px', objectFit: 'contain', width: '72px' }} /> : null}
        <span style={{ flex: 1 }}>{image.filename || `Image #${image.id}`}</span>
        <button onClick={() => { setValue(null); setImage(null); setStatusMessage('') }} type="button">Remove</button>
      </div> : null}
      <input accept="image/*" disabled={status === 'uploading'} id={inputID} onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        if (file) void upload(file)
        event.currentTarget.value = ''
      }} type="file" />
      <div aria-live="polite" style={{ color: status === 'error' ? 'var(--theme-error-500)' : 'var(--theme-elevation-500)', fontSize: '13px', marginTop: '8px' }}>{statusMessage}</div>
      {showError && errorMessage ? <div style={{ color: 'var(--theme-error-500)' }}>{errorMessage}</div> : null}
    </div>
  )
}
