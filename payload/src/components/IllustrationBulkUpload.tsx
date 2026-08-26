'use client'

import { useUploadHandlers } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { findOrCreateImage, responseError } from './illustrationAdminUtils'
import { sortFilesNaturally } from './clientMediaUpload'

type UploadResult = {
  failed: Array<{ filename: string; message: string }>
  succeeded: string[]
}

export const IllustrationBulkUpload: React.FC = () => {
  const { getUploadHandler } = useUploadHandlers()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<UploadResult | null>(null)
  const inputID = useId()
  const router = useRouter()

  const uploadFiles = async (selectedFiles: File[]) => {
    const files = sortFilesNaturally(selectedFiles)
    const nextResult: UploadResult = { failed: [], succeeded: [] }
    setRunning(true)
    setResult(null)

    for (const [index, file] of files.entries()) {
      setProgress(`Processing ${index + 1} of ${files.length}: ${file.name}`)

      try {
        const { document } = await findOrCreateImage(
          file,
          getUploadHandler({ collectionSlug: 'images' }),
        )
        const response = await fetch('/api/illustrations', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: false, image: document.id }),
        })

        if (!response.ok) {
          throw new Error(await responseError(response, 'Unable to create Illustration.'))
        }

        nextResult.succeeded.push(file.name)
      } catch (error) {
        nextResult.failed.push({
          filename: file.name,
          message: error instanceof Error ? error.message : 'Upload failed.',
        })
      }
    }

    setRunning(false)
    setProgress('')
    setResult(nextResult)
    router.refresh()
  }

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
        Select multiple images. Slug and order are generated automatically.
      </p>
      <input
        accept="image/*"
        disabled={running}
        id={inputID}
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
        {result && (
          <>
            <div>{result.succeeded.length} uploaded successfully.</div>
            {result.failed.map((failure) => (
              <div key={failure.filename} style={{ color: 'var(--theme-error-500)' }}>
                {failure.filename}: {failure.message}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
