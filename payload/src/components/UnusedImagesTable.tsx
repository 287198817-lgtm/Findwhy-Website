'use client'

import { Button, ConfirmationModal, toast, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

type UnusedImage = {
  alt?: null | string
  filename?: null | string
  id: number | string
  thumbnailURL?: null | string
}

type Props = {
  docs: UnusedImage[]
  imagesPath: string
  page: number
  previousPageURL?: string
}

type DeleteFailure = {
  filename: string
  reason: string
}

type DeleteResult = {
  deleted: string[]
  failed: DeleteFailure[]
}

const modalSlug = 'confirm-delete-unused-images'

const responseError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as {
      errors?: Array<{ message?: string }>
      message?: string
    }
    return body.errors?.[0]?.message || body.message || `Delete failed (${response.status}).`
  } catch {
    return `Delete failed (${response.status}).`
  }
}

export const UnusedImagesTable: React.FC<Props> = ({ docs, imagesPath, page, previousPageURL }) => {
  const [deletedIDs, setDeletedIDs] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<UnusedImage[]>([])
  const [result, setResult] = useState<DeleteResult | null>(null)
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set())
  const headerCheckbox = useRef<HTMLInputElement>(null)
  const toolbarCheckbox = useRef<HTMLInputElement>(null)
  const { openModal } = useModal()
  const router = useRouter()
  const visibleDocs = useMemo(
    () => docs.filter((doc) => !deletedIDs.has(String(doc.id))),
    [deletedIDs, docs],
  )
  const selectedDocs = visibleDocs.filter((doc) => selectedIDs.has(String(doc.id)))
  const allSelected = visibleDocs.length > 0 && selectedDocs.length === visibleDocs.length
  const partiallySelected = selectedDocs.length > 0 && !allSelected

  useEffect(() => {
    if (headerCheckbox.current) headerCheckbox.current.indeterminate = partiallySelected
    if (toolbarCheckbox.current) toolbarCheckbox.current.indeterminate = partiallySelected
  }, [partiallySelected])

  const requestConfirmation = (images: UnusedImage[]) => {
    if (images.length === 0) return
    setPending(images)
    setResult(null)
    openModal(modalSlug)
  }

  const deletePending = async () => {
    const nextResult: DeleteResult = { deleted: [], failed: [] }

    for (const image of pending) {
      const filename = image.filename || `Image ${image.id}`

      try {
        const response = await fetch(`/api/images/${encodeURIComponent(String(image.id))}`, {
          credentials: 'include',
          method: 'DELETE',
        })

        if (!response.ok) throw new Error(await responseError(response))
        nextResult.deleted.push(String(image.id))
      } catch (error) {
        nextResult.failed.push({
          filename,
          reason: error instanceof Error ? error.message : 'Unable to delete this image.',
        })
      }
    }

    if (nextResult.deleted.length > 0) {
      const deleted = new Set(nextResult.deleted)
      setDeletedIDs((current) => new Set([...current, ...deleted]))
      setSelectedIDs((current) => new Set([...current].filter((id) => !deleted.has(id))))
      toast.success(`${nextResult.deleted.length} image(s) deleted.`)
    }
    if (nextResult.failed.length > 0) {
      toast.error(`${nextResult.failed.length} image(s) could not be deleted.`)
    }

    setResult(nextResult)
    setPending([])

    if (nextResult.deleted.length === visibleDocs.length && page > 1 && previousPageURL) {
      router.push(previousPageURL)
    } else {
      router.refresh()
    }
  }

  const toggleAll = () => {
    setSelectedIDs(allSelected ? new Set() : new Set(visibleDocs.map((doc) => String(doc.id))))
  }

  const toggleOne = (id: number | string) => {
    const normalizedID = String(id)
    setSelectedIDs((current) => {
      const next = new Set(current)
      if (next.has(normalizedID)) next.delete(normalizedID)
      else next.add(normalizedID)
      return next
    })
  }

  return (
    <>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <label style={{ alignItems: 'center', display: 'flex', gap: '8px' }}>
          <input checked={allSelected} onChange={toggleAll} ref={toolbarCheckbox} type="checkbox" />
          Select current page
        </label>
        <Button
          buttonStyle="error"
          disabled={selectedDocs.length === 0}
          onClick={() => requestConfirmation(selectedDocs)}
          size="small"
          type="button"
        >
          Delete Selected ({selectedDocs.length})
        </Button>
      </div>

      {visibleDocs.length === 0 ? (
        <div
          style={{
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: '4px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <h3 style={{ marginTop: 0 }}>No unused images</h3>
          <p style={{ color: 'var(--theme-elevation-600)', marginBottom: 0 }}>
            Every image is currently referenced.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '820px', width: '100%' }}>
            <thead>
              <tr
                style={{ borderBottom: '1px solid var(--theme-elevation-150)', textAlign: 'left' }}
              >
                <th style={{ padding: '12px' }}>
                  <input
                    aria-label="Select all images on this page"
                    checked={allSelected}
                    onChange={toggleAll}
                    ref={headerCheckbox}
                    type="checkbox"
                  />
                </th>
                <th style={{ padding: '12px' }}>Thumbnail</th>
                <th style={{ padding: '12px' }}>File Name</th>
                <th style={{ padding: '12px' }}>Alt</th>
                <th style={{ padding: '12px' }}>Used By</th>
                <th style={{ padding: '12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map((image) => {
                const id = String(image.id)
                const filename = image.filename || `Image ${id}`

                return (
                  <tr key={id} style={{ borderBottom: '1px solid var(--theme-elevation-100)' }}>
                    <td style={{ padding: '12px' }}>
                      <input
                        aria-label={`Select ${filename}`}
                        checked={selectedIDs.has(id)}
                        onChange={() => toggleOne(id)}
                        type="checkbox"
                      />
                    </td>
                    <td style={{ padding: '12px' }}>
                      {image.thumbnailURL ? (
                        <img
                          alt=""
                          src={image.thumbnailURL}
                          style={{
                            display: 'block',
                            height: '64px',
                            objectFit: 'cover',
                            width: '64px',
                          }}
                        />
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <a href={`${imagesPath}/${image.id}`}>{filename}</a>
                    </td>
                    <td style={{ padding: '12px' }}>{image.alt || '—'}</td>
                    <td style={{ padding: '12px' }}>No references</td>
                    <td style={{ padding: '12px' }}>
                      <Button
                        buttonStyle="error"
                        onClick={() => requestConfirmation([image])}
                        size="small"
                        type="button"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div aria-live="polite" style={{ marginTop: '16px' }}>
          <strong>Deleted: {result.deleted.length}</strong>
          <br />
          <strong>Failed: {result.failed.length}</strong>
          {result.failed.map((failure) => (
            <div
              key={`${failure.filename}-${failure.reason}`}
              style={{ color: 'var(--theme-error-500)' }}
            >
              {failure.filename}: {failure.reason}
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        body={
          <div>
            <p>This action permanently deletes the Image document and its media file.</p>
            <ul>
              {pending.map((image) => (
                <li key={image.id}>{image.filename || `Image ${image.id}`}</li>
              ))}
            </ul>
          </div>
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmingLabel="Deleting…"
        heading={
          pending.length === 1
            ? `Delete ${pending[0]?.filename || `Image ${pending[0]?.id}`}?`
            : `Delete ${pending.length} unused images?`
        }
        modalSlug={modalSlug}
        onConfirm={deletePending}
      />
    </>
  )
}
