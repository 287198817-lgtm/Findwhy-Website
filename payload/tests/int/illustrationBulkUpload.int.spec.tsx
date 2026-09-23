import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { IllustrationBulkUpload } from '../../src/components/IllustrationBulkUpload'
import { createIllustrationFromFile } from '../../src/components/illustrationAdminUtils'

const refresh = vi.fn()
let container: HTMLDivElement
let root: Root

vi.mock('@payloadcms/ui', () => ({
  useUploadHandlers: () => ({ getUploadHandler: () => null }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('../../src/components/illustrationAdminUtils', () => ({
  createIllustrationFromFile: vi.fn(),
}))

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

const selectFiles = (names: string[]) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: names.map((name) => new File([name], name, { type: 'image/jpeg' })),
  })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const renderComponent = async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<IllustrationBulkUpload />))
}

const waitForText = async (text: string) => {
  for (let index = 0; index < 50; index += 1) {
    if (container.textContent?.includes(text)) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error(`Timed out waiting for: ${text}`)
}

const clickButton = (name: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === name,
  )
  if (!button) throw new Error(`Button not found: ${name}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('IllustrationBulkUpload UI', () => {
  beforeEach(() => {
    refresh.mockReset()
    vi.mocked(createIllustrationFromFile).mockReset()
  })

  afterEach(async () => {
    if (root) await act(async () => root.unmount())
    container?.remove()
    vi.restoreAllMocks()
  })

  test('renders each selected filename and final completion progress', async () => {
    vi.mocked(createIllustrationFromFile).mockResolvedValue(
      new Response(JSON.stringify({ doc: { id: 1 } }), { status: 201 }),
    )
    await renderComponent()
    await act(async () => selectFiles(['first.jpg', 'second.jpg']))

    await waitForText('first.jpg')
    expect(container.textContent).toContain('second.jpg')
    await waitForText('Completed 2 / 2')
    expect(refresh).toHaveBeenCalled()
  })

  test('warns before navigation while a transaction is active', async () => {
    const active = deferred()
    vi.mocked(createIllustrationFromFile).mockReturnValue(active.promise as never)
    await renderComponent()
    await act(async () => selectFiles(['active.jpg']))
    await waitForText('Uploading')

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    await act(async () => active.resolve())
  })

  test('Pause becomes Pausing and then Paused only after the current file finishes', async () => {
    const active = deferred()
    vi.mocked(createIllustrationFromFile)
      .mockReturnValueOnce(active.promise as never)
      .mockResolvedValue(new Response('{}', { status: 201 }))
    await renderComponent()
    await act(async () => selectFiles(['active.jpg', 'waiting.jpg']))
    await waitForText('Uploading')

    await act(async () => clickButton('Pause'))
    expect(container.textContent).toContain('pausing')
    await act(async () => active.resolve())
    await waitForText('paused')
    expect(container.textContent).toContain('Waiting')
  })

  test('Stop preserves the current success and marks later files stopped', async () => {
    const active = deferred()
    vi.mocked(createIllustrationFromFile).mockReturnValueOnce(active.promise as never)
    await renderComponent()
    await act(async () => selectFiles(['active.jpg', 'waiting.jpg']))
    await waitForText('Uploading')

    await act(async () => clickButton('Stop'))
    expect(container.textContent).toContain('stopping')
    await act(async () => active.resolve())
    await waitForText('stopped')
    expect(container.textContent).toContain('Completed')
    expect(container.textContent).toContain('Stopped')
  })
})
