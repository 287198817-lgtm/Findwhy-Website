import { describe, expect, it, vi } from 'vitest'

import { Images } from '../../src/collections/Images'
import { findOrCreateImage } from '../../src/components/illustrationAdminUtils'
import {
  createImageStorageRouter,
  createImagesRoutingAdapter,
  replaceImageFiles,
  resolveStoredImageProvider,
} from '../../src/storage/images/routingAdapter'
import { createAliyunOSSImageProvider } from '../../src/storage/images/aliyunOSSProvider'
import { assignImageStorageProvider } from '../../src/storage/images/assignStorageProvider'
import { resolveImageClientUploadTarget } from '../../src/storage/images/clientUploadTarget'
import { createImageUploadNamespace, getImageStorageKey } from '../../src/storage/images/key'
import type { ImageStorageFile, ImageStorageProvider } from '../../src/storage/images/types'
import {
  isTrustedImageUploadContext,
  signImageUploadContext,
} from '../../src/storage/images/uploadContext'
import { createVercelBlobImageProvider } from '../../src/storage/images/vercelBlobProvider'
import {
  compensateFailedImageReplacement,
  getSkippedPreviousNamespaceFilenames,
  IMAGE_UPLOAD_CONTEXT_TTL_MS,
} from '../../src/storage/images/plugin'
import { preserveCanonicalImageFilename } from '../../src/storage/images/preserveCanonicalFilename'

const file: ImageStorageFile = {
  buffer: Buffer.from('image'),
  filename: 'original.jpg',
  mimeType: 'image/jpeg',
}

const validContextTime = {
  expiresAt: Date.now() + 30 * 60 * 1000,
  issuedAt: Date.now() - 1000,
}

const makeProvider = (name: ImageStorageProvider['name']) =>
  ({
    name,
    deleteFile: vi.fn(async () => undefined),
    generateURL: vi.fn(
      ({ docPrefix, filename }: { docPrefix?: null | string; filename: string }) =>
        name === 'vercel-blob'
          ? `https://store.public.blob.vercel-storage.com/${docPrefix || 'images'}/${filename}`
          : `https://img.findwhy.art/${docPrefix || 'images'}/${filename}`,
    ),
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
  it('allows duplicate display filenames only across distinct storage namespaces', () => {
    expect(Images.upload).toMatchObject({
      filenameCompoundIndex: ['prefix', 'filename'],
    })

    const filename = '8.jpg'
    const prefixA = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const prefixB = 'images/preview/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const documents = [
      { filename, id: 1, prefix: prefixA },
      { filename, id: 2, prefix: prefixB },
    ]
    expect(documents.filter((document) => document.filename === filename)).toHaveLength(2)
    expect([prefixA, filename]).not.toEqual([prefixB, filename])
    expect(getImageStorageKey({ docPrefix: prefixA, filename })).not.toBe(
      getImageStorageKey({ docPrefix: prefixB, filename }),
    )
  })

  it('does not use display filename as image document identity', async () => {
    const previousFetch = global.fetch
    const requests: string[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input))
      return new Response(JSON.stringify({ doc: { filename: '8.jpg', id: 2 } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 201,
      })
    }) as typeof fetch

    try {
      const result = await findOrCreateImage(
        new File(['image'], '8.jpg', { type: 'image/jpeg' }),
        null,
      )
      expect(result).toEqual({ document: { filename: '8.jpg', id: 2 }, reused: false })
      expect(requests).toHaveLength(1)
      expect(requests[0]).toBe('/api/images')
      expect(requests[0]).not.toContain('where%5Bfilename%5D')
    } finally {
      global.fetch = previousFetch
    }
  })

  it('uses explicit environment and independent 128-bit upload namespaces', () => {
    const preview = createImageUploadNamespace({
      environment: 'preview',
      uploadID: '0123456789abcdef0123456789abcdef',
    })
    const production = createImageUploadNamespace({
      environment: 'production',
      uploadID: '0123456789abcdef0123456789abcdef',
    })
    const productionSecond = createImageUploadNamespace({ environment: 'production' })
    const productionThird = createImageUploadNamespace({ environment: 'production' })

    expect(preview).toBe('images/preview/0123456789abcdef0123456789abcdef')
    expect(production).toBe('images/production/0123456789abcdef0123456789abcdef')
    expect(preview).not.toBe(production)
    expect(productionSecond).not.toBe(productionThird)
    expect(productionSecond.split('/').at(-1)).toMatch(/^[a-f\d]{32}$/)
    expect(getImageStorageKey({ docPrefix: productionSecond, filename: '8.jpg' })).not.toBe(
      getImageStorageKey({ docPrefix: productionThird, filename: '8.jpg' }),
    )
  })

  it('rejects a forged or cross-environment client upload namespace', () => {
    const secret = 'unit-test-secret'
    const prefix = 'images/preview/0123456789abcdef0123456789abcdef'
    const context = {
      ...validContextTime,
      filename: '8.jpg',
      operation: 'create' as const,
      prefix,
      signature: signImageUploadContext({
        ...validContextTime,
        filename: '8.jpg',
        operation: 'create',
        prefix,
        secret,
        storageEnvironment: 'preview',
      }),
      storageEnvironment: 'preview' as const,
      storageProvider: 'aliyun-oss' as const,
    }
    expect(
      isTrustedImageUploadContext({
        context,
        filename: '8.jpg',
        secret,
        storageEnvironment: 'preview',
      }),
    ).toBe(true)
    expect(
      isTrustedImageUploadContext({
        context,
        filename: '8.jpg',
        secret,
        storageEnvironment: 'production',
      }),
    ).toBe(false)
    expect(
      isTrustedImageUploadContext({
        context: { ...context, prefix: `${prefix}0` },
        filename: '8.jpg',
        secret,
        storageEnvironment: 'preview',
      }),
    ).toBe(false)
  })

  it('keeps four logical files in one namespace without changing display filenames', () => {
    const prefix = createImageUploadNamespace({
      environment: 'production',
      uploadID: 'fedcba9876543210fedcba9876543210',
    })
    const filenames = ['8.jpg', '8-329x480.jpg', '8-1200x1752.webp', '8-2500x3650.jpg']
    const keys = filenames.map((filename) => getImageStorageKey({ docPrefix: prefix, filename }))
    expect(keys).toEqual(filenames.map((filename) => `${prefix}/${filename}`))
    expect(new Set(keys).size).toBe(4)
    expect(filenames[0]).toBe('8.jpg')
  })

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
    expect(router.generateURL({ storageProvider: null }, file.filename)).toContain(
      'blob.vercel-storage.com',
    )
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

    for (const filename of filenames)
      await router.deleteFile({ storageProvider: 'aliyun-oss' }, filename)
    expect(oss.deleteFile).toHaveBeenCalledTimes(4)
  })

  it('deletes only the selected document namespace when filenames match', async () => {
    const { oss, router } = setup()
    const prefixA = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const prefixB = 'images/preview/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const filenames = ['8.jpg', '8-thumb.jpg', '8-card.webp', '8-portfolio.jpg']
    for (const filename of filenames) {
      await router.deleteFile({ prefix: prefixA, storageProvider: 'aliyun-oss' }, filename)
    }
    expect(oss.deleteFile).toHaveBeenCalledTimes(4)
    expect(oss.deleteFile).toHaveBeenCalledWith({ docPrefix: prefixA, filename: '8.jpg' })
    expect(oss.deleteFile).not.toHaveBeenCalledWith({ docPrefix: prefixB, filename: '8.jpg' })
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
      uploadNext: async (next) => {
        events.push(`upload:${next.filename}`)
      },
      deletePrevious: async () => {
        events.push('delete:previous-blob')
      },
    })
    expect(events.at(-1)).toBe('delete:previous-blob')
  })

  it('recognizes same display filenames as distinct files after a namespace replacement', () => {
    const sizes = {
      card: { filename: '8-card.webp' },
      thumbnail: { filename: '8-thumb.jpg' },
    }
    expect(
      getSkippedPreviousNamespaceFilenames({
        doc: {
          filename: '8.jpg',
          prefix: 'images/production/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          sizes,
        },
        previousDoc: {
          filename: '8.jpg',
          prefix: 'images/production/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          sizes,
        },
      }),
    ).toEqual(['8.jpg', '8-card.webp', '8-thumb.jpg'])
    expect(
      getSkippedPreviousNamespaceFilenames({
        doc: { filename: '8.jpg', prefix: 'images', sizes },
        previousDoc: { filename: '8.jpg', prefix: 'images', sizes },
      }),
    ).toEqual([])
  })

  it('does not delete previous Blob files when an OSS upload fails', async () => {
    const deletePrevious = vi.fn(async () => undefined)
    await expect(
      replaceImageFiles({
        nextFiles: [file],
        uploadNext: async () => {
          throw new Error('upload failed')
        },
        deletePrevious,
      }),
    ).rejects.toThrow('upload failed')
    expect(deletePrevious).not.toHaveBeenCalled()
  })

  it('cleans the new namespace and preserves the old namespace on replacement failure', async () => {
    const events: string[] = []
    await expect(
      replaceImageFiles({
        nextFiles: [file, { ...file, filename: 'card.webp' }],
        uploadNext: async (next) => {
          events.push(`upload-new:${next.filename}`)
          if (next.filename === 'card.webp') throw new Error('partial failure')
        },
        cleanupNext: async () => {
          events.push('cleanup-new-namespace')
        },
        deletePrevious: async () => {
          events.push('delete-old-namespace')
        },
      }),
    ).rejects.toThrow('partial failure')
    expect(events).toContain('cleanup-new-namespace')
    expect(events).not.toContain('delete-old-namespace')
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
    const data = {
      filename: 'original.jpg',
      prefix: 'images/preview/0123456789abcdef0123456789abcdef',
      storageProvider: 'aliyun-oss',
    }
    const req = { context: {} } as never

    const first = adapter.handleUpload({
      data,
      file: { ...file, filename: 'thumbnail.jpg' },
      req,
    } as never)
    const second = adapter.handleUpload({
      data,
      file: { ...file, filename: 'card.webp' },
      req,
    } as never)
    const results = await Promise.allSettled([first, second])

    expect(results.some((result) => result.status === 'rejected')).toBe(true)
    expect(oss.deleteFile).toHaveBeenCalledWith({
      docPrefix: data.prefix,
      filename: 'original.jpg',
    })
    expect(oss.deleteFile).toHaveBeenCalledWith({
      docPrefix: data.prefix,
      filename: 'thumbnail.jpg',
    })
    expect(blob.deleteFile).not.toHaveBeenCalled()
  })

  it('sets OSS ownership only from trusted upload context and preserves metadata updates', () => {
    const previousFlag = process.env.ENABLE_IMAGES_STORAGE_ROUTER
    const previousEnvironment = process.env.IMAGES_STORAGE_ENV
    const previousSecret = process.env.PAYLOAD_SECRET
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = 'true'
    process.env.IMAGES_STORAGE_ENV = 'preview'
    process.env.PAYLOAD_SECRET = 'unit-test-secret'
    const prefix = 'images/preview/0123456789abcdef0123456789abcdef'
    const signature = signImageUploadContext({
      ...validContextTime,
      filename: '8.jpg',
      operation: 'create',
      prefix,
      secret: 'unit-test-secret',
      storageEnvironment: 'preview',
    })
    const uploadData = { storageProvider: 'vercel-blob' }
    const metadataData = { alt: 'Updated', prefix: 'forged', storageProvider: 'aliyun-oss' }
    const untrustedCreate = { storageProvider: 'aliyun-oss' }

    assignImageStorageProvider({
      data: uploadData,
      operation: 'create',
      req: {
        file: {
          clientUploadContext: {
            ...validContextTime,
            filename: '8.jpg',
            operation: 'create',
            prefix,
            signature,
            storageEnvironment: 'preview',
            storageProvider: 'aliyun-oss',
          },
          name: '8.jpg',
        },
      },
    } as never)
    assignImageStorageProvider({
      data: metadataData,
      operation: 'update',
      originalDoc: { prefix: 'images', storageProvider: 'vercel-blob' },
      req: {},
    } as never)
    assignImageStorageProvider({ data: untrustedCreate, operation: 'create', req: {} } as never)

    expect(uploadData.storageProvider).toBe('aliyun-oss')
    expect(uploadData).toHaveProperty('prefix', prefix)
    expect(metadataData.storageProvider).toBe('vercel-blob')
    expect(metadataData.prefix).toBe('images')
    expect(untrustedCreate).not.toHaveProperty('storageProvider')
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = previousFlag
    process.env.IMAGES_STORAGE_ENV = previousEnvironment
    process.env.PAYLOAD_SECRET = previousSecret
  })

  it('binds replacement upload context to operation and document identity', () => {
    const secret = 'unit-test-secret'
    const oldPrefix = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const prefix = 'images/preview/0123456789abcdef0123456789abcdef'
    const context = {
      ...validContextTime,
      documentID: '123',
      filename: '8.jpg',
      oldPrefix,
      operation: 'replacement' as const,
      prefix,
      signature: signImageUploadContext({
        ...validContextTime,
        documentID: '123',
        filename: '8.jpg',
        oldPrefix,
        operation: 'replacement',
        prefix,
        secret,
        storageEnvironment: 'preview',
      }),
      storageEnvironment: 'preview' as const,
      storageProvider: 'aliyun-oss' as const,
    }

    expect(
      isTrustedImageUploadContext({
        context,
        documentID: '123',
        filename: '8.jpg',
        oldPrefix,
        operation: 'replacement',
        secret,
        storageEnvironment: 'preview',
      }),
    ).toBe(true)
    expect(
      isTrustedImageUploadContext({
        context,
        documentID: '124',
        filename: '8.jpg',
        oldPrefix,
        operation: 'replacement',
        secret,
        storageEnvironment: 'preview',
      }),
    ).toBe(false)
    expect(
      isTrustedImageUploadContext({
        context,
        documentID: '123',
        filename: '8.jpg',
        operation: 'create',
        secret,
        storageEnvironment: 'preview',
      }),
    ).toBe(false)
    expect(
      isTrustedImageUploadContext({
        context: { ...context, prefix: oldPrefix },
        documentID: '123',
        filename: '8.jpg',
        oldPrefix,
        operation: 'replacement',
        secret,
        storageEnvironment: 'preview',
      }),
    ).toBe(false)
  })

  it('preserves the signed canonical filename only for the matching replacement document', () => {
    const previousFlag = process.env.ENABLE_IMAGES_STORAGE_ROUTER
    const previousEnvironment = process.env.IMAGES_STORAGE_ENV
    const previousSecret = process.env.PAYLOAD_SECRET
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = 'true'
    process.env.IMAGES_STORAGE_ENV = 'preview'
    process.env.PAYLOAD_SECRET = 'unit-test-secret'
    const oldPrefix = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const prefix = 'images/preview/0123456789abcdef0123456789abcdef'
    const clientUploadContext = {
      ...validContextTime,
      documentID: '123',
      filename: '8.jpg',
      oldPrefix,
      operation: 'replacement' as const,
      prefix,
      signature: signImageUploadContext({
        ...validContextTime,
        documentID: '123',
        filename: '8.jpg',
        oldPrefix,
        operation: 'replacement',
        prefix,
        secret: 'unit-test-secret',
        storageEnvironment: 'preview',
      }),
      storageEnvironment: 'preview' as const,
      storageProvider: 'aliyun-oss' as const,
    }
    const args = {
      id: 123,
      overwriteExistingFiles: false,
      req: { file: { clientUploadContext, name: '8.jpg' } },
    }

    const trusted = preserveCanonicalImageFilename({
      args,
      operation: 'update',
      req: args.req,
    } as never) as typeof args
    const wrongDocument = preserveCanonicalImageFilename({
      args: { ...args, id: 124 },
      operation: 'update',
      req: args.req,
    } as never) as typeof args

    expect(trusted.overwriteExistingFiles).toBe(true)
    expect(wrongDocument.overwriteExistingFiles).toBe(false)
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = previousFlag
    process.env.IMAGES_STORAGE_ENV = previousEnvironment
    process.env.PAYLOAD_SECRET = previousSecret
  })

  it('replaces stale form prefix with the signed fresh namespace in a realistic update hook', () => {
    const previousFlag = process.env.ENABLE_IMAGES_STORAGE_ROUTER
    const previousEnvironment = process.env.IMAGES_STORAGE_ENV
    const previousSecret = process.env.PAYLOAD_SECRET
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = 'true'
    process.env.IMAGES_STORAGE_ENV = 'preview'
    process.env.PAYLOAD_SECRET = 'unit-test-secret'
    const oldPrefix = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const newPrefix = 'images/preview/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const target = resolveImageClientUploadTarget({
      data: { id: 123, prefix: oldPrefix },
      docPrefix: oldPrefix,
    })
    const context = {
      ...target,
      ...validContextTime,
      filename: '8.jpg',
      prefix: newPrefix,
      signature: signImageUploadContext({
        ...target,
        ...validContextTime,
        filename: '8.jpg',
        prefix: newPrefix,
        secret: 'unit-test-secret',
        storageEnvironment: 'preview',
      }),
      storageEnvironment: 'preview' as const,
      storageProvider: 'aliyun-oss' as const,
    }
    const data = { filename: '8.jpg', prefix: oldPrefix }

    assignImageStorageProvider({
      data,
      operation: 'update',
      originalDoc: { id: 123, prefix: oldPrefix, storageProvider: 'aliyun-oss' },
      req: { file: { clientUploadContext: context, name: '8.jpg' } },
    } as never)

    expect(target).toEqual({ documentID: '123', oldPrefix, operation: 'replacement' })
    expect(data.prefix).toBe(newPrefix)
    process.env.ENABLE_IMAGES_STORAGE_ROUTER = previousFlag
    process.env.IMAGES_STORAGE_ENV = previousEnvironment
    process.env.PAYLOAD_SECRET = previousSecret
  })

  it.each(['8.jpg', 'new.jpg'])(
    'rotates the namespace for a realistic %s replacement while old prefix remains in form data',
    (filename) => {
      const previousFlag = process.env.ENABLE_IMAGES_STORAGE_ROUTER
      const previousEnvironment = process.env.IMAGES_STORAGE_ENV
      const previousSecret = process.env.PAYLOAD_SECRET
      process.env.ENABLE_IMAGES_STORAGE_ROUTER = 'true'
      process.env.IMAGES_STORAGE_ENV = 'preview'
      process.env.PAYLOAD_SECRET = 'unit-test-secret'
      let oldPrefix = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

      for (const newPrefix of [
        'images/preview/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'images/preview/cccccccccccccccccccccccccccccccc',
      ]) {
        const target = resolveImageClientUploadTarget({
          data: { id: 123, prefix: oldPrefix },
          docPrefix: oldPrefix,
        })
        const context = {
          ...target,
          ...validContextTime,
          filename,
          prefix: newPrefix,
          signature: signImageUploadContext({
            ...target,
            ...validContextTime,
            filename,
            prefix: newPrefix,
            secret: 'unit-test-secret',
            storageEnvironment: 'preview',
          }),
          storageEnvironment: 'preview' as const,
          storageProvider: 'aliyun-oss' as const,
        }
        const data = { filename, prefix: oldPrefix }
        assignImageStorageProvider({
          data,
          operation: 'update',
          originalDoc: { id: 123, prefix: oldPrefix, storageProvider: 'aliyun-oss' },
          req: { file: { clientUploadContext: context, name: filename } },
        } as never)
        expect(data.prefix).toBe(newPrefix)
        expect(data.prefix).not.toBe(oldPrefix)
        oldPrefix = newPrefix
      }

      process.env.ENABLE_IMAGES_STORAGE_ROUTER = previousFlag
      process.env.IMAGES_STORAGE_ENV = previousEnvironment
      process.env.PAYLOAD_SECRET = previousSecret
    },
  )

  it('accepts delayed saves within the context TTL and rejects expired contexts', () => {
    const issuedAt = 1_000_000
    const expiresAt = issuedAt + IMAGE_UPLOAD_CONTEXT_TTL_MS
    const oldPrefix = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const prefix = 'images/preview/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const context = {
      documentID: '123',
      expiresAt,
      filename: '8.jpg',
      issuedAt,
      oldPrefix,
      operation: 'replacement' as const,
      prefix,
      signature: signImageUploadContext({
        documentID: '123',
        expiresAt,
        filename: '8.jpg',
        issuedAt,
        oldPrefix,
        operation: 'replacement',
        prefix,
        secret: 'unit-test-secret',
        storageEnvironment: 'preview',
      }),
      storageEnvironment: 'preview' as const,
      storageProvider: 'aliyun-oss' as const,
    }
    const validate = (now: number) =>
      isTrustedImageUploadContext({
        context,
        documentID: '123',
        filename: '8.jpg',
        now,
        oldPrefix,
        operation: 'replacement',
        secret: 'unit-test-secret',
        storageEnvironment: 'preview',
      })

    expect(validate(issuedAt + 20 * 60 * 1000)).toBe(true)
    expect(validate(expiresAt)).toBe(false)
  })

  it('compensates a signed PATCH failure without deleting the previous namespace', async () => {
    const oldPrefix = 'images/preview/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const prefix = 'images/preview/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const cleanupNamespace = vi.fn(async () => undefined)
    const context = {
      ...validContextTime,
      documentID: '123',
      filename: '8.jpg',
      oldPrefix,
      operation: 'replacement' as const,
      prefix,
      signature: signImageUploadContext({
        ...validContextTime,
        documentID: '123',
        filename: '8.jpg',
        oldPrefix,
        operation: 'replacement',
        prefix,
        secret: 'unit-test-secret',
        storageEnvironment: 'preview',
      }),
      storageEnvironment: 'preview' as const,
      storageProvider: 'aliyun-oss' as const,
    }

    await expect(
      compensateFailedImageReplacement({
        cleanupNamespace,
        context,
        currentPrefix: oldPrefix,
        payloadSecret: 'unit-test-secret',
        storageEnvironment: 'preview',
      }),
    ).resolves.toBe(true)
    expect(cleanupNamespace).toHaveBeenCalledExactlyOnceWith(prefix)
    expect(cleanupNamespace).not.toHaveBeenCalledWith(oldPrefix)

    cleanupNamespace.mockClear()
    await expect(
      compensateFailedImageReplacement({
        cleanupNamespace,
        context,
        currentPrefix: prefix,
        payloadSecret: 'unit-test-secret',
        storageEnvironment: 'preview',
      }),
    ).resolves.toBe(false)
    expect(cleanupNamespace).not.toHaveBeenCalled()
  })

  it.each(['8.jpg', 'new.jpg'])(
    'keeps %s as the canonical document and original-object filename during replacement',
    (filename) => {
      const prefix = createImageUploadNamespace({ environment: 'preview' })
      const document = { filename, prefix }
      expect(getImageStorageKey({ docPrefix: prefix, filename: document.filename })).toBe(
        `${prefix}/${document.filename}`,
      )
      expect([
        document.filename,
        filename.replace(/\.jpg$/, '-329x480.jpg'),
        filename.replace(/\.jpg$/, '-1200x1752.webp'),
        filename.replace(/\.jpg$/, '-2500x3650.jpg'),
      ]).toHaveLength(4)
    },
  )
})
