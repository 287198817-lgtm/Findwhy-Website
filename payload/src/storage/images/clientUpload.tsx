'use client'

import { useConfig, useDocumentInfo, useEffectEvent, useUploadHandlers } from '@payloadcms/ui'
import type { UploadCollectionSlug } from 'payload'
import { formatAdminURL } from 'payload/shared'
import type { ReactNode } from 'react'
import { Fragment, useEffect } from 'react'

import { resolveImageClientUploadTarget } from './clientUploadTarget'

type Props = {
  children: ReactNode
  collectionSlug: UploadCollectionSlug
  enabled?: boolean
  serverHandlerPath: `/${string}`
}

export const ImagesRoutingClientUploadHandler = ({
  children,
  collectionSlug,
  enabled,
  serverHandlerPath,
}: Props) => {
  const { data, id, savedDocumentData } = useDocumentInfo()
  const { setUploadHandler } = useUploadHandlers()
  const {
    config: {
      routes: { api: apiRoute },
      serverURL,
    },
  } = useConfig()

  const initializeHandler = useEffectEvent(() => {
    if (!enabled) return
    setUploadHandler({
      collectionSlug,
      handler: async ({ docPrefix, file, updateFilename }) => {
        const { documentID, oldPrefix, operation } = resolveImageClientUploadTarget({
          data,
          docPrefix,
          id,
          savedDocumentData,
        })
        const endpoint = formatAdminURL({ apiRoute, path: serverHandlerPath, serverURL })
        const response = await fetch(endpoint, {
          body: JSON.stringify({
            collectionSlug,
            docPrefix,
            documentID,
            filename: file.name,
            filesize: file.size,
            mimeType: file.type,
            oldPrefix,
            operation,
          }),
          credentials: 'include',
          method: 'POST',
        })
        if (!response.ok) throw new Error('Unable to authorize the OSS image upload.')
        const result = (await response.json()) as {
          docPrefix: string
          documentID?: string
          expiresAt: number
          filename?: string
          issuedAt: number
          oldPrefix?: string
          operation: 'create' | 'replacement'
          signature: string
          storageEnvironment: 'local' | 'preview' | 'production'
          url: string
        }
        if (result.filename && result.filename !== file.name) updateFilename(result.filename)
        const upload = await fetch(result.url, {
          body: file,
          headers: { 'Content-Length': String(file.size), 'Content-Type': file.type },
          method: 'PUT',
        })
        if (!upload.ok) throw new Error(`OSS upload failed with HTTP ${upload.status}.`)
        return {
          documentID: result.documentID,
          expiresAt: result.expiresAt,
          filename: result.filename || file.name,
          issuedAt: result.issuedAt,
          oldPrefix: result.oldPrefix,
          operation: result.operation,
          prefix: result.docPrefix,
          signature: result.signature,
          storageEnvironment: result.storageEnvironment,
          storageProvider: 'aliyun-oss',
        }
      },
    })
  })

  useEffect(() => initializeHandler(), [])
  return <Fragment>{children}</Fragment>
}
