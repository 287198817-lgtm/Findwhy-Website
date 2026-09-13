import { describe, expect, it, vi } from 'vitest'

import {
  createImageStorageRouter,
  createImagesRoutingAdapter,
  replaceImageFiles,
  resolveStoredImageProvider,
} from '../../src/storage/images/routingAdapter'
import { createAliyunOSSImageProvider } from '../../src/storage/images/aliyunOSSProvider'
import { assignImageStorageProvider } from '../../src/storage/images/assignStorageProvider'
import type { ImageStorageFile, ImageStorageProvider } from '../../src/storage/images/types'
import { createVercelBlobImageProvider } from '../../src/storage/images/vercelBlobProvider'

const file: ImageStorageFile = {
  buffer: Buffer.from('image'),
  filename: 'original.jpg',
  mimeType: 'image/jpeg',
}

const makeProvider = (name: ImageStorageProvider['name']) => ({
  name,
  deleteFile: vi.fn(async () => undefined),
  generateURL: vi.fn(({ filename }: { filename: string }) =>
    name === 'vercel-blob'
      ? `https://store.public.blob.vercel-storage.com/images/${filename}`
      : `https://img.findwhy.art/images/${filename}`),
  uploadFile: vi.fn(async () => undefined),
}) satisfies ImageStorageProvider

const setup = () => {
  const blob = makeProvider('vercel-blob')
  const oss = makeProvider('aliyun-oss')
  return {
    blob,
    oss,
    router: createImageStorageRouter({
      activeUploadProvider: 'vercel-blob',
      providers: { 'aliyun-oss': oss, 'vercel-blob': blob },
      readClientUpload: async () => new Response(null, { status: 200 }),
    }),
  }
}

describe('image storage routing', () => {
  it('preserves the production Blob URL shape and the OSS public URL shape', () => {
    const blob = createVercelBlobImageProvider({
      token: 'vercel_blob_rw_store123_token123',
    })
    const oss = createAliyunOSSImageProvider({
      accessKeyId: 'test-access-key',
      bucket: 'findwhy-assets',
      endpoint: 'https://oss-cn-shanghai.aliyuncs.com',
      publicBaseURL: 'https://img.findwhy.art',
      region: 'cn-shanghai',
      secretAccessKey: 'test-secret-key',
    })

    expect(blob.generateURL({ filename: 'work 01.jpg' })).toBe(
      'https://store123.public.blob.vercel-storage.com/images/work%2001.jpg',
    )
    expect(oss.generateURL({ filename: 'work 01.webp' })).toBe(
      'https://img.findwhy.art/images/work%2001.webp',
    )
  })

  it('routes null and explicit Vercel ownership to Blob', async () => {
    const { blob, oss, router } = setup()
    expect(resolveStoredImageProvider(null)).toBe('vercel-blob')
    expect(router.generateURL({ storageProvider: null }, file.filename)).toContain('blob.vercel-storage.com')
    await router.deleteFile({ storageProvider: 'vercel-blob' }, file.filename)
    expect(blob.deleteFile).toHaveBeenCalledTimes(1)
    expect(oss.deleteFile).not.toHaveBeenCalled()
  })

  it('routes OSS ownership to OSS URLs and operations', async () => {
    const { blob, oss, router } = setup()
    expect(router.generateURL({ storageProvider: 'aliyun-oss' }, file.filename)).toBe(
      'https://img.findwhy.art/images/original.jpg',
    )
    await router.uploadFile({ storageProvider: 'aliyun-oss' }, file)
    await router.deleteFile({ storageProvider: 'aliyun-oss' }, file.filename)
    expect(oss.uploadFile).toHaveBeenCalledTimes(1)
    expect(oss.deleteFile).toHaveBeenCalledTimes(1)
    expect(blob.uploadFile).not.toHaveBeenCalled()
  })

  it('keeps Phase 2A uploads on Blob when ownership is unset', async () => {
    const { blob, oss, router } = setup()
    await expect(router.uploadFile({ storageProvider: null }, file)).resolves.toBe('vercel-blob')
    expect(blob.uploadFile).toHaveBeenCalledTimes(1)
    expect(oss.uploadFile).not.toHaveBeenCalled()
  })

  it('exposes one Payload adapter while keeping client uploads disabled in Phase 2A', async () => {
    const { blob, oss } = setup()
    const adapter = createImagesRoutingAdapter({
      activeUploadProvider: 'vercel-blob',
      providers: { 'aliyun-oss': oss, 'vercel-blob': blob },
      readClientUpload: async () => new Response(null, { status: 200 }),
    })({ collection: { slug: 'images' }, prefix: 'images' } as never)

    expect(adapter.name).toBe('findwhy-images-routing')
    expect(adapter.clientUploads).toBe(true)
  })

  it('routes original and all image sizes through the document owner', async () => {
    const filenames = ['original.jpg', 'thumbnail.jpg', 'card.webp', 'portfolio.webp']
    const { blob, oss, router } = setup()
    for (const filename of filenames) await router.deleteFile({ storageProvider: null }, filename)
    expect(blob.deleteFile).toHaveBeenCalledTimes(4)
    expect(oss.deleteFile).not.toHaveBeenCalled()

    for (const filename of filenames) await router.deleteFile({ storageProvider: 'aliyun-oss' }, filename)
    expect(oss.deleteFile).toHaveBeenCalledTimes(4)
  })

  it('does not mutate provider during metadata-only routing', () => {
    const { router } = setup()
    const doc = { storageProvider: 'vercel-blob' as const }
    router.generateURL(doc, file.filename)
    expect(doc.storageProvider).toBe('vercel-blob')
  })

  it('deletes previous Blob files only after every OSS upload succeeds', async () => {
    const events: string[] = []
    await replaceImageFiles({
      nextFiles: [file, { ...file, filename: 'card.webp' }],
      uploadNext: async (next) => { events.push(`upload:${next.filename}`) },
      deletePrevious: async () => { events.push('delete:previous-blob') },
    })
    expect(events.at(-1)).toBe('delete:previous-blob')
  })

  it('does not delete previous Blob files when an OSS upload fails', async () => {
    const deletePrevious = vi.fn(async () => undefined)
    await expect(replaceImageFiles({
      nextFiles: [file],
      uploadNext: async () => { throw new Error('upload failed') },
      deletePrevious,
    })).rejects.toThrow('upload failed')
    expect(deletePrevious).not.toHaveBeenCalled()
  })

  it('fails closed for unknown providers', async () => {
    const { blob, oss, router } = setup()
    expect(() => router.generateURL({ storageProvider: 'unknown' }, file.filename)).toThrow(
      'Image storage generate-url failed',
    )
    await expect(router.deleteFile({ storageProvider: 'unknown' }, file.filename)).rejects.toThrow(
      'Image storage delete failed',
    )
    expect(blob.deleteFile).not.toHaveBeenCalled()
    expect(oss.deleteFile).not.toHaveBeenCalled()
  })

  it('compensates original and successful derivatives after a later OSS upload fails', async () => {
    const blob = makeProvider('vercel-blob')
    const oss = makeProvider('aliyun-oss')
    oss.uploadFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('card upload failed'))
    const adapter = createImagesRoutingAdapter({
      activeUploadProvider: 'aliyun-oss',
      providers: { 'aliyun-oss': oss, 'vercel-blob': blob },
      readClientUpload: async () => new Response(null, { status: 200 }),
    })({ collection: { slug: 'images' }, prefix: 'images' } as never)
    const data = { filename: 'original.jpg', storageProvider: 'aliyun-oss' }
    const req = { context: {} } as never

    const first = adapter.handleUpload({ data, file: { ...file, filename: 'thumbnail.jpg' }, req } as never)
    const second = adapter.handleUpload({ data, file: { ...file, filename: 'card.webp' }, req } as never)
    const results = await Promise.allSettled([first, second])

    expect(results.some((result) => result.status === 'rejected')).toBe(true)
    expect(oss.deleteFile).toHaveBeenCalledWith({ docPrefix: undefined, filename: 'original.jpg' })
    expect(oss.deleteFile).toHaveBeenCalledWith({ docPrefix: undefined, filename: 'thumbnail.jpg' })
    expect(blob.deleteFile).not.toHaveBeenCalled()
  })

  it('sets OSS ownership only from trusted upload context and preserves metadata updates', () => {
    const previousFlag = process.env.ENABLE_IMAGES_STORAGE_ROUTER
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = 'true'
    const uploadData = { storageProvider: 'vercel-blob' }
    const metadataData = { alt: 'Updated', storageProvider: 'aliyun-oss' }
    const untrustedCreate = { storageProvider: 'aliyun-oss' }

    assignImageStorageProvider({
      data: uploadData,
      operation: 'create',
      req: { file: { clientUploadContext: { storageProvider: 'aliyun-oss' } } },
    } as never)
    assignImageStorageProvider({
      data: metadataData,
      operation: 'update',
      originalDoc: { storageProvider: 'vercel-blob' },
      req: {},
    } as never)
    assignImageStorageProvider({ data: untrustedCreate, operation: 'create', req: {} } as never)

    expect(uploadData.storageProvider).toBe('aliyun-oss')
    expect(metadataData.storageProvider).toBe('vercel-blob')
    expect(untrustedCreate).not.toHaveProperty('storageProvider')
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = previousFlag
  })
})
