import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import config from '../src/payload.config'

type SourceIllustration = {
  draft: boolean
  image: string
  order: number
  slug: string
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const payloadDirectory = path.resolve(scriptDirectory, '..')
const websiteDirectory = path.resolve(payloadDirectory, '..')
const sourceDirectory = path.join(websiteDirectory, 'src/content/illustrations')

const readFrontmatter = (source: string, filename: string): SourceIllustration => {
  const value = (key: string) => source.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim()
  const slug = value('slug') || path.basename(filename, path.extname(filename))
  const image = value('image')

  if (!image) throw new Error('Missing image field')

  return {
    slug,
    image,
    order: Number(value('order') ?? 0),
    draft: value('draft') === 'true',
  }
}

const mimeTypeFor = (filename: string) => {
  const extension = path.extname(filename).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return 'image/jpeg'
}

const payload = await getPayload({ config })
const filenames = (await fs.readdir(sourceDirectory))
  .filter((filename) => filename.endsWith('.md') && filename !== '_template.md')
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

const migrated: string[] = []
const skipped: string[] = []
const failed: Array<{ error: string; slug: string }> = []

for (const filename of filenames) {
  let slug = path.basename(filename, '.md')
  let imageID: number | string | undefined

  try {
    const markdown = await fs.readFile(path.join(sourceDirectory, filename), 'utf8')
    const source = readFrontmatter(markdown, filename)
    slug = source.slug

    const existing = await payload.find({
      collection: 'illustrations',
      limit: 1,
      where: { slug: { equals: slug } },
    })
    if (existing.totalDocs > 0) {
      skipped.push(slug)
      continue
    }

    const sourceImagePath = path.join(websiteDirectory, 'public', source.image.replace(/^\/+/, ''))
    const imageData = await fs.readFile(sourceImagePath)
    const extension = path.extname(sourceImagePath).toLowerCase()
    const image = await payload.create({
      collection: 'images',
      data: {
        alt: slug,
        metadata: { source: source.image },
      },
      file: {
        data: imageData,
        mimetype: mimeTypeFor(sourceImagePath),
        name: `${slug}${extension}`,
        size: imageData.byteLength,
      },
    })
    imageID = image.id

    await payload.create({
      collection: 'illustrations',
      data: {
        slug,
        image: image.id,
        order: source.order,
        draft: source.draft,
      },
    })
    migrated.push(slug)
  } catch (error) {
    if (imageID !== undefined) {
      await payload.delete({ collection: 'images', id: imageID }).catch(() => undefined)
    }
    failed.push({ slug, error: error instanceof Error ? error.message : String(error) })
  }
}

console.log(JSON.stringify({ sourceCount: filenames.length, migrated, skipped, failed }, null, 2))
process.exit(failed.length > 0 ? 1 : 0)
