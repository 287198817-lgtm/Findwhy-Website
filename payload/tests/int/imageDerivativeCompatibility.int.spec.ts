import { describe, expect, test } from 'vitest'

import { Images } from '../../src/collections/Images'
import {
  disableFuturePortfolioGeneration,
  LEGACY_IMAGE_SIZE_NAME,
} from '../../src/storage/images/disablePortfolioGeneration'

const configuredSizes = () => {
  if (!Images.upload || typeof Images.upload === 'boolean') return []
  return Images.upload.imageSizes || []
}

describe('Images derivative backward compatibility', () => {
  test('keeps legacy portfolio metadata in the schema configuration', () => {
    expect(configuredSizes().map(({ name }) => name)).toEqual([
      'thumbnail',
      LEGACY_IMAGE_SIZE_NAME,
      'card',
    ])
  })

  test('disables portfolio only in the initialized runtime generation list', () => {
    const runtimeImages = {
      ...Images,
      upload: {
        ...(typeof Images.upload === 'object' ? Images.upload : {}),
        imageSizes: [...configuredSizes()],
      },
    }
    const payload = {
      collections: { images: { config: runtimeImages } },
    }

    disableFuturePortfolioGeneration(payload as never)

    expect(runtimeImages.upload.imageSizes.map(({ name }) => name)).toEqual(['thumbnail', 'card'])
    expect(configuredSizes().map(({ name }) => name)).toContain(LEGACY_IMAGE_SIZE_NAME)
  })

  test('is idempotent across cached Payload initialization', () => {
    const runtimeImages = {
      ...Images,
      upload: {
        ...(typeof Images.upload === 'object' ? Images.upload : {}),
        imageSizes: [...configuredSizes()],
      },
    }
    const payload = { collections: { images: { config: runtimeImages } } }

    disableFuturePortfolioGeneration(payload as never)
    disableFuturePortfolioGeneration(payload as never)

    expect(runtimeImages.upload.imageSizes.map(({ name }) => name)).toEqual(['thumbnail', 'card'])
  })

  test('preserves all filenames saved on a historical document for exact deletion', () => {
    const historicalDoc = {
      filename: 'legacy.jpg',
      sizes: {
        card: { filename: 'legacy-1200x1752.webp' },
        portfolio: { filename: 'legacy-2500x3650.jpg' },
        thumbnail: { filename: 'legacy-329x480.jpg' },
      },
    }
    const ownedFilenames = [
      historicalDoc.filename,
      ...Object.values(historicalDoc.sizes).map(({ filename }) => filename),
    ]

    expect(ownedFilenames).toEqual([
      'legacy.jpg',
      'legacy-1200x1752.webp',
      'legacy-2500x3650.jpg',
      'legacy-329x480.jpg',
    ])
  })
})
