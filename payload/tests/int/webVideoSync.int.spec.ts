import { readFile } from 'node:fs/promises'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createWebVideoSyncHook,
  makeVersionedPosterFilename,
  makeVersionedWebVideoFilename,
} from '@/hooks/syncWebVideo'

const video = {
  id: 9,
  filename: '动画.mp4',
  url: 'https://blob.example/videos/current.mp4',
  mimeType: 'video/mp4',
  filesize: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const generatedWebVideo = {
  id: 44,
  filename: 'generated.mp4',
  url: 'https://blob.example/video-web/generated.mp4',
  mimeType: 'video/mp4',
  filesize: 50,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const generatedPoster = {
  id: 120,
  filename: 'generated.jpg',
  prefix: 'images/production/0123456789abcdef0123456789abcdef',
  storageProvider: 'aliyun-oss' as const,
  url: 'https://img.example/generated.jpg',
  mimeType: 'image/jpeg',
  filesize: 80,
  width: 398,
  height: 896,
  sizes: {
    thumbnail: { url: 'https://img.example/generated-thumbnail.jpg' },
    card: { url: 'https://img.example/generated-card.webp' },
    portfolio: { url: 'https://img.example/generated-portfolio.jpg' },
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const setup = () => {
  const dependencies = {
    fetchSource: vi.fn(async () => Buffer.from('source')),
    transcode: vi.fn(async () => Buffer.from('optimized')),
    generatePoster: vi.fn(async () => Buffer.from('poster')),
    createWebVideo: vi.fn(async () => generatedWebVideo),
    createPoster: vi.fn(async () => generatedPoster),
    verifyWebVideo: vi.fn(async () => undefined),
    verifyPoster: vi.fn(async () => undefined),
    updateVideoRelationships: vi.fn(async () => undefined),
    verifyRelationshipSwitch: vi.fn(async () => undefined),
    cleanupOldWebVideo: vi.fn(async () => ({ deleted: true, referenceCount: 0 })),
    cleanupOldPoster: vi.fn(async () => ({ deleted: true, referenceCount: 0 })),
    removeWebVideo: vi.fn(async () => undefined),
    removePoster: vi.fn(async () => undefined),
  }
  const logger = { error: vi.fn(), info: vi.fn() }
  const hook = createWebVideoSyncHook(dependencies)
  const run = (overrides: Record<string, unknown> = {}) =>
    hook({
      collection: {} as never,
      context: {},
      data: {},
      doc: video,
      operation: 'update',
      overrideAccess: true,
      previousDoc: { ...video, poster: 22, webVideo: 4 },
      req: {
        file: { data: Buffer.from('source'), mimetype: 'video/mp4', name: '动画.mp4', size: 100 },
        payload: { config: {}, logger },
      },
      ...overrides,
    } as never)
  return { dependencies, logger, run }
}

describe('Video → WebVideo + poster synchronization', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('generates and links both assets for a new Video upload', async () => {
    const { dependencies, run } = setup()
    await run({ operation: 'create', previousDoc: undefined })
    expect(dependencies.createWebVideo).toHaveBeenCalledOnce()
    expect(dependencies.createPoster).toHaveBeenCalledOnce()
    expect(dependencies.updateVideoRelationships).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, posterID: 120, webVideoID: 44 }),
    )
    expect(dependencies.cleanupOldWebVideo).not.toHaveBeenCalled()
    expect(dependencies.cleanupOldPoster).not.toHaveBeenCalled()
  })

  it('generates a new WebVideo and a new poster for replacement', async () => {
    const { dependencies, run } = setup()
    await run()
    expect(dependencies.generatePoster).toHaveBeenCalledWith(Buffer.from('source'))
    expect(dependencies.updateVideoRelationships).toHaveBeenCalledOnce()
  })

  it('verifies both new assets before the atomic relationship switch', async () => {
    const { dependencies, run } = setup()
    await run()
    expect(dependencies.updateVideoRelationships).toHaveBeenCalledAfter(dependencies.verifyWebVideo)
    expect(dependencies.updateVideoRelationships).toHaveBeenCalledAfter(dependencies.verifyPoster)
    expect(dependencies.verifyRelationshipSwitch).toHaveBeenCalledAfter(dependencies.updateVideoRelationships)
    expect(dependencies.cleanupOldWebVideo).toHaveBeenCalledAfter(dependencies.verifyRelationshipSwitch)
    expect(dependencies.cleanupOldPoster).toHaveBeenCalledAfter(dependencies.verifyRelationshipSwitch)
  })

  it('does not regenerate either asset for metadata-only edits', async () => {
    const { dependencies, run } = setup()
    await run({ req: { payload: { config: {}, logger: { error: vi.fn(), info: vi.fn() } } } })
    expect(dependencies.createWebVideo).not.toHaveBeenCalled()
    expect(dependencies.createPoster).not.toHaveBeenCalled()
    expect(dependencies.updateVideoRelationships).not.toHaveBeenCalled()
    expect(dependencies.cleanupOldWebVideo).not.toHaveBeenCalled()
    expect(dependencies.cleanupOldPoster).not.toHaveBeenCalled()
  })

  it('preserves both old relationships when poster generation fails', async () => {
    const { dependencies, logger, run } = setup()
    dependencies.generatePoster.mockRejectedValueOnce(new Error('poster failed'))
    await run()
    expect(dependencies.updateVideoRelationships).not.toHaveBeenCalled()
    expect(dependencies.removeWebVideo).toHaveBeenCalledWith(expect.objectContaining({ id: 44 }))
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ oldPosterID: 22, oldWebVideoID: 4 }))
  })

  it('compensates both unswitched new documents if the relationship update fails', async () => {
    const { dependencies, run } = setup()
    dependencies.updateVideoRelationships.mockRejectedValueOnce(new Error('update failed'))
    await run()
    expect(dependencies.removePoster).toHaveBeenCalledWith(expect.objectContaining({ id: 120 }))
    expect(dependencies.removeWebVideo).toHaveBeenCalledWith(expect.objectContaining({ id: 44 }))
  })

  it('deletes orphaned old WebVideo and poster only after a verified switch', async () => {
    const { dependencies, run } = setup()
    await run()
    expect(dependencies.cleanupOldWebVideo).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }))
    expect(dependencies.cleanupOldPoster).toHaveBeenCalledWith(expect.objectContaining({ id: 22 }))
    expect(dependencies.cleanupOldWebVideo).toHaveBeenCalledAfter(dependencies.verifyRelationshipSwitch)
  })

  it('preserves referenced old WebVideo and poster', async () => {
    const { dependencies, run } = setup()
    dependencies.cleanupOldWebVideo.mockResolvedValueOnce({ deleted: false, referenceCount: 1 })
    dependencies.cleanupOldPoster.mockResolvedValueOnce({ deleted: false, referenceCount: 2 })
    await run()
    expect(dependencies.removeWebVideo).not.toHaveBeenCalled()
    expect(dependencies.removePoster).not.toHaveBeenCalled()
  })

  it('does not break active relationships when old-media cleanup fails', async () => {
    const { dependencies, logger, run } = setup()
    dependencies.cleanupOldWebVideo.mockRejectedValueOnce(new Error('blob delete failed'))
    dependencies.cleanupOldPoster.mockRejectedValueOnce(new Error('oss delete failed'))
    await run()
    expect(dependencies.updateVideoRelationships).toHaveBeenCalledOnce()
    expect(dependencies.removeWebVideo).not.toHaveBeenCalled()
    expect(dependencies.removePoster).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledTimes(2)
  })

  it('preserves all old media when post-switch verification fails', async () => {
    const { dependencies, run } = setup()
    dependencies.verifyRelationshipSwitch.mockRejectedValueOnce(new Error('read-back failed'))
    await run()
    expect(dependencies.removeWebVideo).not.toHaveBeenCalled()
    expect(dependencies.removePoster).not.toHaveBeenCalled()
    expect(dependencies.cleanupOldWebVideo).not.toHaveBeenCalled()
    expect(dependencies.cleanupOldPoster).not.toHaveBeenCalled()
  })

  it('uses a new Image ID and collision-safe OSS namespace supplied by Images storage', async () => {
    const { dependencies, run } = setup()
    await run()
    expect(dependencies.createPoster).toHaveBeenCalledWith(
      expect.objectContaining({ filename: expect.stringMatching(/^动画-poster-[a-f0-9]{32}\.jpg$/u) }),
    )
    expect(generatedPoster.id).not.toBe(22)
    expect(generatedPoster.prefix).toMatch(/^images\/production\/[a-f0-9]{32}$/u)
  })

  it('uses new 128-bit pathnames for WebVideo and poster content', () => {
    const webA = makeVersionedWebVideoFilename('动画.mp4')
    const webB = makeVersionedWebVideoFilename('动画.mp4')
    const posterA = makeVersionedPosterFilename('动画.mp4')
    const posterB = makeVersionedPosterFilename('动画.mp4')
    expect(webA).toMatch(/^动画-web-[a-f0-9]{32}-balanced-crf22\.mp4$/u)
    expect(posterA).toMatch(/^动画-poster-[a-f0-9]{32}\.jpg$/u)
    expect(webA).not.toBe(webB)
    expect(posterA).not.toBe(posterB)
  })

  it('does not modify unrelated Videos or Animation order', async () => {
    const { dependencies, run } = setup()
    const animationOrder = [8, 9, 6, 7]
    await run()
    expect(dependencies.updateVideoRelationships).toHaveBeenCalledTimes(1)
    expect(dependencies.updateVideoRelationships).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
    expect(animationOrder).toEqual([8, 9, 6, 7])
  })

  it('keeps the frontend preference for webVideo with original fallback', async () => {
    const frontendSource = await readFile('../src/lib/payload/animations.ts', 'utf8')
    expect(frontendSource).toContain('getMediaUrl(document.video.webVideo) ?? getMediaUrl(document.video)')
    expect(frontendSource).toContain('getImageUrls(document.video.poster) ?? getImageUrls(document.poster)')
  })

  it('uses the existing Images collection and routing pipeline', async () => {
    const hookSource = await readFile('src/hooks/syncWebVideo.ts', 'utf8')
    const imageSource = await readFile('src/collections/Images.ts', 'utf8')
    expect(hookSource).toContain("collection: 'images'")
    expect(imageSource).toContain('assignImageStorageProvider')
    expect(imageSource).toContain("name: 'thumbnail'")
    expect(imageSource).toContain("name: 'card'")
    expect(imageSource).toContain("name: 'portfolio'")
  })

  it('does not recurse when its relationship update carries the sync guard', async () => {
    const { dependencies, run } = setup()
    await run({ context: { skipVideoMediaSync: true } })
    expect(dependencies.fetchSource).not.toHaveBeenCalled()
    expect(dependencies.updateVideoRelationships).not.toHaveBeenCalled()
  })
})
