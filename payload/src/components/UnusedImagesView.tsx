import { Button, Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { getUsedImageIDs } from '../lib/mediaReferenceQueries'
import { UnusedImagesTable } from './UnusedImagesTable'

const positiveInteger = (value: string | string[] | undefined, fallback: number): number => {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const UnusedImagesView = async ({
  initPageResult,
  payload,
  searchParams,
}: AdminViewServerProps) => {
  const page = positiveInteger(searchParams?.page, 1)
  const limit = Math.min(100, positiveInteger(searchParams?.limit, 10))
  const usedIDs = await getUsedImageIDs({ payload, req: initPageResult.req })
  const where = usedIDs.size > 0 ? { id: { not_in: Array.from(usedIDs) } } : undefined
  const result = await payload.find({
    collection: 'images',
    depth: 0,
    limit,
    overrideAccess: false,
    page,
    req: initPageResult.req,
    user: initPageResult.req.user,
    where,
  })
  const adminRoute = payload.config.routes.admin
  const unusedPath = `${adminRoute}/collections/images/unused`
  const imagesPath = `${adminRoute}/collections/images`
  const pageURL = (nextPage: number) => `${unusedPath}?page=${nextPage}&limit=${limit}`

  return (
    <Gutter>
      <div style={{ paddingBlock: '36px' }}>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Unused Images</h1>
            <p style={{ color: 'var(--theme-elevation-600)', marginBottom: 0 }}>
              Images with no current references. Every delete is checked again at request time.
            </p>
          </div>
          <Button buttonStyle="secondary" el="link" to={imagesPath}>
            All Images
          </Button>
        </div>

        {result.docs.length === 0 ? (
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
          <UnusedImagesTable
            docs={result.docs.map((image) => ({
              alt: image.alt,
              filename: image.filename,
              id: image.id,
              thumbnailURL: image.sizes?.thumbnail?.url ?? image.thumbnailURL ?? image.url,
            }))}
            imagesPath={imagesPath}
            page={result.page ?? page}
            previousPageURL={page > 1 ? pageURL(page - 1) : undefined}
          />
        )}

        {result.totalPages > 1 && (
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: '12px',
              justifyContent: 'space-between',
              marginTop: '24px',
            }}
          >
            <span>
              Page {result.page} of {result.totalPages} · {result.totalDocs} unused
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {result.hasPrevPage && (
                <Button
                  buttonStyle="secondary"
                  el="link"
                  size="small"
                  to={pageURL(result.prevPage ?? 1)}
                >
                  Previous
                </Button>
              )}
              {result.hasNextPage && result.nextPage && (
                <Button
                  buttonStyle="secondary"
                  el="link"
                  size="small"
                  to={pageURL(result.nextPage)}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Gutter>
  )
}
