import { Button } from '@payloadcms/ui'
import type { BeforeListTableServerProps } from 'payload'
import React from 'react'

export const UnusedImagesLink: React.FC<BeforeListTableServerProps> = ({ payload }) => {
  const adminRoute = payload.config.routes.admin

  return (
    <div style={{ marginBottom: '20px' }}>
      <Button buttonStyle="secondary" el="link" size="small" to={`${adminRoute}/collections/images/unused`}>
        Unused only
      </Button>
    </div>
  )
}
