import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Images } from './collections/Images'
import { Videos } from './collections/Videos'
import { WebVideos } from './collections/WebVideos'
import { Illustrations } from './collections/Illustrations'
import { Animations } from './collections/Animations'
import { Series } from './collections/Series'
import { Projects } from './collections/Projects'
import { About } from './globals/About'
import { imagesRoutingStorage } from './storage/images/plugin'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const enableImagesStorageRouter = process.env.ENABLE_IMAGES_STORAGE_ROUTER === 'true'

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Images, Videos, WebVideos, Illustrations, Animations, Series, Projects],
  globals: [About],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      alwaysInsertFields: true,
      clientUploads: true,
      collections: {
        ...(!enableImagesStorageRouter
          ? { images: { disablePayloadAccessControl: true as const, prefix: 'images' } }
          : {}),
        videos: { disablePayloadAccessControl: true, prefix: 'videos' },
        'web-videos': { disablePayloadAccessControl: true, prefix: 'video-web' },
      },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
    ...(enableImagesStorageRouter ? [imagesRoutingStorage()] : []),
  ],
})
