'use client'

import { Button, useConfig, useListDrawerContext } from '@payloadcms/ui'
import type { BeforeListTableClientProps } from 'payload'
import React from 'react'

export const UnusedImagesLink: React.FC<BeforeListTableClientProps> = () => {
  const { config } = useConfig()
  const { drawerSlug } = useListDrawerContext()

  if (drawerSlug) return null

  const adminRoute = config.routes.admin

  return (
    <div style={{ marginBottom: '20px' }}>
      <Button buttonStyle="secondary" el="link" size="small" to={`${adminRoute}/collections/images/unused`}>
        Unused only
      </Button>
    </div>
  )
}
