export type MediaOrderCollection = 'illustrations' | 'animations'

export const MEDIA_ORDER_REFRESH_EVENT = 'findwhy:media-order-refresh'

export const requestMediaOrderRefresh = (collection: MediaOrderCollection) => {
  window.dispatchEvent(
    new CustomEvent(MEDIA_ORDER_REFRESH_EVENT, { detail: { collection } }),
  )
}

export const isMediaOrderRefreshFor = (
  event: Event,
  collection: MediaOrderCollection,
) =>
  event instanceof CustomEvent &&
  (event.detail as { collection?: unknown } | undefined)?.collection === collection
