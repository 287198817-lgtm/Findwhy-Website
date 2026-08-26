'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

type Media = {
  filename?: string | null
  thumbnailURL?: string | null
  url?: string | null
}

type OrderItem = {
  id: number | string
  slug?: string | null
  order?: number | null
  image?: Media | number | string | null
  video?: Media | number | string | null
  poster?: Media | number | string | null
}

type CollectionResponse = { docs: OrderItem[] }
type CollectionSlug = 'illustrations' | 'animations'

const mediaObject = (value: Media | number | string | null | undefined) =>
  value && typeof value === 'object' ? value : null

const DraggableMediaOrderList: React.FC<{ collection: CollectionSlug; label: string }> = ({ collection, label }) => {
  const [items, setItems] = useState<OrderItem[]>([])
  const [draggedID, setDraggedID] = useState<number | string | null>(null)
  const [status, setStatus] = useState('Loading…')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const load = async () => {
    setStatus('Loading…')
    try {
      const response = await fetch(`/api/${collection}?depth=1&limit=1000&sort=order`, { credentials: 'include' })
      if (!response.ok) throw new Error(`Unable to load ${label}.`)
      const result = await response.json() as CollectionResponse
      setItems(result.docs)
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load media.')
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (next: OrderItem[]) => {
    setSaving(true)
    setStatus('Saving order…')
    try {
      for (const [index, item] of next.entries()) {
        const order = index + 1
        if (item.order === order) continue
        const response = await fetch(`/api/${collection}/${encodeURIComponent(String(item.id))}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order }),
        })
        if (!response.ok) throw new Error(`Unable to save ${label} order.`)
      }
      setItems(next.map((item, index) => ({ ...item, order: index + 1 })))
      setStatus('Order saved.')
      router.refresh()
      window.setTimeout(() => setStatus(''), 1200)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save order.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const moveBefore = (targetID: number | string) => {
    if (saving || draggedID === null || String(draggedID) === String(targetID)) return
    const next = [...items]
    const sourceIndex = next.findIndex((item) => String(item.id) === String(draggedID))
    const targetIndex = next.findIndex((item) => String(item.id) === String(targetID))
    if (sourceIndex === -1 || targetIndex === -1) return
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    setItems(next)
    setDraggedID(null)
    void persist(next)
  }

  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', marginBottom: '24px', padding: '16px' }}>
      <strong style={{ display: 'block', marginBottom: '12px' }}>{label} order</strong>
      {items.map((item, index) => {
        const primary = collection === 'illustrations' ? mediaObject(item.image) : mediaObject(item.video)
        const preview = collection === 'illustrations' ? primary : mediaObject(item.poster)
        const previewURL = preview?.thumbnailURL || preview?.url
        const filename = primary?.filename || item.slug || `${label} #${item.id}`
        return (
          <div draggable={!saving} key={item.id} onDragEnd={() => setDraggedID(null)}
            onDragOver={(event) => event.preventDefault()} onDragStart={() => setDraggedID(item.id)}
            onDrop={() => moveBefore(item.id)}
            style={{ alignItems: 'center', border: '1px solid var(--theme-elevation-150)', cursor: saving ? 'wait' : 'grab', display: 'flex', gap: '12px', marginBottom: '8px', padding: '10px' }}>
            <span aria-hidden="true">⋮⋮</span>
            <span style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
            {previewURL ? <img alt="" src={previewURL} style={{ height: '56px', objectFit: 'contain', width: '56px' }} /> : <span style={{ background: 'var(--theme-elevation-100)', display: 'block', height: '56px', width: '56px' }} />}
            <span style={{ flex: 1 }}>{filename}</span>
          </div>
        )
      })}
      <div aria-live="polite" style={{ color: status.includes('Unable') ? 'var(--theme-error-500)' : 'var(--theme-elevation-500)', fontSize: '13px', marginTop: '8px' }}>{status}</div>
    </div>
  )
}

export const IllustrationOrderList = () => <DraggableMediaOrderList collection="illustrations" label="Illustration" />
export const AnimationOrderList = () => <DraggableMediaOrderList collection="animations" label="Animation" />
