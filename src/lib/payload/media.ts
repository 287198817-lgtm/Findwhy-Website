import { resolvePayloadMediaUrl } from './client';

export interface PayloadImageSize {
	url?: string | null;
	width?: number | null;
	height?: number | null;
	mimeType?: string | null;
	filesize?: number | null;
}

export interface PayloadImage {
	url?: string | null;
	width?: number | null;
	height?: number | null;
	sizes?: {
		thumbnail?: PayloadImageSize | null;
		card?: PayloadImageSize | null;
		portfolio?: PayloadImageSize | null;
	} | null;
}

export const RESPONSIVE_GALLERY_SIZES =
	'(max-width: 600px) 50vw, (max-width: 1024px) 33.333vw, 25vw';

export interface ImageUrls {
	previewUrl: string;
	fullUrl: string;
	lightboxUrl: string;
	responsiveSrcSet?: string;
	responsiveSizes?: string;
	previewWidth?: number;
	previewHeight?: number;
	fullWidth?: number;
	fullHeight?: number;
	lightboxWidth?: number;
	lightboxHeight?: number;
}

export const buildImageSrcSet = (
	candidates: Array<{ url?: null | string; width?: null | number }>,
) => {
	const unique = new Map<number, string>();
	for (const candidate of candidates) {
		if (candidate.url && candidate.width && candidate.width > 0) {
			unique.set(candidate.width, resolvePayloadMediaUrl(candidate.url));
		}
	}
	return [...unique.entries()]
		.sort(([left], [right]) => left - right)
		.map(([width, url]) => `${url} ${width}w`)
		.join(', ') || undefined;
};

export const getImageUrls = (
	image: PayloadImage | number | string | null | undefined,
): ImageUrls | null => {
	if (!image || typeof image !== 'object' || !image.url) return null;

	const fullUrl = resolvePayloadMediaUrl(image.url);
	const thumbnail = image.sizes?.thumbnail;
	const card = image.sizes?.card;
	const portfolio = image.sizes?.portfolio;
	const previewUrl = card?.url ? resolvePayloadMediaUrl(card.url) : fullUrl;
	const lightboxUrl = portfolio?.url ? resolvePayloadMediaUrl(portfolio.url) : fullUrl;
	const responsiveSrcSet = buildImageSrcSet([
		{ url: thumbnail?.url, width: thumbnail?.width },
		{ url: card?.url, width: card?.width },
	]);

	return {
		previewUrl,
		fullUrl,
		lightboxUrl,
		responsiveSrcSet,
		responsiveSizes: responsiveSrcSet ? RESPONSIVE_GALLERY_SIZES : undefined,
		previewWidth: card?.width ?? image.width ?? undefined,
		previewHeight: card?.height ?? image.height ?? undefined,
		fullWidth: image.width ?? undefined,
		fullHeight: image.height ?? undefined,
		lightboxWidth: portfolio?.width ?? image.width ?? undefined,
		lightboxHeight: portfolio?.height ?? image.height ?? undefined,
	};
};
