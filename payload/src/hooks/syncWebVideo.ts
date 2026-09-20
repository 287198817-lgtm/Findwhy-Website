import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import ffmpegPath from 'ffmpeg-static'
import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'

import type { Image, Video, WebVideo } from '../payload-types'
import { getImageReferenceCount } from '../lib/mediaReferenceQueries'

const VIDEO_SYNC_CONTEXT_KEY = 'skipVideoMediaSync'
const WEB_VIDEO_CRF = 22

type VideoWithUploadFields = Video & { mimeType?: null | string; url?: null | string }

export type SyncDependencies = {
  cleanupOldPoster: (args: { id: number; req: PayloadRequest }) => Promise<{ deleted: boolean; referenceCount: number }>
  cleanupOldWebVideo: (args: { id: number; req: PayloadRequest }) => Promise<{ deleted: boolean; referenceCount: number }>
  createPoster: (args: { alt: string; buffer: Buffer; filename: string; req: PayloadRequest }) => Promise<Image>
  createWebVideo: (args: { buffer: Buffer; filename: string; req: PayloadRequest }) => Promise<WebVideo>
  fetchSource: (url: string) => Promise<Buffer>
  generatePoster: (source: Buffer) => Promise<Buffer>
  removePoster: (args: { id: number; req: PayloadRequest }) => Promise<void>
  removeWebVideo: (args: { id: number; req: PayloadRequest }) => Promise<void>
  transcode: (source: Buffer) => Promise<Buffer>
  updateVideoRelationships: (args: { id: number; posterID: number; req: PayloadRequest; webVideoID: number }) => Promise<void>
  verifyRelationshipSwitch: (args: { id: number; posterID: number; req: PayloadRequest; webVideoID: number }) => Promise<void>
  verifyPoster: (doc: Image) => Promise<void>
  verifyWebVideo: (doc: WebVideo) => Promise<void>
}

const relationshipID = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'number') return value.id
  return null
}

const sourceURL = (doc: VideoWithUploadFields, req: PayloadRequest): string => {
  if (!doc.url) throw new Error(`Video ${doc.id} has no source URL.`)
  if (/^https?:\/\//u.test(doc.url)) return doc.url
  const serverURL = req.payload.config.serverURL
  if (!serverURL) throw new Error(`Video ${doc.id} has a relative source URL but Payload serverURL is not configured.`)
  return new URL(doc.url, serverURL).toString()
}

const version = () => randomBytes(16).toString('hex')

export const makeVersionedWebVideoFilename = (sourceFilename: string): string => {
  const base = path.parse(sourceFilename).name || 'video'
  return `${base}-web-${version()}-balanced-crf${WEB_VIDEO_CRF}.mp4`
}

export const makeVersionedPosterFilename = (sourceFilename: string): string => {
  const base = path.parse(sourceFilename).name || 'video'
  return `${base}-poster-${version()}.jpg`
}

const withTemporaryVideo = async (
  source: Buffer,
  directoryPrefix: string,
  outputFilename: string,
  args: (input: string, output: string) => string[],
): Promise<Buffer> => {
  if (!ffmpegPath) throw new Error('ffmpeg-static does not support this runtime platform.')
  const directory = await mkdtemp(path.join(tmpdir(), directoryPrefix))
  const input = path.join(directory, 'source')
  const output = path.join(directory, outputFilename)
  try {
    await writeFile(input, source)
    await promisify(execFile)(ffmpegPath, args(input, output), { maxBuffer: 8 * 1024 * 1024 })
    return await readFile(output)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

const runFFmpeg = (source: Buffer): Promise<Buffer> =>
  withTemporaryVideo(source, 'findwhy-web-video-', 'web.mp4', (input, output) => [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-map', '0:v:0', '-map', '0:a?',
    '-vf', "scale='if(gt(ih,iw),-2,min(iw,900))':'if(gt(ih,iw),min(ih,896),-2)'",
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(WEB_VIDEO_CRF),
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output,
  ])

const generatePosterFrame = (source: Buffer): Promise<Buffer> =>
  withTemporaryVideo(source, 'findwhy-video-poster-', 'poster.jpg', (input, output) => [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', '0.1', '-i', input, '-map', '0:v:0', '-frames:v', '1', '-q:v', '2', output,
  ])

const readFirstByte = async (url: string): Promise<Response> =>
  fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(30_000) })

const defaultDependencies: SyncDependencies = {
  fetchSource: async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`Unable to fetch source video (HTTP ${response.status}).`)
    return Buffer.from(await response.arrayBuffer())
  },
  transcode: runFFmpeg,
  generatePoster: generatePosterFrame,
  createWebVideo: async ({ buffer, filename, req }) =>
    (await req.payload.create({
      collection: 'web-videos', context: { [VIDEO_SYNC_CONTEXT_KEY]: true }, data: {},
      file: { data: buffer, mimetype: 'video/mp4', name: filename, size: buffer.length },
      overrideAccess: true, req,
    })) as WebVideo,
  createPoster: async ({ alt, buffer, filename, req }) =>
    (await req.payload.create({
      collection: 'images', context: { [VIDEO_SYNC_CONTEXT_KEY]: true }, data: { alt },
      file: { data: buffer, mimetype: 'image/jpeg', name: filename, size: buffer.length },
      overrideAccess: true, req,
    })) as Image,
  verifyWebVideo: async (doc) => {
    if (!doc.id || !doc.filename || !doc.url || doc.mimeType !== 'video/mp4' || !doc.filesize) {
      throw new Error(`Generated WebVideo ${doc.id ?? 'unknown'} has incomplete metadata.`)
    }
    const response = await readFirstByte(doc.url)
    if (!response.ok && response.status !== 206) throw new Error(`Generated WebVideo ${doc.id} is not readable (HTTP ${response.status}).`)
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.toLowerCase().startsWith('video/mp4')) {
      throw new Error(`Generated WebVideo ${doc.id} has unexpected Content-Type ${contentType}.`)
    }
  },
  verifyPoster: async (doc) => {
    const expectedPrefix = `images/${process.env.IMAGES_STORAGE_ENV || ''}/`
    const urls = [doc.url, doc.sizes?.thumbnail?.url, doc.sizes?.card?.url, doc.sizes?.portfolio?.url]
    if (!doc.id || doc.storageProvider !== 'aliyun-oss' || !doc.prefix?.startsWith(expectedPrefix) || doc.mimeType !== 'image/jpeg' || urls.some((url) => !url)) {
      throw new Error(`Generated poster Image ${doc.id ?? 'unknown'} has incomplete storage metadata.`)
    }
    const responses = await Promise.all(urls.map((url) => readFirstByte(url!)))
    const failed = responses.find((response) => !response.ok && response.status !== 206)
    if (failed) throw new Error(`Generated poster Image ${doc.id} has an unreadable variant (HTTP ${failed.status}).`)
  },
  updateVideoRelationships: async ({ id, posterID, req, webVideoID }) => {
    await req.payload.update({
      collection: 'videos', context: { [VIDEO_SYNC_CONTEXT_KEY]: true },
      data: { poster: posterID, webVideo: webVideoID }, id, overrideAccess: true, req,
    })
  },
  verifyRelationshipSwitch: async ({ id, posterID, req, webVideoID }) => {
    const current = await req.payload.findByID({ collection: 'videos', depth: 0, id, overrideAccess: true, req })
    if (relationshipID(current.poster) !== posterID || relationshipID(current.webVideo) !== webVideoID) {
      throw new Error(`Video ${id} media relationship switch verification failed.`)
    }
  },
  cleanupOldWebVideo: async ({ id, req }) => {
    const references = await req.payload.find({
      collection: 'videos', depth: 0, limit: 1, overrideAccess: true, req,
      where: { webVideo: { equals: id } },
    })
    if (references.totalDocs > 0) return { deleted: false, referenceCount: references.totalDocs }
    await req.payload.delete({ collection: 'web-videos', id, overrideAccess: true, req })
    return { deleted: true, referenceCount: 0 }
  },
  cleanupOldPoster: async ({ id, req }) => {
    const referenceCount = await getImageReferenceCount({ imageID: id, payload: req.payload, req })
    if (referenceCount > 0) return { deleted: false, referenceCount }
    await req.payload.delete({ collection: 'images', id, overrideAccess: true, req })
    return { deleted: true, referenceCount: 0 }
  },
  removePoster: async ({ id, req }) => {
    await req.payload.delete({ collection: 'images', context: { [VIDEO_SYNC_CONTEXT_KEY]: true }, id, overrideAccess: true, req })
  },
  removeWebVideo: async ({ id, req }) => {
    await req.payload.delete({ collection: 'web-videos', context: { [VIDEO_SYNC_CONTEXT_KEY]: true }, id, overrideAccess: true, req })
  },
}

export const synchronizeVideoMedia = async ({ dependencies = defaultDependencies, doc, previousDoc, req }: {
  dependencies?: SyncDependencies
  doc: Video
  previousDoc?: Video
  req: PayloadRequest
}): Promise<{
  cleanup: {
    oldPoster?: { deleted: boolean; referenceCount: number }
    oldWebVideo?: { deleted: boolean; referenceCount: number }
  }
  newPoster: Image
  newWebVideo: WebVideo
  oldPosterID: number | null
  oldWebVideoID: number | null
}> => {
  const video = doc as VideoWithUploadFields
  const oldPosterID = relationshipID(previousDoc?.poster)
  const oldWebVideoID = relationshipID(previousDoc?.webVideo)
  let newPoster: Image | null = null
  let newWebVideo: WebVideo | null = null
  let switched = false

  try {
    const source = await dependencies.fetchSource(sourceURL(video, req))
    const optimized = await dependencies.transcode(source)
    newWebVideo = await dependencies.createWebVideo({
      buffer: optimized,
      filename: makeVersionedWebVideoFilename(video.filename || `video-${video.id}.mp4`),
      req,
    })
    await dependencies.verifyWebVideo(newWebVideo)

    const posterBuffer = await dependencies.generatePoster(source)
    newPoster = await dependencies.createPoster({
      alt: `${path.parse(video.filename || `video-${video.id}`).name} poster`,
      buffer: posterBuffer,
      filename: makeVersionedPosterFilename(video.filename || `video-${video.id}.mp4`),
      req,
    })
    await dependencies.verifyPoster(newPoster)

    await dependencies.updateVideoRelationships({ id: video.id, posterID: newPoster.id, req, webVideoID: newWebVideo.id })
    // Once the DB switch returns successfully, never compensate-delete the now-active media.
    // A later verification failure preserves both old and new assets for safe audit/recovery.
    switched = true
    await dependencies.verifyRelationshipSwitch({ id: video.id, posterID: newPoster.id, req, webVideoID: newWebVideo.id })
    await dependencies.verifyWebVideo(newWebVideo)
    await dependencies.verifyPoster(newPoster)
  } catch (error) {
    if (!switched && newPoster) {
      try {
        await dependencies.removePoster({ id: newPoster.id, req })
      } catch (cleanupError) {
        req.payload.logger.error({ err: cleanupError, collection: 'images', documentID: newPoster.id, operation: 'compensating-delete', msg: 'Unable to remove an unswitched generated poster Image.' })
      }
    }
    if (!switched && newWebVideo) {
      try {
        await dependencies.removeWebVideo({ id: newWebVideo.id, req })
      } catch (cleanupError) {
        req.payload.logger.error({ err: cleanupError, collection: 'web-videos', documentID: newWebVideo.id, operation: 'compensating-delete', msg: 'Unable to remove an unswitched generated WebVideo.' })
      }
    }
    throw error
  }

  const cleanup: {
    oldPoster?: { deleted: boolean; referenceCount: number }
    oldWebVideo?: { deleted: boolean; referenceCount: number }
  } = {}

  if (oldWebVideoID !== null && oldWebVideoID !== newWebVideo.id) {
    try {
      cleanup.oldWebVideo = await dependencies.cleanupOldWebVideo({ id: oldWebVideoID, req })
      if (!cleanup.oldWebVideo.deleted) {
        req.payload.logger.info({
          collection: 'web-videos', documentID: oldWebVideoID,
          referenceCount: cleanup.oldWebVideo.referenceCount,
          operation: 'replacement-cleanup', msg: 'CLEANUP SKIPPED — STILL REFERENCED',
        })
      }
    } catch (error) {
      req.payload.logger.error({
        err: error, collection: 'web-videos', documentID: oldWebVideoID,
        operation: 'replacement-cleanup', msg: 'Old WebVideo cleanup failed after verified relationship switch.',
      })
    }
  }

  if (oldPosterID !== null && oldPosterID !== newPoster.id) {
    try {
      cleanup.oldPoster = await dependencies.cleanupOldPoster({ id: oldPosterID, req })
      if (!cleanup.oldPoster.deleted) {
        req.payload.logger.info({
          collection: 'images', documentID: oldPosterID,
          referenceCount: cleanup.oldPoster.referenceCount,
          operation: 'replacement-cleanup', msg: 'CLEANUP SKIPPED — STILL REFERENCED',
        })
      }
    } catch (error) {
      req.payload.logger.error({
        err: error, collection: 'images', documentID: oldPosterID,
        operation: 'replacement-cleanup', msg: 'Old poster cleanup failed after verified relationship switch.',
      })
    }
  }

  return { cleanup, newPoster, newWebVideo, oldPosterID, oldWebVideoID }
}

export const synchronizeWebVideo = synchronizeVideoMedia

export const createWebVideoSyncHook = (dependencies: SyncDependencies = defaultDependencies): CollectionAfterChangeHook<Video> =>
  async ({ context, doc, operation, previousDoc, req }) => {
    if (context[VIDEO_SYNC_CONTEXT_KEY] || !req.file) return doc
    try {
      const result = await synchronizeVideoMedia({ dependencies, doc, previousDoc, req })
      req.payload.logger.info({
        collection: 'videos', documentID: doc.id,
        newPosterID: result.newPoster.id, newWebVideoID: result.newWebVideo.id,
        oldPosterID: result.oldPosterID, oldWebVideoID: result.oldWebVideoID,
        operation, msg: 'WebVideo and poster synchronized after source video upload.',
      })
    } catch (error) {
      req.payload.logger.error({
        err: error, collection: 'videos', documentID: doc.id,
        oldPosterID: relationshipID(previousDoc?.poster), oldWebVideoID: relationshipID(previousDoc?.webVideo),
        operation: `${operation}-video-media-sync`,
        msg: 'WebVideo/poster generation failed; previous relationships were preserved.',
      })
    }
    return doc
  }

export const syncWebVideo = createWebVideoSyncHook()
