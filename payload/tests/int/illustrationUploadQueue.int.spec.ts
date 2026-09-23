import { describe, expect, test, vi } from 'vitest'

import {
  IllustrationUploadQueue,
  isSystemicIllustrationUploadError,
} from '../../src/components/illustrationUploadQueue'

const files = (...names: string[]) => names.map((name) => new File([name], name, { type: 'image/jpeg' }))

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('IllustrationUploadQueue', () => {
  test('uploads strictly one file at a time and preserves selection order', async () => {
    const order: string[] = []
    let active = 0
    let maximumActive = 0
    const queue = new IllustrationUploadQueue({
      processFile: async (file) => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        order.push(file.name)
        await flush()
        active -= 1
      },
    })

    const selected = Array.from({ length: 15 }, (_, index) => `${index + 1}.jpg`)
    await queue.start(files(...selected))

    expect(order).toEqual(selected)
    expect(maximumActive).toBe(1)
    expect(queue.getSnapshot().items.every((item) => item.status === 'completed')).toBe(true)
  })

  test('reports uploading, processing, Illustration creation and completed for each transaction', async () => {
    const statuses: string[] = []
    const queue = new IllustrationUploadQueue({
      onChange: (snapshot) => statuses.push(snapshot.items[0]?.status),
      processFile: async (_file, setStatus) => {
        setStatus('uploading')
        setStatus('processing')
        setStatus('creating-illustration')
      },
    })

    await queue.start(files('one.jpg'))
    expect(statuses).toEqual(
      expect.arrayContaining([
        'waiting',
        'uploading',
        'processing',
        'creating-illustration',
        'completed',
      ]),
    )
  })

  test('pause waits for the active complete transaction and leaves later files waiting', async () => {
    const first = deferred()
    const processFile = vi.fn().mockImplementationOnce(() => first.promise)
    const queue = new IllustrationUploadQueue({ processFile })
    const run = queue.start(files('one.jpg', 'two.jpg', 'three.jpg'))

    queue.pause()
    expect(queue.getSnapshot().phase).toBe('pausing')
    expect(queue.getSnapshot().items[0].status).toBe('uploading')
    first.resolve()
    await run

    expect(queue.getSnapshot().phase).toBe('paused')
    expect(queue.getSnapshot().items.map((item) => item.status)).toEqual([
      'completed',
      'waiting',
      'waiting',
    ])
    expect(processFile).toHaveBeenCalledTimes(1)
  })

  test('resume continues at the first waiting file without retrying completed files', async () => {
    const first = deferred()
    const processed: string[] = []
    const queue = new IllustrationUploadQueue({
      processFile: async (file) => {
        processed.push(file.name)
        if (file.name === 'one.jpg') await first.promise
      },
    })
    const run = queue.start(files('one.jpg', 'two.jpg', 'three.jpg'))
    queue.pause()
    first.resolve()
    await run

    await queue.resume()
    expect(processed).toEqual(['one.jpg', 'two.jpg', 'three.jpg'])
    expect(queue.getSnapshot().phase).toBe('finished')
  })

  test('stop waits for the active transaction and marks later files stopped', async () => {
    const first = deferred()
    const processFile = vi.fn().mockImplementationOnce(() => first.promise)
    const queue = new IllustrationUploadQueue({ processFile })
    const run = queue.start(files('one.jpg', 'two.jpg', 'three.jpg'))

    queue.stop()
    expect(queue.getSnapshot().phase).toBe('stopping')
    first.resolve()
    await run

    expect(queue.getSnapshot().phase).toBe('stopped')
    expect(queue.getSnapshot().items.map((item) => item.status)).toEqual([
      'completed',
      'stopped',
      'stopped',
    ])
  })

  test('stop while paused preserves completed files and stops all waiting files', async () => {
    const first = deferred()
    const queue = new IllustrationUploadQueue({
      processFile: (file) => (file.name === 'one.jpg' ? first.promise : Promise.resolve()),
    })
    const run = queue.start(files('one.jpg', 'two.jpg'))
    queue.pause()
    first.resolve()
    await run
    queue.stop()

    expect(queue.getSnapshot().phase).toBe('stopped')
    expect(queue.getSnapshot().items.map((item) => item.status)).toEqual(['completed', 'stopped'])
  })

  test('an individual file failure records its error and continues', async () => {
    const processed: string[] = []
    const queue = new IllustrationUploadQueue({
      processFile: async (file) => {
        processed.push(file.name)
        if (file.name === 'bad.jpg') throw new Error('invalid image')
      },
    })

    await queue.start(files('one.jpg', 'bad.jpg', 'three.jpg'))
    expect(processed).toEqual(['one.jpg', 'bad.jpg', 'three.jpg'])
    expect(queue.getSnapshot().items.map((item) => item.status)).toEqual([
      'completed',
      'failed',
      'completed',
    ])
    expect(queue.getSnapshot().items[1].error).toBe('invalid image')
  })

  test('notifies completed files exactly once and excludes failed files', async () => {
    const completed: string[] = []
    const queue = new IllustrationUploadQueue({
      onItemCompleted: (file) => completed.push(file.name),
      processFile: async (file) => {
        if (file.name === 'bad.jpg') throw new Error('invalid image')
      },
    })

    await queue.start(files('one.jpg', 'bad.jpg', 'two.jpg'))

    expect(completed).toEqual(['one.jpg', 'two.jpg'])
  })

  test('pause exposes the completed active item and resume adds remaining items without duplicates', async () => {
    const first = deferred()
    const completed: string[] = []
    const queue = new IllustrationUploadQueue({
      onItemCompleted: (file) => completed.push(file.name),
      processFile: (file) => file.name === 'one.jpg' ? first.promise : Promise.resolve(),
    })
    const run = queue.start(files('one.jpg', 'two.jpg'))
    queue.pause()
    first.resolve()
    await run

    expect(queue.getSnapshot().phase).toBe('paused')
    expect(completed).toEqual(['one.jpg'])

    await queue.resume()
    expect(completed).toEqual(['one.jpg', 'two.jpg'])
  })

  test('stop exposes the completed active item and excludes stopped items', async () => {
    const first = deferred()
    const completed: string[] = []
    const queue = new IllustrationUploadQueue({
      onItemCompleted: (file) => completed.push(file.name),
      processFile: () => first.promise,
    })
    const run = queue.start(files('one.jpg', 'two.jpg'))
    queue.stop()
    first.resolve()
    await run

    expect(completed).toEqual(['one.jpg'])
    expect(queue.getSnapshot().items[1].status).toBe('stopped')
  })

  test('a systemic error pauses after the failed transaction', async () => {
    const processFile = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error('server unavailable'), { status: 503 }),
    )
    const queue = new IllustrationUploadQueue({
      isSystemicError: isSystemicIllustrationUploadError,
      processFile,
    })

    await queue.start(files('one.jpg', 'two.jpg'))
    expect(queue.getSnapshot().phase).toBe('paused')
    expect(queue.getSnapshot().items.map((item) => item.status)).toEqual(['failed', 'waiting'])
  })

  test('resume after a systemic failure does not retry the failed file', async () => {
    const processed: string[] = []
    const queue = new IllustrationUploadQueue({
      isSystemicError: isSystemicIllustrationUploadError,
      processFile: async (file) => {
        processed.push(file.name)
        if (file.name === 'one.jpg') {
          throw Object.assign(new Error('not authorized'), { status: 401 })
        }
      },
    })
    await queue.start(files('one.jpg', 'two.jpg'))
    await queue.resume()

    expect(processed).toEqual(['one.jpg', 'two.jpg'])
    expect(queue.getSnapshot().items.map((item) => item.status)).toEqual(['failed', 'completed'])
  })

  test('empty selection finishes without invoking the processor', async () => {
    const processFile = vi.fn()
    const queue = new IllustrationUploadQueue({ processFile })
    await queue.start([])
    expect(processFile).not.toHaveBeenCalled()
    expect(queue.getSnapshot().phase).toBe('finished')
  })

  test('systemic error classification covers auth, server and storage-provider failures', () => {
    expect(isSystemicIllustrationUploadError(Object.assign(new Error('x'), { status: 403 }))).toBe(true)
    expect(isSystemicIllustrationUploadError(Object.assign(new Error('x'), { status: 500 }))).toBe(true)
    expect(isSystemicIllustrationUploadError(new Error('Unknown Images client upload provider'))).toBe(true)
    expect(isSystemicIllustrationUploadError(new Error('invalid image'))).toBe(false)
  })
})
