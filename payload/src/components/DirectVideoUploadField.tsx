'use client'

import { useField } from '@payloadcms/ui'
import type { UploadFieldClientComponent } from 'payload'
import React, { useEffect, useId, useState } from 'react'

import {
  findOrCreateVideo,
  getNextAnimationOrder,
  relationshipID,
  type VideoDocument,
} from './animationAdminUtils'

type VideoValue = VideoDocument | number | string | null

const videoIDFrom = (value: VideoValue) => {
  if (value && typeof value === 'object') return value.id
  return value
}

export const DirectVideoUploadField: UploadFieldClientComponent = ({ path }) => {
  const { errorMessage, setValue, showError, value } = useField<VideoValue>({ path })
  const { setValue: setPoster } = useField<number | string | null>({ path: 'poster' })
  const { setValue: setOrder, value: order } = useField<number | null>({ path: 'order' })
  const [video, setVideo] = useState<VideoDocument | null>(
    value && typeof value === 'object' ? value : null,
  )
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const inputID = useId()
  const videoID = videoIDFrom(value)

  useEffect(() => {
    if (!videoID || (video && String(video.id) === String(videoID))) return
    let cancelled = false
    void fetch(`/api/videos/${encodeURIComponent(String(videoID))}?depth=1`, { credentials: 'include' })
      .then((response) => response.json() as Promise<VideoDocument>)
      .then((document) => {
        if (!cancelled) setVideo(document)
      })
      .catch(() => {
        if (!cancelled) setVideo(null)
      })
    return () => {
      cancelled = true
    }
  }, [video, videoID])

  const uploadVideo = async (file: File) => {
    setStatus('uploading')
    setMessage('Uploading video and generating poster…')

    try {
      const { document, reused } = await findOrCreateVideo(file)
      setValue(document.id)
      setVideo(document)
      setPoster(relationshipID(document.poster))
      if (order === null || order === undefined) setOrder(await getNextAnimationOrder())
      setStatus('idle')
      setMessage(reused ? 'Existing video reused and linked.' : 'Video and poster created successfully.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Video upload failed.')
    }
  }

  return (
    <div className="field-type upload" style={{ marginBottom: '24px' }}>
      <label className="field-label" htmlFor={inputID}>Video <span className="required">*</span></label>
      {videoID && video ? (
        <div style={{ border: '1px solid var(--theme-elevation-150)', marginBottom: '12px', padding: '12px' }}>
          <span>{video.filename || `Video #${video.id}`}</span>
          <button
            onClick={() => {
              setValue(null)
              setVideo(null)
              setPoster(null)
              setMessage('')
            }}
            style={{ marginLeft: '16px' }}
            type="button"
          >Remove</button>
        </div>
      ) : null}
      <input
        accept="video/mp4"
        disabled={status === 'uploading'}
        id={inputID}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void uploadVideo(file)
          event.currentTarget.value = ''
        }}
        type="file"
      />
      <div aria-live="polite" style={{ color: status === 'error' ? 'var(--theme-error-500)' : 'var(--theme-elevation-500)', fontSize: '13px', marginTop: '8px' }}>
        {message}
      </div>
      {showError && errorMessage ? <div style={{ color: 'var(--theme-error-500)' }}>{errorMessage}</div> : null}
    </div>
  )
}
