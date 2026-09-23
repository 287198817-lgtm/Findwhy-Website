'use client'

import { useUploadHandlers } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useEffect, useId, useRef, useState } from 'react'

import { createIllustrationFromFile } from './illustrationAdminUtils'
import { requestMediaOrderRefresh } from './mediaOrderRefresh'
import {
  IllustrationUploadQueue,
  type IllustrationUploadQueueSnapshot,
  isSystemicIllustrationUploadError,
} from './illustrationUploadQueue'

const initialSnapshot: IllustrationUploadQueueSnapshot = { items: [], phase: 'idle' }

const statusLabel = {
  completed: 'Completed',
  failed: 'Failed',
  'creating-illustration': 'Creating illustration',
  processing: 'Processing',
  stopped: 'Stopped',
  uploading: 'Uploading',
  waiting: 'Waiting',
} as const

export const IllustrationBulkUpload: React.FC = () => {
  const { getUploadHandler } = useUploadHandlers()
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const inputID = useId()
  const queueRef = useRef<IllustrationUploadQueue | null>(null)
  const router = useRouter()

  const processFile = async (
    file: File,
    setStatus: (status: 'uploading' | 'processing' | 'creating-illustration') => void,
  ) => {
    setStatus('uploading')
    await createIllustrationFromFile(
      file,
      getUploadHandler({ collectionSlug: 'images' }),
      {
        onImageCreated: () => setStatus('creating-illustration'),
        onOriginalUploadComplete: () => setStatus('processing'),
      },
    )
  }

  const beginUpload = (files: File[]) => {
    const queue = new IllustrationUploadQueue({
      isSystemicError: isSystemicIllustrationUploadError,
      onChange: (nextSnapshot) => {
        setSnapshot(nextSnapshot)
        if (['finished', 'stopped'].includes(nextSnapshot.phase)) router.refresh()
      },
      onItemCompleted: () => requestMediaOrderRefresh('illustrations'),
      processFile,
    })
    queueRef.current = queue
    void queue.start(files)
  }

  useEffect(() => {
    const isUnsafeToLeave = ['running', 'pausing', 'stopping'].includes(snapshot.phase)
    if (!isUnsafeToLeave) return

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [snapshot.phase])

  const completed = snapshot.items.filter((item) => item.status === 'completed').length
  const failed = snapshot.items.filter((item) => item.status === 'failed').length
  const notUploaded = snapshot.items.filter((item) => item.status === 'stopped').length
  const current = snapshot.items.find((item) =>
    ['uploading', 'processing', 'creating-illustration'].includes(item.status),
  )
  const active = ['running', 'pausing', 'stopping'].includes(snapshot.phase)
  const progress = snapshot.items.length > 0 ? (completed / snapshot.items.length) * 100 : 0

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        marginBottom: '24px',
        padding: '16px',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '8px' }}>Bulk upload Illustrations</strong>
      <p style={{ color: 'var(--theme-elevation-600)', margin: '0 0 12px' }}>
        Files upload one at a time in the order selected. Each completed file is saved immediately.
      </p>
      <input
        accept="image/*"
        disabled={active || snapshot.phase === 'paused'}
        id={inputID}
        multiple
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files || [])
          if (files.length > 0) beginUpload(files)
          event.currentTarget.value = ''
        }}
        type="file"
      />

      {snapshot.items.length > 0 && (
        <div aria-live="polite" style={{ marginTop: '14px' }}>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <strong>
              Completed {completed} / {snapshot.items.length}
            </strong>
            {failed > 0 && <span style={{ color: 'var(--theme-error-500)' }}>Failed {failed}</span>}
            <span style={{ color: 'var(--theme-elevation-600)', textTransform: 'capitalize' }}>
              {snapshot.phase}
            </span>
          </div>
          <div
            aria-label={`${completed} of ${snapshot.items.length} completed`}
            aria-valuemax={snapshot.items.length}
            aria-valuemin={0}
            aria-valuenow={completed}
            role="progressbar"
            style={{
              background: 'var(--theme-elevation-100)',
              height: '8px',
              marginTop: '10px',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <div
              style={{
                background: 'var(--theme-success-500)',
                height: '100%',
                transition: 'width 160ms ease',
                width: `${progress}%`,
              }}
            />
          </div>
          {current && (
            <div style={{ marginTop: '8px' }}>
              {statusLabel[current.status]}: {current.file.name}
            </div>
          )}
          {snapshot.phase === 'pausing' && <div>Pausing after current upload...</div>}
          {snapshot.phase === 'paused' && <div>Paused</div>}
          {snapshot.phase === 'finished' && <div>Upload complete</div>}
          {snapshot.phase === 'stopped' && (
            <div>
              Upload stopped — Completed: {completed}; Failed: {failed}; Not uploaded: {notUploaded}
            </div>
          )}

          {!['finished', 'stopped'].includes(snapshot.phase) && (
            <div style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
              {snapshot.phase === 'running' && (
                <button onClick={() => queueRef.current?.pause()} type="button">
                  Pause
                </button>
              )}
              {snapshot.phase === 'pausing' && <button disabled>Pausing...</button>}
              {snapshot.phase === 'paused' && (
                <button onClick={() => void queueRef.current?.resume()} type="button">
                  Resume
                </button>
              )}
              {snapshot.phase === 'stopping' ? (
                <button disabled>Stopping...</button>
              ) : (
                <button onClick={() => queueRef.current?.stop()} type="button">
                  Stop
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gap: '6px' }}>
            {snapshot.items.map((item) => (
              <div
                key={item.id}
                style={{
                  alignItems: 'start',
                  borderTop: '1px solid var(--theme-elevation-100)',
                  display: 'grid',
                  gap: '8px',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  paddingTop: '6px',
                }}
              >
                <span style={{ overflowWrap: 'anywhere' }}>{item.file.name}</span>
                <span>{statusLabel[item.status]}</span>
                {item.error && (
                  <span style={{ color: 'var(--theme-error-500)', gridColumn: '1 / -1' }}>
                    {item.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
