import { describe, expect, test, vi } from 'vitest'

import { GET as healthCheck } from '@/app/api/health/route'
import { verifyGeneratedPoster } from '@/hooks/syncWebVideo'
import { resolveSelfHostConfig } from '@/lib/selfHostConfig'
import type { Image } from '@/payload-types'

const poster = (sizes: Image['sizes']): Image => ({
  id: 120,
  alt: 'Generated poster',
  filename: 'generated.jpg',
  prefix: 'images/production/0123456789abcdef0123456789abcdef',
  storageProvider: 'aliyun-oss',
  url: 'https://img.findwhy.art/images/production/ns/generated.jpg',
  mimeType: 'image/jpeg',
  filesize: 80,
  width: 398,
  height: 896,
  sizes,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const requiredSizes = {
  thumbnail: { url: 'https://img.findwhy.art/images/production/ns/generated-thumbnail.jpg' },
  card: { url: 'https://img.findwhy.art/images/production/ns/generated-card.webp' },
}

describe('Payload self-host compatibility', () => {
  test('preserves existing platform behavior when PAYLOAD_SERVER_URL is unset', () => {
    expect(resolveSelfHostConfig({})).toEqual({})
  })

  test('resolves an explicit server URL and strict self-host allowlists', () => {
    const config = resolveSelfHostConfig({
      PAYLOAD_SERVER_URL: 'https://cms.findwhy.art/',
      VERCEL_URL: 'findwhy-payload-preview.vercel.app',
    })
    expect(config.serverURL).toBe('https://cms.findwhy.art')
    expect(config.cors).toEqual(config.csrf)
    expect(config.cors).toEqual(expect.arrayContaining([
      'https://cms.findwhy.art',
      'https://findwhy.art',
      'https://findwhy-payload-preview.vercel.app',
      'http://localhost:3000',
    ]))
    expect(config.cors).not.toContain('https://attacker.example')
    expect(config.cors).not.toContain('*')
  })

  test('accepts a new poster without a portfolio derivative', async () => {
    const read = vi.fn(async () => new Response(null, { status: 206 }))
    await expect(verifyGeneratedPoster(poster(requiredSizes), { environment: 'production', read })).resolves.toBeUndefined()
    expect(read).toHaveBeenCalledTimes(3)
  })

  test('keeps historical posters with portfolio metadata compatible', async () => {
    const historical = poster({
      ...requiredSizes,
      portfolio: { url: 'https://img.findwhy.art/images/production/ns/generated-portfolio.jpg' },
    })
    const read = vi.fn(async () => new Response(null, { status: 200 }))
    await expect(verifyGeneratedPoster(historical, { environment: 'production', read })).resolves.toBeUndefined()
    expect(read).toHaveBeenCalledTimes(3)
  })

  test.each(['thumbnail', 'card'] as const)('rejects a poster missing %s', async (missing) => {
    const sizes = { ...requiredSizes, [missing]: undefined }
    await expect(verifyGeneratedPoster(poster(sizes), {
      environment: 'production',
      read: vi.fn(),
    })).rejects.toThrow('incomplete storage metadata')
  })

  test('returns a minimal non-sensitive health response', async () => {
    const response = healthCheck()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(JSON.stringify(await healthCheck().json())).not.toMatch(/secret|database|oss|token/iu)
  })
})
