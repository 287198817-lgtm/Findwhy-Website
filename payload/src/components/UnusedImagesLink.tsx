import type { BeforeListTableServerProps } from 'payload'
import React from 'react'

import { getUsedImageIDs } from '../lib/mediaReferenceQueries'
import { UnusedImagesListControl } from './UnusedImagesListControl'

export const UnusedImagesLink: React.FC<BeforeListTableServerProps> = async ({ payload }) => {
  const usedIDs = await getUsedImageIDs({ payload })

  return <UnusedImagesListControl usedIDs={Array.from(usedIDs)} />
}
