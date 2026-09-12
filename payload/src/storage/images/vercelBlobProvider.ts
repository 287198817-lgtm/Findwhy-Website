import { del, put } from '@vercel/blob'

import { encodeStorageKey, getImageStorageKey } from './key'
import type { ImageStorageProvider } from './types'

type VercelBlobProviderOptions = {
  baseURL?: string
  token: string
}

const getStoreID = (token: string) =>
  token.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)?.[1]?.toLowerCase()

export const createVercelBlobImageProvider = ({
  baseURL,
  token,
}: VercelBlobProviderOptions): ImageStorageProvider => {
  const storeID = getStoreID(token)
  const publicBaseURL = baseURL?.replace(/\/+$/, '') ||
    (storeID ? `https://${storeID}.public.blob.vercel-storage.com` : null)

  if (!publicBaseURL) {
    throw new Error('A valid Vercel Blob token or explicit base URL is required.')
  }

  return {
    name: 'vercel-blob',
    generateURL: ({ docPrefix, filename }) => {
      const key = getImageStorageKey({ docPrefix, filename })
      return `${publicBaseURL}/${encodeStorageKey(key)}`
    },
    uploadFile: async ({ docPrefix, file }) => {
      const key = getImageStorageKey({ docPrefix, filename: file.filename })
      await put(key, file.buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: file.mimeType,
        token,
      })
    },
    deleteFile: async ({ docPrefix, filename }) => {
      const key = getImageStorageKey({ docPrefix, filename })
      await del(`${publicBaseURL}/${encodeStorageKey(key)}`, { token })
    },
  }
}
