import type { Config, Payload } from 'payload'

export const LEGACY_IMAGE_SIZE_NAME = 'portfolio'

/**
 * Keep the legacy portfolio field in Payload's schema while excluding it from
 * runtime image generation. This preserves historical metadata and lets the
 * storage adapter delete historical portfolio objects from the saved document.
 */
export const disableFuturePortfolioGeneration = (payload: Payload) => {
  const images = payload.collections.images?.config
  if (!images?.upload || typeof images.upload === 'boolean') return

  images.upload.imageSizes = images.upload.imageSizes?.filter(
    ({ name }) => name !== LEGACY_IMAGE_SIZE_NAME,
  )
}

export const withPortfolioGenerationDisabled = (config: Config): Config => {
  const previousOnInit = config.onInit

  return {
    ...config,
    onInit: async (payload) => {
      await previousOnInit?.(payload)
      disableFuturePortfolioGeneration(payload)
    },
  }
}
