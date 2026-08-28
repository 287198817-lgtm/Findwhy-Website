import { payloadFetch, resolvePayloadMediaUrl } from './client';
import { getImageUrls, type PayloadImage } from './media';

interface PayloadMedia extends PayloadImage {
	url?: string | null;
	webVideo?: PayloadMedia | number | string | null;
}

interface PayloadAnimation {
	id: number | string;
	slug: string;
	video: PayloadMedia | number | string | null;
	poster?: PayloadMedia | number | string | null;
	order?: number | null;
	draft?: boolean | null;
}

interface PayloadCollectionResponse<T> {
	docs: T[];
	hasNextPage: boolean;
	nextPage: number | null;
}

export interface AnimationItem {
	slug: string;
	video: string;
	poster?: string;
	posterPreviewUrl?: string;
	order: number;
}

const getMediaUrl = (media: PayloadMedia | number | string | null | undefined) => {
	if (!media || typeof media !== 'object' || !media.url) return null;
	return resolvePayloadMediaUrl(media.url);
};

export const getAnimations = async (): Promise<AnimationItem[]> => {
	const documents: PayloadAnimation[] = [];
	let page = 1;

	do {
		const params = new URLSearchParams({
			depth: '2',
			limit: '100',
			page: String(page),
			sort: 'order',
		});
		const response = await payloadFetch<PayloadCollectionResponse<PayloadAnimation>>(
			`/api/animations?${params}`,
		);

		documents.push(...response.docs);
		page = response.hasNextPage && response.nextPage ? response.nextPage : 0;
	} while (page > 0);

	return documents
		.filter((document) => document.draft !== true)
		.map((document) => {
			const poster = getImageUrls(document.poster);
			return {
				slug: document.slug,
				video: document.video && typeof document.video === 'object'
					? getMediaUrl(document.video.webVideo) ?? getMediaUrl(document.video)
					: getMediaUrl(document.video),
				poster: poster?.fullUrl,
				posterPreviewUrl: poster?.previewUrl,
				order: document.order ?? Number.POSITIVE_INFINITY,
			};
		})
		.filter((document): document is AnimationItem => Boolean(document.video))
		.sort((a, b) => a.order - b.order);
};
