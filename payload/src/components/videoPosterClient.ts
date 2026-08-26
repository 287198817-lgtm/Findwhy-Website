'use client'

const POSTER_SEEK_SECONDS = 0.1
const POSTER_JPEG_QUALITY = 0.86
const VIDEO_LOAD_TIMEOUT_MS = 30_000

const waitForEvent = (target: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out while preparing the video poster (${eventName}).`))
    }, VIDEO_LOAD_TIMEOUT_MS)

    const cleanup = () => {
      window.clearTimeout(timeout)
      target.removeEventListener(eventName, onReady)
      target.removeEventListener('error', onError)
    }
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('The browser could not decode this video to create a poster.'))
    }

    target.addEventListener(eventName, onReady, { once: true })
    target.addEventListener('error', onError, { once: true })
  })

const canvasToJPEG = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode the poster image.')),
      'image/jpeg',
      POSTER_JPEG_QUALITY,
    )
  })

export const posterFilenameFor = (filename: string) =>
  `${filename.replace(/\.[^.]+$/, '') || 'video'}-poster.jpg`

export const generateVideoPosterFile = async (file: File) => {
  const objectURL = URL.createObjectURL(file)
  const video = document.createElement('video')

  try {
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = objectURL

    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await waitForEvent(video, 'loadedmetadata')
    }
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('The selected video does not expose a valid frame size.')
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForEvent(video, 'loadeddata')
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const seekTime = duration > 0
      ? Math.min(POSTER_SEEK_SECONDS, Math.max(0, duration - 0.01))
      : 0

    if (seekTime > 0 && Math.abs(video.currentTime - seekTime) > 0.001) {
      video.currentTime = seekTime
      await waitForEvent(video, 'seeked')
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable for poster generation.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await canvasToJPEG(canvas)
    return new File([blob], posterFilenameFor(file.name), {
      lastModified: Date.now(),
      type: 'image/jpeg',
    })
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectURL)
  }
}
