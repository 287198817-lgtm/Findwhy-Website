'use client'

import { useField } from '@payloadcms/ui'
import type { UploadFieldClientComponent } from 'payload'
import React, { useEffect, useId, useMemo, useState } from 'react'

import { findOrCreateVideo, type VideoDocument } from './animationAdminUtils'

type VideoValue = VideoDocument | number | string
const videoID = (value: VideoValue) => typeof value === 'object' ? value.id : value

export const SeriesVideosUploadField: UploadFieldClientComponent = ({ path }) => {
  const { errorMessage, setValue, showError, value } = useField<VideoValue[]>({ path })
  const [videos, setVideos] = useState<VideoDocument[]>(
    Array.isArray(value) ? value.filter((item): item is VideoDocument => typeof item === 'object') : [],
  )
  const [draggedID, setDraggedID] = useState<number | string | null>(null)
  const [status, setStatus] = useState('')
  const inputID = useId()
  const ids = useMemo(() => Array.isArray(value) ? value.map(videoID) : [], [value])
  const idsKey = ids.map(String).join(',')

  useEffect(() => {
    if (ids.length === 0) { setVideos([]); return }
    if (videos.length === ids.length && videos.every((video, index) => String(video.id) === String(ids[index]))) return
    let cancelled = false
    void Promise.all(ids.map((id) => fetch(`/api/videos/${encodeURIComponent(String(id))}?depth=1`, { credentials: 'include' })
      .then((response) => response.json() as Promise<VideoDocument>)))
      .then((documents) => { if (!cancelled) setVideos(documents) })
      .catch(() => { if (!cancelled) setStatus('Unable to load one or more videos.') })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const update = (documents: VideoDocument[]) => {
    setVideos(documents)
    setValue(documents.map((video) => video.id))
  }

  const upload = async (files: File[]) => {
    setStatus(`Uploading ${files.length} video${files.length === 1 ? '' : 's'} and generating poster…`)
    try {
      const uploaded: VideoDocument[] = []
      for (const file of files) uploaded.push((await findOrCreateVideo(file)).document)
      update([...videos, ...uploaded].filter((video, index, all) =>
        all.findIndex((candidate) => String(candidate.id) === String(video.id)) === index))
      setStatus(`${uploaded.length} video${uploaded.length === 1 ? '' : 's'} uploaded with poster.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Video upload failed.')
    }
  }

  const moveBefore = (targetID: number | string) => {
    if (draggedID === null || String(draggedID) === String(targetID)) return
    const next = [...videos]
    const sourceIndex = next.findIndex((video) => String(video.id) === String(draggedID))
    const targetIndex = next.findIndex((video) => String(video.id) === String(targetID))
    if (sourceIndex === -1 || targetIndex === -1) return
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    update(next)
  }

  return (
    <div className="field-type upload" style={{ marginBottom: '24px' }}>
      <label className="field-label" htmlFor={inputID}>系列视频</label>
      {videos.map((video, index) => (
        <div draggable key={video.id} onDragEnd={() => setDraggedID(null)} onDragOver={(event) => event.preventDefault()}
          onDragStart={() => setDraggedID(video.id)} onDrop={() => moveBefore(video.id)}
          style={{ alignItems: 'center', border: '1px solid var(--theme-elevation-150)', cursor: 'grab', display: 'flex', gap: '12px', marginBottom: '8px', padding: '10px' }}>
          {video.poster && typeof video.poster === 'object' && video.poster.url ? <img alt="Video poster" src={video.poster.url} style={{ height: '56px', objectFit: 'contain', width: '56px' }} /> : null}
          <span aria-hidden="true">⋮⋮</span><span style={{ flex: 1 }}>{video.filename || `Video #${video.id}`}</span>
          <span style={{ fontSize: '12px' }}>Order {index + 1}</span>
          <button onClick={() => update(videos.filter((item) => String(item.id) !== String(video.id)))} type="button">Remove</button>
        </div>
      ))}
      <input accept="video/mp4,video/webm,video/quicktime" id={inputID} multiple onChange={(event) => {
        const files = Array.from(event.currentTarget.files || [])
        if (files.length > 0) void upload(files)
        event.currentTarget.value = ''
      }} type="file" />
      <div aria-live="polite" style={{ color: 'var(--theme-elevation-500)', fontSize: '13px', marginTop: '8px' }}>{status}</div>
      {showError && errorMessage ? <div style={{ color: 'var(--theme-error-500)' }}>{errorMessage}</div> : null}
    </div>
  )
}
