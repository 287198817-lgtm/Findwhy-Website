export type IllustrationUploadStatus =
  | 'waiting'
  | 'uploading'
  | 'processing'
  | 'creating-illustration'
  | 'completed'
  | 'failed'
  | 'stopped'

export type IllustrationUploadQueuePhase =
  | 'idle'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'finished'

export type IllustrationUploadQueueItem = {
  error?: string
  file: File
  id: string
  status: IllustrationUploadStatus
}

export type IllustrationUploadQueueSnapshot = {
  items: IllustrationUploadQueueItem[]
  phase: IllustrationUploadQueuePhase
}

type ProcessFile = (
  file: File,
  setStatus: (status: 'uploading' | 'processing' | 'creating-illustration') => void,
) => Promise<void>

type QueueOptions = {
  isSystemicError?: (error: unknown) => boolean
  onChange?: (snapshot: IllustrationUploadQueueSnapshot) => void
  onItemCompleted?: (file: File) => void
  processFile: ProcessFile
}

const messageFor = (error: unknown) =>
  error instanceof Error ? error.message : 'Upload failed.'

export class IllustrationUploadQueue {
  private intent: 'none' | 'pause' | 'stop' = 'none'
  private options: QueueOptions
  private runningPromise: Promise<void> | null = null
  private snapshot: IllustrationUploadQueueSnapshot = { items: [], phase: 'idle' }

  constructor(options: QueueOptions) {
    this.options = options
  }

  getSnapshot = () => this.snapshot

  start(files: File[]) {
    if (this.runningPromise || ['running', 'pausing', 'stopping'].includes(this.snapshot.phase)) {
      return this.runningPromise
    }

    this.intent = 'none'
    this.setSnapshot({
      items: files.map((file, index) => ({
        file,
        id: `${index}-${file.name}-${file.size}-${file.lastModified}`,
        status: 'waiting',
      })),
      phase: files.length > 0 ? 'running' : 'finished',
    })
    return this.run()
  }

  pause() {
    if (this.snapshot.phase !== 'running') return
    this.intent = 'pause'
    this.setPhase('pausing')
  }

  resume() {
    if (this.snapshot.phase !== 'paused') return this.runningPromise
    this.intent = 'none'
    this.setPhase('running')
    return this.run()
  }

  stop() {
    if (['finished', 'stopped', 'idle'].includes(this.snapshot.phase)) return
    this.intent = 'stop'

    if (this.snapshot.phase === 'paused') {
      this.stopWaitingItems()
      return
    }

    this.setPhase('stopping')
  }

  private run() {
    if (this.runningPromise) return this.runningPromise

    this.runningPromise = this.runLoop().finally(() => {
      this.runningPromise = null
    })
    return this.runningPromise
  }

  private async runLoop() {
    while (true) {
      const index = this.snapshot.items.findIndex((item) => item.status === 'waiting')
      if (index === -1) {
        this.setPhase(this.intent === 'stop' ? 'stopped' : 'finished')
        return
      }

      this.updateItem(index, { error: undefined, status: 'uploading' })

      try {
        await this.options.processFile(this.snapshot.items[index].file, (status) => {
          this.updateItem(index, { status })
        })
        this.updateItem(index, { status: 'completed' })
        this.options.onItemCompleted?.(this.snapshot.items[index].file)
      } catch (error) {
        this.updateItem(index, { error: messageFor(error), status: 'failed' })
        if (this.options.isSystemicError?.(error)) this.intent = 'pause'
      }

      if (this.intent === 'stop') {
        this.stopWaitingItems()
        return
      }

      if (this.intent === 'pause') {
        this.setPhase('paused')
        return
      }
    }
  }

  private setPhase(phase: IllustrationUploadQueuePhase) {
    this.setSnapshot({ ...this.snapshot, phase })
  }

  private setSnapshot(snapshot: IllustrationUploadQueueSnapshot) {
    this.snapshot = snapshot
    this.options.onChange?.(snapshot)
  }

  private stopWaitingItems() {
    this.intent = 'stop'
    this.setSnapshot({
      items: this.snapshot.items.map((item) =>
        item.status === 'waiting' ? { ...item, status: 'stopped' } : item,
      ),
      phase: 'stopped',
    })
  }

  private updateItem(index: number, update: Partial<IllustrationUploadQueueItem>) {
    this.setSnapshot({
      ...this.snapshot,
      items: this.snapshot.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...update } : item,
      ),
    })
  }
}

export const isSystemicIllustrationUploadError = (error: unknown) => {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined
  const message = messageFor(error).toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    (typeof status === 'number' && status >= 500) ||
    /authentication|authorization|credential|signed upload|storage unavailable|unknown.*provider/.test(
      message,
    )
  )
}
