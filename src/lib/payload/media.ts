import { resolvePayloadMediaUrl } from './client';

export interface PayloadImageSize {
	url?: string | null;
}

export interface PayloadImage {
	url?: string | null;
	sizes?: {
		card?: PayloadImageSize | null;
	} | null;
}

export interface ImageUrls {
	previewUrl: string;
	fullUrl: string;
}

export const getImageUrls = (
	image: PayloadImage | number | string | null | undefined,
): ImageUrls | null => {
	if (!image || typeof image !== 'object' || !image.url) return null;

	const fullUrl = resolvePayloadMediaUrl(image.url);
	const cardUrl = image.sizes?.card?.url;

	return {
		previewUrl: cardUrl ? resolvePayloadMediaUrl(cardUrl) : fullUrl,
		fullUrl,
	};
};
