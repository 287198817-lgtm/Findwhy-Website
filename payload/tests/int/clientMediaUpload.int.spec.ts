import { afterEach, describe, expect, test, vi } from 'vitest'

import { createMediaDocument } from '../../src/components/clientMediaUpload'
import { findOrCreateVideo } from '../../src/components/animationAdminUtils'
import { findOrCreateImage } from '../../src/components/illustrationAdminUtils'
import { generateVideoPosterFile } from '../../src/components/videoPosterClient'

vi.mock('../../src/components/illustrationAdminUtils', () => ({
  findOrCreateImage: vi.fn(),
}))

vi.mock('../../src/components/videoPosterClient', () => ({
  generateVideoPosterFile: vi.fn(),
}))

describe('client media uploads', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('sends large files to the storage handler and metadata only to Payload', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'large-video.mp4', {
      type: 'video/mp4',
    })
    const uploadHandler = vi.fn().mockResolvedValue({ pathname: 'videos/large-video.mp4' })
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createMediaDocument({
      collectionSlug: 'videos',
      data: { alt: 'large video' },
      file,
      uploadHandler,
    })

    expect(uploadHandler).toHaveBeenCalledWith(
      expect.objectContaining({ file }),
    )

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = request.body as FormData
    const payloadFile = body.get('file')

    expect(payloadFile).toBeTypeOf('string')
    expect(JSON.parse(String(payloadFile))).toMatchObject({
      clientUploadContext: { pathname: 'videos/large-video.mp4' },
      collectionSlug: 'videos',
      filename: 'large-video.mp4',
      mimeType: 'video/mp4',
      size: file.size,
    })
    expect(request.headers).toBeUndefined()
  })

  test('deletes a newly created poster when video document creation fails', async () => {
    const file = new File(['video'], 'rollback-video.mp4', { type: 'video/mp4' })
    const poster = new File(['poster'], 'rollback-video-poster.jpg', { type: 'image/jpeg' })
    vi.mocked(generateVideoPosterFile).mockResolvedValue(poster)
    vi.mocked(findOrCreateImage).mockResolvedValue({
      document: { id: 777, filename: poster.name },
      reused: false,
    })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'forced video failure' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 777 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(findOrCreateVideo(file, null, null)).rejects.toThrow('forced video failure')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/images/777', {
      method: 'DELETE',
      credentials: 'include',
    })
  })

  test('keeps video creation available when browser poster generation fails', async () => {
    const file = new File(['video'], 'poster-warning-video.mp4', { type: 'video/mp4' })
    vi.mocked(generateVideoPosterFile).mockRejectedValue(new Error('forced poster failure'))

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        doc: { id: 778, filename: file.name, poster: null },
      }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await findOrCreateVideo(file, null, null)
    expect(result.document.id).toBe(778)
    expect(result.posterWarning).toBe('forced poster failure')
  })
})
