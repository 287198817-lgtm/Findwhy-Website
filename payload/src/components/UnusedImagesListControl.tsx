'use client'

import { Button, toast, useConfig, useListDrawerContext, useListQuery } from '@payloadcms/ui'
import type { Where } from 'payload'
import React, { useState } from 'react'

type Props = {
  usedIDs: string[]
}

const sameIDs = (value: unknown, usedIDs: string[]) => {
  if (!Array.isArray(value) || value.length !== usedIDs.length) return false
  const expected = new Set(usedIDs.map(String))
  return value.every((id) => expected.has(String(id)))
}

const isUnusedCondition = (where: Where, usedIDs: string[]) => {
  const id = where.id
  return Boolean(id && typeof id === 'object' && !Array.isArray(id)
    && 'not_in' in id && sameIDs(id.not_in, usedIDs))
}

const containsUnusedCondition = (where: Where | undefined, usedIDs: string[]): boolean => {
  if (!where) return false
  if (isUnusedCondition(where, usedIDs)) return true
  return Array.isArray(where.and) && where.and.some((condition) => containsUnusedCondition(condition, usedIDs))
}

const removeUnusedCondition = (where: Where, usedIDs: string[]): Where | undefined => {
  if (isUnusedCondition(where, usedIDs)) return undefined
  if (!Array.isArray(where.and)) return where

  const and = where.and
    .map((condition) => removeUnusedCondition(condition, usedIDs))
    .filter((condition): condition is Where => Boolean(condition))
  const remainder = Object.fromEntries(Object.entries(where).filter(([key]) => key !== 'and')) as Where

  if (and.length > 0) remainder.and = and
  return Object.keys(remainder).length > 0 ? remainder : undefined
}

export const UnusedImagesListControl: React.FC<Props> = ({ usedIDs }) => {
  const { config } = useConfig()
  const { drawerSlug } = useListDrawerContext()
  const { handleWhereChange, query } = useListQuery()
  const [updating, setUpdating] = useState(false)
  const unusedOnly = containsUnusedCondition(query.where, usedIDs)

  if (!drawerSlug) {
    return (
      <div style={{ marginBottom: '20px' }}>
        <Button
          buttonStyle="secondary"
          el="link"
          size="small"
          to={`${config.routes.admin}/collections/images/unused`}
        >
          Unused only
        </Button>
      </div>
    )
  }

  const toggleUnused = async () => {
    if (!handleWhereChange || updating) return
    setUpdating(true)

    try {
      const where = unusedOnly
        ? removeUnusedCondition(query.where ?? {}, usedIDs) ?? {}
        : {
            and: [
              ...(query.where && Object.keys(query.where).length > 0 ? [query.where] : []),
              { id: { not_in: usedIDs } },
            ],
          }
      await handleWhereChange(where)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the image filter.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <Button
        aria-pressed={unusedOnly}
        buttonStyle={unusedOnly ? 'primary' : 'secondary'}
        disabled={updating}
        onClick={() => void toggleUnused()}
        size="small"
      >
        {updating ? 'Updating…' : `Unused only: ${unusedOnly ? 'On' : 'Off'}`}
      </Button>
    </div>
  )
}
