import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { CollectionAfterChangeHook } from 'payload'
import sharp from 'sharp'

import type { Video } from '../payload-types'

const ffmpegPath = 'ffmpeg'

const runCommand = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const process = spawn(command, args)
    let errorOutput = ''

    process.stderr.on('data', (chunk) => {
      errorOutput += String(chunk)
    })
    process.on('error', reject)
    process.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput.slice(-1000)}`))
    })
  })

const runFFmpeg = async (inputPath: string, outputPath: string) => {
  await runCommand(ffmpegPath, [
    '-y',
    '-ss',
    '0',
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-vf',
    "scale='min(2000,iw)':-2",
    '-q:v',
    '2',
    outputPath,
  ])
}

const runMacOSQuickLook = async (inputPath: string, outputPath: string) => {
  const outputDirectory = path.dirname(outputPath)
  await runCommand('/usr/bin/qlmanage', ['-t', '-s', '2000', '-o', outputDirectory, inputPath])
  const quickLookOutput = path.join(outputDirectory, `${path.basename(inputPath)}.png`)
  await sharp(quickLookOutput).jpeg({ quality: 92 }).toFile(outputPath)
}

const extractPoster = async (inputPath: string, outputPath: string) => {
  try {
    await runFFmpeg(inputPath, outputPath)
  } catch (ffmpegError) {
    if (process.platform !== 'darwin') throw ffmpegError
    await runMacOSQuickLook(inputPath, outputPath)
  }
}

export const generateVideoPoster: CollectionAfterChangeHook<Video> = async ({
  context,
  doc,
  req,
}) => {
  if (context.skipPosterGeneration || doc.poster || !doc.filename) return doc

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'findwhy-poster-'))
  const posterFilename = `${path.parse(doc.filename).name}-poster.jpg`
  const posterPath = path.join(temporaryDirectory, posterFilename)
  const videoPath = path.resolve(process.cwd(), 'videos', doc.filename)
  let imageID: number | string | null = null

  try {
    await fs.access(videoPath)
    await extractPoster(videoPath, posterPath)
    const posterData = await fs.readFile(posterPath)
    const image = await req.payload.create({
      collection: 'images',
      data: {
        alt: path.parse(doc.filename).name.replace(/[-_]+/g, ' '),
        metadata: {
          copyright: '© Findwhy',
          source: doc.filename,
        },
      },
      file: {
        data: posterData,
        mimetype: 'image/jpeg',
        name: posterFilename,
        size: posterData.byteLength,
      },
      req,
    })
    imageID = image.id

    return await req.payload.update({
      collection: 'videos',
      id: doc.id,
      data: { poster: image.id },
      context: { skipPosterGeneration: true },
      depth: 1,
      req,
    })
  } catch (error) {
    if (imageID !== null) {
      await req.payload.delete({ collection: 'images', id: imageID, req }).catch(() => undefined)
    }
    req.payload.logger.error({ err: error, msg: `Poster generation failed for ${doc.filename}` })
    return doc
  } finally {
    await fs.rm(temporaryDirectory, { force: true, recursive: true }).catch(() => undefined)
  }
}
