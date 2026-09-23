import { afterEach, describe, expect, test, vi } from 'vitest'

import { createIllustrationFromFile } from '../../src/components/illustrationAdminUtils'

describe('Illustration upload transaction', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('creates the Image before its Illustration and reports processing', async () => {
    const file = new File(['image'], 'ordered.jpg', { type: 'image/jpeg' })
    const onImageCreated = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ doc: { id: 901 } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ doc: { id: 902 } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await createIllustrationFromFile(file, null, onImageCreated)

    expect(onImageCreated).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/images')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/illustrations')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ draft: false, image: 901 })
  })

  test('deletes only the newly created Image if Illustration creation fails', async () => {
    const file = new File(['image'], 'failed.jpg', { type: 'image/jpeg' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ doc: { id: 903 } }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Illustration validation failed' }), { status: 400 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 903 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createIllustrationFromFile(file, null)).rejects.toThrow(
      'Illustration validation failed',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/images/903', {
      method: 'DELETE',
      credentials: 'include',
    })
  })

  test('reports cleanup failure without hiding the original Illustration error', async () => {
    const file = new File(['image'], 'cleanup-failed.jpg', { type: 'image/jpeg' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ doc: { id: 904 } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'create failed' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'delete failed' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createIllustrationFromFile(file, null)).rejects.toThrow(
      'create failed Image cleanup failed: delete failed',
    )
  })
})
