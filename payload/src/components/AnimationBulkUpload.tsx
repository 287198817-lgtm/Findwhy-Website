'use client'

import { useUploadHandlers } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { findOrCreateVideo, relationshipID, responseError } from './animationAdminUtils'
import { sortFilesNaturally } from './clientMediaUpload'

type UploadFailure = { filename: string; message: string }

export const AnimationBulkUpload: React.FC = () => {
  const { getUploadHandler } = useUploadHandlers()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<{ failed: UploadFailure[]; succeeded: number } | null>(null)
  const router = useRouter()

  const uploadFiles = async (selectedFiles: File[]) => {
    const files = sortFilesNaturally(selectedFiles)
    const failed: UploadFailure[] = []
    let succeeded = 0
    setRunning(true)
    setResult(null)

    for (const [index, file] of files.entries()) {
      setProgress(`Processing ${index + 1} of ${files.length}: ${file.name}`)
      try {
        const { document } = await findOrCreateVideo(
          file,
          getUploadHandler({ collectionSlug: 'videos' }),
          getUploadHandler({ collectionSlug: 'images' }),
        )
        const response = await fetch('/api/animations', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draft: false,
            poster: relationshipID(document.poster),
            video: document.id,
          }),
        })
        if (!response.ok) throw new Error(await responseError(response, 'Unable to create Animation.'))
        succeeded += 1
      } catch (error) {
        failed.push({ filename: file.name, message: error instanceof Error ? error.message : 'Upload failed.' })
      }
    }

    setRunning(false)
    setProgress('')
    setResult({ failed, succeeded })
    router.refresh()
  }

  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', marginBottom: '24px', padding: '16px' }}>
      <strong style={{ display: 'block', marginBottom: '8px' }}>Bulk upload Animations</strong>
      <p style={{ color: 'var(--theme-elevation-600)', margin: '0 0 12px' }}>
        Select multiple MP4 files. Slug and order are generated automatically.
      </p>
      <input
        accept="video/mp4"
        disabled={running}
        multiple
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files || [])
          if (files.length > 0) void uploadFiles(files)
          event.currentTarget.value = ''
        }}
        type="file"
      />
      <div aria-live="polite" style={{ fontSize: '13px', marginTop: '10px' }}>
        {progress}
        {result && <div>{result.succeeded} uploaded successfully.</div>}
        {result?.failed.map((failure) => (
          <div key={failure.filename} style={{ color: 'var(--theme-error-500)' }}>
            {failure.filename}: {failure.message}
          </div>
        ))}
      </div>
    </div>
  )
}
