import { readFile } from 'node:fs/promises'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWebVideoSyncHook, makeVersionedWebVideoFilename } from '@/hooks/syncWebVideo'

const video = {
  id: 9,
  filename: '动画.mp4',
  url: 'https://blob.example/videos/current.mp4',
  mimeType: 'video/mp4',
  filesize: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const generated = {
  id: 44,
  filename: 'generated.mp4',
  url: 'https://blob.example/video-web/generated.mp4',
  mimeType: 'video/mp4',
  filesize: 50,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const setup = () => {
  const dependencies = {
    fetchSource: vi.fn(async () => Buffer.from('source')),
    transcode: vi.fn(async () => Buffer.from('optimized')),
    createWebVideo: vi.fn(async () => generated),
    verifyWebVideo: vi.fn(async () => undefined),
    updateVideoRelationship: vi.fn(async () => undefined),
    removeWebVideo: vi.fn(async () => undefined),
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
      previousDoc: { ...video, webVideo: 4 },
      req: {
        file: { data: Buffer.from('source'), mimetype: 'video/mp4', name: '动画.mp4', size: 100 },
        payload: { config: {}, logger },
      },
      ...overrides,
    } as never)

  return { dependencies, hook, logger, run }
}

describe('Video → WebVideo synchronization', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('generates and links a WebVideo for a new Video upload', async () => {
    const { dependencies, run } = setup()
    await run({ operation: 'create', previousDoc: undefined })

    expect(dependencies.transcode).toHaveBeenCalledOnce()
    expect(dependencies.verifyWebVideo).toHaveBeenCalledWith(generated)
    expect(dependencies.updateVideoRelationship).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, webVideoID: 44 }),
    )
  })

  it('generates a new WebVideo and switches the relationship after replacement', async () => {
    const { dependencies, run } = setup()
    await run()

    expect(dependencies.createWebVideo).toHaveBeenCalledOnce()
    expect(dependencies.updateVideoRelationship).toHaveBeenCalledAfter(
      dependencies.verifyWebVideo,
    )
    expect(dependencies.removeWebVideo).not.toHaveBeenCalled()
  })

  it('does not regenerate for metadata-only edits', async () => {
    const { dependencies, run } = setup()
    await run({ req: { payload: { config: {}, logger: { error: vi.fn(), info: vi.fn() } } } })

    expect(dependencies.fetchSource).not.toHaveBeenCalled()
    expect(dependencies.createWebVideo).not.toHaveBeenCalled()
    expect(dependencies.updateVideoRelationship).not.toHaveBeenCalled()
  })

  it('preserves the old relationship when transcoding fails', async () => {
    const { dependencies, logger, run } = setup()
    dependencies.transcode.mockRejectedValueOnce(new Error('transcode failed'))
    await run()

    expect(dependencies.updateVideoRelationship).not.toHaveBeenCalled()
    expect(dependencies.removeWebVideo).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ oldWebVideoID: 4, documentID: 9 }),
    )
  })

  it('compensates a newly created WebVideo if verification fails', async () => {
    const { dependencies, run } = setup()
    dependencies.verifyWebVideo.mockRejectedValueOnce(new Error('unreadable'))
    await run()

    expect(dependencies.updateVideoRelationship).not.toHaveBeenCalled()
    expect(dependencies.removeWebVideo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 44 }),
    )
  })

  it('uses a new 128-bit version in every WebVideo pathname', () => {
    const first = makeVersionedWebVideoFilename('动画.mp4')
    const second = makeVersionedWebVideoFilename('动画.mp4')

    expect(first).toMatch(/^动画-web-[a-f0-9]{32}-balanced-crf22\.mp4$/u)
    expect(second).toMatch(/^动画-web-[a-f0-9]{32}-balanced-crf22\.mp4$/u)
    expect(first).not.toBe(second)
  })

  it('does not modify unrelated Videos or Animation order', async () => {
    const { dependencies, run } = setup()
    const animationOrder = [8, 9, 6, 7]
    await run()

    expect(dependencies.updateVideoRelationship).toHaveBeenCalledTimes(1)
    expect(dependencies.updateVideoRelationship).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9 }),
    )
    expect(animationOrder).toEqual([8, 9, 6, 7])
  })

  it('keeps the frontend preference for webVideo with original fallback', async () => {
    const frontendSource = await readFile('../src/lib/payload/animations.ts', 'utf8')
    expect(frontendSource).toContain(
      'getMediaUrl(document.video.webVideo) ?? getMediaUrl(document.video)',
    )
  })

  it('does not recurse when its relationship update carries the sync guard', async () => {
    const { dependencies, run } = setup()
    await run({ context: { skipWebVideoSync: true } })

    expect(dependencies.fetchSource).not.toHaveBeenCalled()
    expect(dependencies.updateVideoRelationship).not.toHaveBeenCalled()
  })
})

