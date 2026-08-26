'use client'

import { useField, useUploadHandlers } from '@payloadcms/ui'
import type { UploadFieldClientComponent } from 'payload'
import React, { useEffect, useId, useState } from 'react'

import { findOrCreateImage, type ImageDocument } from './illustrationAdminUtils'

type ImageValue = ImageDocument | number | string | null

const relationshipID = (value: ImageValue) => value && typeof value === 'object' ? value.id : value

export const ProjectCoverUploadField: UploadFieldClientComponent = ({ path }) => {
  const { getUploadHandler } = useUploadHandlers()
  const { errorMessage, setValue, showError, value } = useField<ImageValue>({ path })
  const [image, setImage] = useState<ImageDocument | null>(
    value && typeof value === 'object' ? value : null,
  )
  const [status, setStatus] = useState('')
  const inputID = useId()
  const imageID = relationshipID(value)

  useEffect(() => {
    if (!imageID || (image && String(image.id) === String(imageID))) return
    let cancelled = false
    void fetch(`/api/images/${encodeURIComponent(String(imageID))}?depth=0`, { credentials: 'include' })
      .then((response) => response.json() as Promise<ImageDocument>)
      .then((document) => { if (!cancelled) setImage(document) })
      .catch(() => { if (!cancelled) setImage(null) })
    return () => { cancelled = true }
  }, [image, imageID])

  const upload = async (file: File) => {
    setStatus('Uploading cover image…')
    try {
      const { document, reused } = await findOrCreateImage(
        file,
        getUploadHandler({ collectionSlug: 'images' }),
      )
      setValue(document.id)
      setImage(document)
      setStatus(reused ? 'Existing image reused and linked.' : 'Cover uploaded and linked.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Cover upload failed.')
    }
  }

  const previewURL = image?.thumbnailURL || image?.url

  return (
    <div className="field-type upload" style={{ marginBottom: '24px' }}>
      <label className="field-label" htmlFor={inputID}>项目封面</label>
      {imageID && image ? (
        <div style={{ alignItems: 'center', border: '1px solid var(--theme-elevation-150)', display: 'flex', gap: '16px', marginBottom: '12px', padding: '12px' }}>
          {previewURL ? <img alt={image.filename || 'Project cover'} src={previewURL} style={{ height: '72px', objectFit: 'contain', width: '72px' }} /> : null}
          <span style={{ flex: 1 }}>{image.filename || `Image #${image.id}`}</span>
          <button onClick={() => { setValue(null); setImage(null); setStatus('') }} type="button">Remove</button>
        </div>
      ) : null}
      <input accept="image/*" id={inputID} onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        if (file) void upload(file)
        event.currentTarget.value = ''
      }} type="file" />
      <div aria-live="polite" style={{ color: 'var(--theme-elevation-500)', fontSize: '13px', marginTop: '8px' }}>{status}</div>
      {showError && errorMessage ? <div style={{ color: 'var(--theme-error-500)' }}>{errorMessage}</div> : null}
    </div>
  )
}
