import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import ffmpegPath from 'ffmpeg-static'
import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'

import type { Video, WebVideo } from '../payload-types'

const WEB_VIDEO_CONTEXT_KEY = 'skipWebVideoSync'
const WEB_VIDEO_CRf = 22

type VideoWithUploadFields = Video & {
  mimeType?: null | string
  url?: null | string
}

export type SyncDependencies = {
  createWebVideo: (args: {
    buffer: Buffer
    filename: string
    req: PayloadRequest
  }) => Promise<WebVideo>
  fetchSource: (url: string) => Promise<Buffer>
  removeWebVideo: (args: { id: number; req: PayloadRequest }) => Promise<void>
  transcode: (source: Buffer) => Promise<Buffer>
  updateVideoRelationship: (args: {
    id: number
    req: PayloadRequest
    webVideoID: number
  }) => Promise<void>
  verifyWebVideo: (doc: WebVideo) => Promise<void>
}

const relationshipID = (value: Video['webVideo']): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) return value.id
  return null
}

const sourceURL = (doc: VideoWithUploadFields, req: PayloadRequest): string => {
  if (!doc.url) throw new Error(`Video ${doc.id} has no source URL.`)
  if (/^https?:\/\//u.test(doc.url)) return doc.url

  const serverURL = req.payload.config.serverURL
  if (!serverURL) {
    throw new Error(`Video ${doc.id} has a relative source URL but Payload serverURL is not configured.`)
  }
  return new URL(doc.url, serverURL).toString()
}

export const makeVersionedWebVideoFilename = (sourceFilename: string): string => {
  const parsed = path.parse(sourceFilename)
  const base = parsed.name || 'video'
  const version = randomBytes(16).toString('hex')
  return `${base}-web-${version}-balanced-crf${WEB_VIDEO_CRf}.mp4`
}

const runFFmpeg = async (source: Buffer): Promise<Buffer> => {
  if (!ffmpegPath) throw new Error('ffmpeg-static does not support this runtime platform.')
  const executable = ffmpegPath

  const directory = await mkdtemp(path.join(tmpdir(), 'findwhy-web-video-'))
  const input = path.join(directory, 'source')
  const output = path.join(directory, 'web.mp4')

  try {
    await writeFile(input, source)

    await promisify(execFile)(
      executable,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        input,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-vf',
        // Preserve the established web strategy: vertical media is capped at 896px high;
        // square/landscape media is capped at 900px wide. Never upscale.
        "scale='if(gt(ih,iw),-2,min(iw,900))':'if(gt(ih,iw),min(ih,896),-2)'",
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        String(WEB_VIDEO_CRf),
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        output,
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    )

    return await readFile(output)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

const defaultDependencies: SyncDependencies = {
  fetchSource: async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Unable to fetch source video (HTTP ${response.status}).`)
    return Buffer.from(await response.arrayBuffer())
  },
  transcode: runFFmpeg,
  createWebVideo: async ({ buffer, filename, req }) =>
    (await req.payload.create({
      collection: 'web-videos',
      context: { [WEB_VIDEO_CONTEXT_KEY]: true },
      data: {},
      file: {
        data: buffer,
        mimetype: 'video/mp4',
        name: filename,
        size: buffer.length,
      },
      overrideAccess: true,
      req,
    })) as WebVideo,
  verifyWebVideo: async (doc) => {
    if (!doc.id || !doc.filename || !doc.url || doc.mimeType !== 'video/mp4' || !doc.filesize) {
      throw new Error(`Generated WebVideo ${doc.id ?? 'unknown'} has incomplete metadata.`)
    }
    const response = await fetch(doc.url, { headers: { Range: 'bytes=0-0' } })
    if (!response.ok && response.status !== 206) {
      throw new Error(`Generated WebVideo ${doc.id} is not readable (HTTP ${response.status}).`)
    }
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.toLowerCase().startsWith('video/mp4')) {
      throw new Error(`Generated WebVideo ${doc.id} has unexpected Content-Type ${contentType}.`)
    }
  },
  updateVideoRelationship: async ({ id, req, webVideoID }) => {
    await req.payload.update({
      collection: 'videos',
      context: { [WEB_VIDEO_CONTEXT_KEY]: true },
      data: { webVideo: webVideoID },
      id,
      overrideAccess: true,
      req,
    })
  },
  removeWebVideo: async ({ id, req }) => {
    await req.payload.delete({
      collection: 'web-videos',
      context: { [WEB_VIDEO_CONTEXT_KEY]: true },
      id,
      overrideAccess: true,
      req,
    })
  },
}

export const synchronizeWebVideo = async ({
  dependencies = defaultDependencies,
  doc,
  previousDoc,
  req,
}: {
  dependencies?: SyncDependencies
  doc: Video
  previousDoc?: Video
  req: PayloadRequest
}): Promise<{ newWebVideo: WebVideo; oldWebVideoID: number | null }> => {
  const video = doc as VideoWithUploadFields
  const oldWebVideoID = relationshipID(previousDoc?.webVideo)
  let newWebVideo: WebVideo | null = null

  try {
    const source = await dependencies.fetchSource(sourceURL(video, req))
    const optimized = await dependencies.transcode(source)
    const filename = makeVersionedWebVideoFilename(video.filename || `video-${video.id}.mp4`)

    newWebVideo = await dependencies.createWebVideo({ buffer: optimized, filename, req })
    await dependencies.verifyWebVideo(newWebVideo)
    await dependencies.updateVideoRelationship({
      id: video.id,
      req,
      webVideoID: newWebVideo.id,
    })

    return { newWebVideo, oldWebVideoID }
  } catch (error) {
    if (newWebVideo) {
      try {
        await dependencies.removeWebVideo({ id: newWebVideo.id, req })
      } catch (cleanupError) {
        req.payload.logger.error({
          err: cleanupError,
          collection: 'web-videos',
          documentID: newWebVideo.id,
          operation: 'compensating-delete',
          msg: 'Unable to remove an unswitched generated WebVideo.',
        })
      }
    }
    throw error
  }
}

export const createWebVideoSyncHook = (
  dependencies: SyncDependencies = defaultDependencies,
): CollectionAfterChangeHook<Video> =>
  async ({ context, doc, operation, previousDoc, req }) => {
    if (context[WEB_VIDEO_CONTEXT_KEY]) return doc

    // Payload populates req.file for both multipart and client uploads. It is absent for
    // metadata-only edits, even when alt, poster, or webVideo relationships change.
    if (!req.file) return doc

    try {
      const { newWebVideo, oldWebVideoID } = await synchronizeWebVideo({
        dependencies,
        doc,
        previousDoc,
        req,
      })

      req.payload.logger.info({
        collection: 'videos',
        documentID: doc.id,
        newWebVideoID: newWebVideo.id,
        oldWebVideoID,
        operation,
        msg: 'WebVideo synchronized after source video upload.',
      })
    } catch (error) {
      req.payload.logger.error({
        err: error,
        collection: 'videos',
        documentID: doc.id,
        oldWebVideoID: relationshipID(previousDoc?.webVideo),
        operation: `${operation}-web-video-sync`,
        msg: 'WebVideo generation failed; the previous relationship was preserved.',
      })
    }

    return doc
  }

export const syncWebVideo = createWebVideoSyncHook()
