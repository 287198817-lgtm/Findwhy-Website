'use client'

import type { DefaultCellComponentProps } from 'payload'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export const InlineOrderCell: React.FC<DefaultCellComponentProps> = ({
  cellData,
  collectionSlug,
  rowData,
}) => {
  const initialOrder = typeof cellData === 'number' ? cellData : Number(cellData) || 0
  const [order, setOrder] = useState(initialOrder)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const lastSavedOrder = useRef(initialOrder)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestVersion = useRef(0)
  const router = useRouter()

  useEffect(() => {
    setOrder(initialOrder)
    lastSavedOrder.current = initialOrder
  }, [initialOrder])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const saveOrder = async (nextOrder: number) => {
    if (!Number.isFinite(nextOrder) || nextOrder === lastSavedOrder.current) return

    const version = ++requestVersion.current
    setSaveState('saving')

    try {
      const response = await fetch(`/api/${collectionSlug}/${encodeURIComponent(String(rowData.id))}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: nextOrder }),
      })

      if (!response.ok) throw new Error(`Unable to update order (${response.status})`)
      if (version !== requestVersion.current) return

      lastSavedOrder.current = nextOrder
      setSaveState('saved')
      router.refresh()
      window.setTimeout(() => setSaveState('idle'), 1200)
    } catch {
      if (version !== requestVersion.current) return
      setSaveState('error')
    }
  }

  const scheduleSave = (nextOrder: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveOrder(nextOrder), 450)
  }

  const saveImmediately = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveOrder(order)
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{ alignItems: 'center', display: 'flex', gap: '8px' }}
    >
      <input
        aria-label={`Order for ${String(rowData.slug ?? rowData.id)}`}
        min={0}
        onBlur={saveImmediately}
        onChange={(event) => {
          const nextOrder = event.currentTarget.valueAsNumber
          setOrder(nextOrder)
          scheduleSave(nextOrder)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            saveImmediately()
            event.currentTarget.blur()
          }
        }}
        step={1}
        style={{
          background: 'var(--theme-input-bg)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: '3px',
          color: 'var(--theme-text)',
          padding: '6px 8px',
          width: '72px',
        }}
        type="number"
        value={Number.isFinite(order) ? order : ''}
      />
      <span
        aria-live="polite"
        style={{ color: saveState === 'error' ? 'var(--theme-error-500)' : 'var(--theme-elevation-500)', fontSize: '12px' }}
      >
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved'}
        {saveState === 'error' && 'Error'}
      </span>
    </div>
  )
}
