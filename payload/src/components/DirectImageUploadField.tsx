'use client'

import { useField, useUploadHandlers } from '@payloadcms/ui'
import type { UploadFieldClientComponent } from 'payload'
import React, { useEffect, useId, useState } from 'react'

import {
  findOrCreateImage,
  getNextIllustrationOrder,
  getUniqueIllustrationSlug,
  type ImageDocument,
} from './illustrationAdminUtils'

type ImageValue = ImageDocument | number | string | null

const getImageID = (value: ImageValue) => {
  if (value && typeof value === 'object') return value.id
  return value
}

export const DirectImageUploadField: UploadFieldClientComponent = ({ path }) => {
  const { getUploadHandler } = useUploadHandlers()
  const { errorMessage, setValue, showError, value } = useField<ImageValue>({ path })
  const { setValue: setSlug, value: slug } = useField<string | null>({ path: 'slug' })
  const { setValue: setOrder, value: order } = useField<number | null>({ path: 'order' })
  const [image, setImage] = useState<ImageDocument | null>(
    value && typeof value === 'object' ? value : null,
  )
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const inputID = useId()
  const imageID = getImageID(value)

  useEffect(() => {
    if (!imageID || (image && String(image.id) === String(imageID))) return

    let cancelled = false
    void fetch(`/api/images/${encodeURIComponent(String(imageID))}?depth=0`, {
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the selected image.')
        return response.json() as Promise<ImageDocument>
      })
      .then((document) => {
        if (!cancelled) setImage(document)
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })

    return () => {
      cancelled = true
    }
  }, [image, imageID])

  const uploadImage = async (file: File) => {
    setStatus('uploading')
    setStatusMessage('Uploading and processing image…')

    try {
      const { document, reused } = await findOrCreateImage(
        file,
        getUploadHandler({ collectionSlug: 'images' }),
      )

      setValue(document.id)
      setImage(document)

      const defaults: Array<Promise<void>> = []
      if (!slug?.trim()) {
        defaults.push(getUniqueIllustrationSlug(file.name).then((nextSlug) => setSlug(nextSlug)))
      }
      if (order === null || order === undefined) {
        defaults.push(getNextIllustrationOrder().then((nextOrder) => setOrder(nextOrder)))
      }
      await Promise.all(defaults)

      setStatus('idle')
      setStatusMessage(
        reused ? 'Existing media reused and linked.' : 'Image uploaded and linked.',
      )
    } catch (error) {
      setStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Image upload failed.')
    }
  }

  const previewURL = image?.thumbnailURL || image?.url

  return (
    <div className="field-type upload" style={{ marginBottom: '24px' }}>
      <label className="field-label" htmlFor={inputID}>
        Image <span className="required">*</span>
      </label>

      {imageID && image ? (
        <div
          style={{
            alignItems: 'center',
            border: '1px solid var(--theme-elevation-150)',
            display: 'flex',
            gap: '16px',
            marginBottom: '12px',
            padding: '12px',
          }}
        >
          {previewURL && (
            <img
              alt={image.filename || 'Selected image'}
              src={previewURL}
              style={{ height: '72px', objectFit: 'contain', width: '72px' }}
            />
          )}
          <span style={{ flex: 1 }}>{image.filename || `Image #${image.id}`}</span>
          <button
            onClick={() => {
              setValue(null)
              setImage(null)
              setStatusMessage('')
            }}
            type="button"
          >
            Remove
          </button>
        </div>
      ) : null}

      <input
        accept="image/*"
        disabled={status === 'uploading'}
        id={inputID}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void uploadImage(file)
          event.currentTarget.value = ''
        }}
        type="file"
      />

      <div
        aria-live="polite"
        style={{
          color: status === 'error' ? 'var(--theme-error-500)' : 'var(--theme-elevation-500)',
          fontSize: '13px',
          marginTop: '8px',
        }}
      >
        {statusMessage}
      </div>
      {showError && errorMessage ? (
        <div style={{ color: 'var(--theme-error-500)', fontSize: '13px' }}>{errorMessage}</div>
      ) : null}
    </div>
  )
}
